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
  status: 'draft';
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
    || proposal.status !== 'draft'
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
  return {
    id: proposal.id,
    applicationId: proposal.applicationId,
    openingId: proposal.openingId,
    input: input as TrialProposalInput,
    status: 'draft',
  };
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
