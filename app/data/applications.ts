import { getAPIBaseURL } from './auth';

export type ApplicationInput = {
  message: string;
  workSampleUrl: string;
  workSampleContext: string;
  availability: string;
  availabilityConfirmed: boolean;
  proposedContribution: string;
};

export type ManagedApplication = {
  id: string;
  openingId: string;
  input: ApplicationInput;
  status: 'draft' | 'submitted' | 'accepted' | 'declined' | 'withdrawn';
};

export type ApplicantProof = {
  displayName: string;
  primaryRole: string;
  skills: string[];
  githubUrl: string;
  portfolioUrl: string | null;
  evidenceSummary: string;
};

export type OwnerApplication = ManagedApplication & {
  submittedAt: string;
  decidedAt: string | null;
  withdrawnAt: string | null;
  applicant: ApplicantProof;
};

type ApplicationEnvelope = { data?: unknown };
type ApplicationErrorEnvelope = { error?: { code?: unknown; field?: unknown } };

export class ApplicationAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly field?: keyof ApplicationInput,
  ) {
    super(code);
  }
}

function validInput(value: unknown): value is ApplicationInput {
  if (!value || typeof value !== 'object') return false;
  const input = value as Record<string, unknown>;
  return typeof input.message === 'string'
    && typeof input.workSampleUrl === 'string'
    && typeof input.workSampleContext === 'string'
    && typeof input.availability === 'string'
    && typeof input.availabilityConfirmed === 'boolean'
    && typeof input.proposedContribution === 'string';
}

function parseApplication(value: unknown): ManagedApplication {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid application.');
  const application = value as Record<string, unknown>;
  if (
    typeof application.id !== 'string'
    || typeof application.openingId !== 'string'
    || !['draft', 'submitted', 'accepted', 'declined', 'withdrawn'].includes(application.status as string)
    || !validInput(application.input)
  ) {
    throw new Error('The API returned an invalid application.');
  }
  return {
    id: application.id,
    openingId: application.openingId,
    input: application.input,
    status: application.status as ManagedApplication['status'],
  };
}

function parseOwnerApplication(value: unknown): OwnerApplication {
  const application = parseApplication(value);
  const raw = value as Record<string, unknown>;
  const applicant = raw.applicant as Record<string, unknown> | undefined;
  if (
    application.status === 'draft'
    || typeof raw.submittedAt !== 'string'
    || (raw.decidedAt !== null && typeof raw.decidedAt !== 'string')
    || (raw.withdrawnAt !== null && typeof raw.withdrawnAt !== 'string')
    || (application.status === 'submitted' && (raw.decidedAt !== null || raw.withdrawnAt !== null))
    || ((application.status === 'accepted' || application.status === 'declined') && (typeof raw.decidedAt !== 'string' || raw.withdrawnAt !== null))
    || (application.status === 'withdrawn' && (raw.decidedAt !== null || typeof raw.withdrawnAt !== 'string'))
    || !applicant
    || typeof applicant.displayName !== 'string'
    || typeof applicant.primaryRole !== 'string'
    || !Array.isArray(applicant.skills)
    || applicant.skills.some((skill) => typeof skill !== 'string')
    || typeof applicant.githubUrl !== 'string'
    || (applicant.portfolioUrl !== null && typeof applicant.portfolioUrl !== 'string')
    || typeof applicant.evidenceSummary !== 'string'
  ) {
    throw new Error('The API returned an invalid owner application.');
  }
  return {
    ...application,
    submittedAt: raw.submittedAt,
    decidedAt: raw.decidedAt as string | null,
    withdrawnAt: raw.withdrawnAt as string | null,
    applicant: applicant as ApplicantProof,
  };
}

async function parseError(response: Response) {
  let body: ApplicationErrorEnvelope = {};
  try {
    body = await response.json() as ApplicationErrorEnvelope;
  } catch {
    // Keep the response status when an upstream proxy returns non-JSON.
  }
  return new ApplicationAPIError(
    response.status,
    typeof body.error?.code === 'string' ? body.error.code : 'application_request_failed',
    typeof body.error?.field === 'string' ? body.error.field as keyof ApplicationInput : undefined,
  );
}

async function applicationRequest(
  openingId: string,
  options: RequestInit,
): Promise<ManagedApplication> {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(openingId)}/application${options.method === 'POST' ? '/submit' : ''}`,
    {
      credentials: 'include',
      headers: { Accept: 'application/json', ...(options.body ? { 'Content-Type': 'application/json' } : {}) },
      ...options,
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as ApplicationEnvelope;
  return parseApplication(body.data);
}

export async function loadOwnApplication(openingId: string, signal?: AbortSignal) {
  try {
    return await applicationRequest(openingId, { method: 'GET', signal });
  } catch (error) {
    if (error instanceof ApplicationAPIError && error.status === 404) return null;
    throw error;
  }
}

export function saveApplicationDraft(openingId: string, input: ApplicationInput) {
  return applicationRequest(openingId, { method: 'PUT', body: JSON.stringify(input) });
}

export function submitApplication(openingId: string) {
  return applicationRequest(openingId, { method: 'POST' });
}

export async function listSubmittedApplications(openingId: string, signal?: AbortSignal) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(openingId)}/applications`,
    { credentials: 'include', headers: { Accept: 'application/json' }, signal },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as ApplicationEnvelope;
  if (!Array.isArray(body.data)) throw new Error('The API returned invalid owner applications.');
  return body.data.map(parseOwnerApplication);
}

export function decideApplication(
  openingId: string,
  applicationId: string,
  decision: 'accepted' | 'declined',
) {
  return fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(openingId)}/applications/${encodeURIComponent(applicationId)}/decision`,
    {
      body: JSON.stringify({ decision }),
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
    },
  ).then(async (response) => {
    if (!response.ok) throw await parseError(response);
    const body = await response.json() as ApplicationEnvelope;
    const application = parseApplication(body.data);
    const raw = body.data as Record<string, unknown>;
    if (application.status !== decision || typeof raw.decidedAt !== 'string') {
      throw new Error('The API returned an invalid application decision.');
    }
    return { ...application, decidedAt: raw.decidedAt };
  });
}

export function withdrawApplication(openingId: string) {
  return fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(openingId)}/application/withdraw`,
    { credentials: 'include', headers: { Accept: 'application/json' }, method: 'POST' },
  ).then(async (response) => {
    if (!response.ok) throw await parseError(response);
    const body = await response.json() as ApplicationEnvelope;
    const application = parseApplication(body.data);
    const raw = body.data as Record<string, unknown>;
    if (application.status !== 'withdrawn' || typeof raw.withdrawnAt !== 'string') {
      throw new Error('The API returned an invalid application withdrawal.');
    }
    return { ...application, withdrawnAt: raw.withdrawnAt };
  });
}
