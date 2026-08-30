import { getAPIBaseURL } from './auth';

export type OpeningDraftInput = {
  projectName: string;
  problem: string;
  role: string;
  skills: string[];
  commitment: string;
  duration: string;
  timezone: string;
  compensation: string;
  firstMilestone: string;
  ownerContribution: string;
  confidentiality: string;
};

export type PublicationStatus = 'draft' | 'published' | 'closed';

export type OwnedOpening = {
  id: string;
  publicationStatus: PublicationStatus;
  input: OpeningDraftInput;
};

export type OwnedOpeningDraft = OwnedOpening & { publicationStatus: 'draft' };

type APIEnvelope = { data?: unknown };
type APIErrorEnvelope = { error?: { code?: unknown; message?: unknown; field?: unknown } };

const roles = ['Frontend engineer', 'Backend engineer', 'Product designer', 'UX researcher'] as const;
const commitments = ['Under 6 hrs/week', '6–8 hrs/week', '8+ hrs/week'];
const durations = ['2–4 weeks', '5–8 weeks', '2–3 months'];
const compensationValues = ['Paid', 'Fixed bounty', 'Revenue share', 'Unpaid / portfolio'];
const confidentialityDescriptions: Record<string, string> = {
  'Public project details; no private credentials or client-confidential material.': 'Public',
  'Limited public details; additional context is shared only after owner review.': 'Limited details',
  'Confidential details are shared only after an explicit agreement and minimum access review.': 'Confidential after agreement',
};

export class OpeningDraftAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly field?: keyof OpeningDraftInput,
  ) {
    super(code);
  }
}

function hasUniqueValidSkills(value: unknown): value is string[] {
  return Array.isArray(value)
    && value.length >= 1
    && value.length <= 12
    && value.every((skill) => typeof skill === 'string' && skill.trim().length >= 1 && skill.length <= 40)
    && new Set(value.map((skill) => skill.trim().toLowerCase())).size === value.length;
}

function parseRoleAndProject(title: unknown) {
  if (typeof title !== 'string') return null;
  const role = roles.find((candidate) => title.startsWith(`${candidate} for `));
  if (!role) return null;
  const projectName = title.slice(role.length + 5).trim();
  return projectName ? { projectName, role } : null;
}

/** Converts the catalogue-shaped draft response back into the creator's controlled fields. */
function parseOwnedOpening(value: unknown): OwnedOpening {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid opening draft.');
  const opening = value as Record<string, unknown>;
  if (!['draft', 'published', 'closed'].includes(opening.publicationStatus as string)) {
    throw new Error('The API returned an invalid opening draft.');
  }
  const identity = parseRoleAndProject(opening.title);
  const compensation = opening.compensation === 'Portfolio' ? 'Unpaid / portfolio' : opening.compensation;
  const confidentiality = typeof opening.confidentiality === 'string'
    ? confidentialityDescriptions[opening.confidentiality]
    : undefined;
  const requiredStrings = ['id', 'summary', 'commitment', 'duration', 'timezone', 'firstMilestone', 'ownerContribution'];
  const expectedRole = identity?.role === 'Product designer'
    ? 'Design'
    : identity?.role === 'UX researcher' ? 'Research' : 'Engineering';
  if (
    !identity
    || requiredStrings.some((field) => typeof opening[field] !== 'string' || !(opening[field] as string).trim())
    || !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(opening.id as string)
    || opening.role !== expectedRole
    || identity.projectName.length < 3
    || identity.projectName.length > 80
    || (opening.summary as string).trim().length < 20
    || (opening.summary as string).trim().length > 240
    || !hasUniqueValidSkills(opening.skills)
    || !commitments.includes(opening.commitment as string)
    || !durations.includes(opening.duration as string)
    || !compensationValues.includes(compensation as string)
    || !confidentiality
    || (opening.firstMilestone as string).trim().length < 20
    || (opening.firstMilestone as string).trim().length > 500
    || (opening.ownerContribution as string).trim().length < 20
    || (opening.ownerContribution as string).trim().length > 500
  ) {
    throw new Error('The API returned an invalid opening draft.');
  }
  return {
    id: opening.id as string,
    publicationStatus: opening.publicationStatus as PublicationStatus,
    input: {
      ...identity,
      problem: (opening.summary as string).trim(),
      skills: (opening.skills as string[]).map((skill) => skill.trim()),
      commitment: opening.commitment as string,
      duration: opening.duration as string,
      timezone: (opening.timezone as string).trim(),
      compensation: compensation as string,
      firstMilestone: (opening.firstMilestone as string).trim(),
      ownerContribution: (opening.ownerContribution as string).trim(),
      confidentiality,
    },
  };
}

async function parseError(response: Response): Promise<OpeningDraftAPIError> {
  let body: APIErrorEnvelope = {};
  try {
    body = await response.json() as APIErrorEnvelope;
  } catch {
    // The status remains useful when a proxy or server returns a non-JSON error.
  }
  const code = typeof body.error?.code === 'string' ? body.error.code : 'opening_request_failed';
  const field = typeof body.error?.field === 'string' ? body.error.field as keyof OpeningDraftInput : undefined;
  return new OpeningDraftAPIError(response.status, code, field);
}

async function saveOpeningDraft(method: 'POST' | 'PUT', input: OpeningDraftInput, id?: string) {
  const target = id ? `/v1/openings/${encodeURIComponent(id)}` : '/v1/openings';
  const response = await fetch(`${getAPIBaseURL()}${target}`, {
    body: JSON.stringify(input),
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    method,
  });
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  const draft = parseOwnedOpening(body.data);
  if (draft.publicationStatus !== 'draft') throw new Error('The API returned an invalid opening draft.');
  return draft;
}

export async function listOwnedOpeningDrafts(signal?: AbortSignal): Promise<OwnedOpeningDraft[]> {
  const openings = await listOwnedOpenings(signal);
  return openings.filter((opening): opening is OwnedOpeningDraft => opening.publicationStatus === 'draft');
}

export async function listOwnedOpenings(signal?: AbortSignal): Promise<OwnedOpening[]> {
  const response = await fetch(`${getAPIBaseURL()}/v1/openings/mine`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  if (!Array.isArray(body.data)) throw new Error('The API returned invalid opening drafts.');
  return body.data.map(parseOwnedOpening);
}

export function createOpeningDraft(input: OpeningDraftInput) {
  return saveOpeningDraft('POST', input);
}

export function updateOpeningDraft(id: string, input: OpeningDraftInput) {
  return saveOpeningDraft('PUT', input, id);
}

async function transitionOpening(id: string, transition: 'publish' | 'close'): Promise<OwnedOpening> {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(id)}/${transition}`,
    {
      credentials: 'include',
      headers: { Accept: 'application/json' },
      method: 'POST',
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseOwnedOpening(body.data);
}

export function publishOpening(id: string) {
  return transitionOpening(id, 'publish');
}

export function closeOpening(id: string) {
  return transitionOpening(id, 'close');
}
