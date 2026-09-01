import { getAPIBaseURL } from './auth';

export type TrialProposalInput = {
  outcome: string;
  deliverable: string;
  nonGoals: string;
  startDate: string;
  endDate: string;
  weeklyHours: number;
  checkInCadence: string;
  accessLevel: string;
  confidentiality: string;
  ipOwnership: string;
  exitPlan: string;
  termsConfirmed: boolean;
};

export type ManagedTrialProposal = {
  id: string;
  applicationId: string;
  openingId: string;
  input: TrialProposalInput;
  status: 'draft' | 'sent' | 'accepted' | 'declined';
  sentAt: string | null;
  decidedAt: string | null;
};

export type OwnerTrialProposal = ManagedTrialProposal & {
  applicant: { displayName: string; primaryRole: string; githubUrl: string };
};

type APIEnvelope = { data?: unknown };
type APIErrorEnvelope = { error?: { code?: unknown; field?: unknown } };

export class TrialProposalAPIError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    public readonly field?: keyof TrialProposalInput,
  ) {
    super(code);
  }
}

function parseTrialProposal(value: unknown): ManagedTrialProposal {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid trial proposal.');
  const proposal = value as Record<string, unknown>;
  const input = proposal.input as Record<string, unknown> | undefined;
  if (
    typeof proposal.id !== 'string'
    || typeof proposal.applicationId !== 'string'
    || typeof proposal.openingId !== 'string'
    || !['draft', 'sent', 'accepted', 'declined'].includes(proposal.status as string)
    || (proposal.sentAt !== null && typeof proposal.sentAt !== 'string')
    || (proposal.decidedAt !== null && typeof proposal.decidedAt !== 'string')
    || !input
    || typeof input.outcome !== 'string'
    || typeof input.deliverable !== 'string'
    || typeof input.nonGoals !== 'string'
    || typeof input.startDate !== 'string'
    || typeof input.endDate !== 'string'
    || typeof input.weeklyHours !== 'number'
    || typeof input.checkInCadence !== 'string'
    || typeof input.accessLevel !== 'string'
    || typeof input.confidentiality !== 'string'
    || typeof input.ipOwnership !== 'string'
    || typeof input.exitPlan !== 'string'
    || typeof input.termsConfirmed !== 'boolean'
  ) {
    throw new Error('The API returned an invalid trial proposal.');
  }
  const status = proposal.status as ManagedTrialProposal['status'];
  if (
    (status === 'draft' && (proposal.sentAt !== null || proposal.decidedAt !== null))
    || (status === 'sent' && (typeof proposal.sentAt !== 'string' || proposal.decidedAt !== null))
    || ((status === 'accepted' || status === 'declined') && (typeof proposal.sentAt !== 'string' || typeof proposal.decidedAt !== 'string'))
  ) throw new Error('The API returned an invalid trial proposal lifecycle.');
  return {
    id: proposal.id,
    applicationId: proposal.applicationId,
    openingId: proposal.openingId,
    input: input as TrialProposalInput,
    status,
    sentAt: proposal.sentAt,
    decidedAt: proposal.decidedAt,
  };
}

function parseOwnerTrialProposal(value: unknown): OwnerTrialProposal {
  const proposal = parseTrialProposal(value);
  const raw = value as Record<string, unknown>;
  const applicant = raw.applicant as Record<string, unknown> | undefined;
  if (
    proposal.status === 'draft'
    || !applicant
    || typeof applicant.displayName !== 'string'
    || typeof applicant.primaryRole !== 'string'
    || typeof applicant.githubUrl !== 'string'
  ) throw new Error('The API returned an invalid owner trial proposal.');
  return { ...proposal, applicant: applicant as OwnerTrialProposal['applicant'] };
}

async function parseError(response: Response) {
  let body: APIErrorEnvelope = {};
  try {
    body = await response.json() as APIErrorEnvelope;
  } catch {
    // Preserve the status when an upstream returns non-JSON.
  }
  return new TrialProposalAPIError(
    response.status,
    typeof body.error?.code === 'string' ? body.error.code : 'trial_proposal_request_failed',
    typeof body.error?.field === 'string' ? body.error.field as keyof TrialProposalInput : undefined,
  );
}

export async function loadOwnTrialProposal(openingId: string, signal?: AbortSignal) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(openingId)}/trial-proposal`,
    { credentials: 'include', headers: { Accept: 'application/json' }, signal },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialProposal(body.data);
}

export async function saveOwnTrialProposal(openingId: string, input: TrialProposalInput) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(openingId)}/trial-proposal`,
    {
      body: JSON.stringify(input),
      credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
      method: 'PUT',
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialProposal(body.data);
}

export async function sendOwnTrialProposal(openingId: string) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(openingId)}/trial-proposal/send`,
    { credentials: 'include', headers: { Accept: 'application/json' }, method: 'POST' },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialProposal(body.data);
}

export async function listTrialProposalsForOwner(openingId: string, signal?: AbortSignal) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(openingId)}/trial-proposals`,
    { credentials: 'include', headers: { Accept: 'application/json' }, signal },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  if (!Array.isArray(body.data)) throw new Error('The API returned invalid owner trial proposals.');
  return body.data.map(parseOwnerTrialProposal);
}

export async function decideTrialProposal(
  openingId: string,
  proposalId: string,
  decision: 'accepted' | 'declined',
) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/openings/${encodeURIComponent(openingId)}/trial-proposals/${encodeURIComponent(proposalId)}/decision`,
    {
      body: JSON.stringify({ decision }), credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, method: 'POST',
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialProposal(body.data);
}
