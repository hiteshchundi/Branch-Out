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

export type TrialCheckInInput = {
  kind: 'progress' | 'blocker' | 'milestone';
  update: string;
  evidenceUrl: string;
};

export type TrialCheckIn = TrialCheckInInput & {
  id: string;
  proposalId: string;
  author: { displayName: string };
  authorRole: 'applicant' | 'owner';
  createdAt: string;
};

export type TrialOutcomeInput = {
  outcomeStatus: 'completed' | 'partially_completed' | 'stopped_early';
  deliverableStatus: 'met' | 'partially_met' | 'not_met';
  workSummary: string;
  evidenceUrl: string;
  closeoutNotes: string;
};

export type TrialOutcome = {
  id: string;
  proposalId: string;
  input: TrialOutcomeInput;
  reviewStatus: 'pending' | 'confirmed' | 'disputed';
  submittedBy: { displayName: string };
  submittedByRole: 'applicant' | 'owner';
  submittedByCurrentUser: boolean;
  canDecide: boolean;
  submittedAt: string;
  decidedAt: string | null;
};

export const trialFeedbackBehaviors = [
  'reliable_delivery', 'clear_communication', 'sound_scope_judgment', 'constructive_feedback',
] as const;

export type TrialFeedbackBehavior = typeof trialFeedbackBehaviors[number];

export type TrialFeedbackInput = {
  observedBehaviors: TrialFeedbackBehavior[];
  collaborationExample: string;
  collaborateAgain: 'yes' | 'maybe' | 'no';
  reviewSummary: string;
};

type TrialFeedbackBase = {
  id: string;
  proposalId: string;
  author: { displayName: string };
  authorRole: 'applicant' | 'owner';
  authoredByCurrentUser: boolean;
  canAcknowledge: boolean;
  submittedAt: string;
  acknowledgedAt: string | null;
};

export type TrialFeedback = TrialFeedbackBase & (
  | { moderationStatus: 'visible'; input: TrialFeedbackInput }
  | { moderationStatus: 'removed'; input?: never }
);

export type TrialTrustCandidate = {
  proposalId: string;
  ready: boolean;
  kind: 'not_ready' | 'collaboration_proven' | 'work_demonstrated' | 'no_signal' | 'suppressed';
  title: string;
  explanation: string;
  factors: string[];
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

function parseTrialCheckIn(value: unknown): TrialCheckIn {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid trial check-in.');
  const checkIn = value as Record<string, unknown>;
  const author = checkIn.author as Record<string, unknown> | undefined;
  if (
    typeof checkIn.id !== 'string'
    || typeof checkIn.proposalId !== 'string'
    || !['progress', 'blocker', 'milestone'].includes(checkIn.kind as string)
    || typeof checkIn.update !== 'string'
    || typeof checkIn.evidenceUrl !== 'string'
    || (checkIn.evidenceUrl !== '' && !isHTTPURL(checkIn.evidenceUrl))
    || !author
    || typeof author.displayName !== 'string'
    || !['applicant', 'owner'].includes(checkIn.authorRole as string)
    || typeof checkIn.createdAt !== 'string'
  ) throw new Error('The API returned an invalid trial check-in.');
  return checkIn as TrialCheckIn;
}

function isHTTPURL(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

function parseTrialOutcome(value: unknown): TrialOutcome {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid trial outcome.');
  const outcome = value as Record<string, unknown>;
  const input = outcome.input as Record<string, unknown> | undefined;
  const submittedBy = outcome.submittedBy as Record<string, unknown> | undefined;
  if (
    typeof outcome.id !== 'string'
    || typeof outcome.proposalId !== 'string'
    || !input
    || !['completed', 'partially_completed', 'stopped_early'].includes(input.outcomeStatus as string)
    || !['met', 'partially_met', 'not_met'].includes(input.deliverableStatus as string)
    || typeof input.workSummary !== 'string'
    || typeof input.evidenceUrl !== 'string'
    || (input.evidenceUrl !== '' && !isHTTPURL(input.evidenceUrl))
    || typeof input.closeoutNotes !== 'string'
    || !['pending', 'confirmed', 'disputed'].includes(outcome.reviewStatus as string)
    || !submittedBy
    || typeof submittedBy.displayName !== 'string'
    || !['applicant', 'owner'].includes(outcome.submittedByRole as string)
    || typeof outcome.submittedByCurrentUser !== 'boolean'
    || typeof outcome.canDecide !== 'boolean'
    || typeof outcome.submittedAt !== 'string'
    || (outcome.decidedAt !== null && typeof outcome.decidedAt !== 'string')
  ) throw new Error('The API returned an invalid trial outcome.');
  const reviewStatus = outcome.reviewStatus as TrialOutcome['reviewStatus'];
  if (
    (reviewStatus === 'pending' && outcome.decidedAt !== null)
    || (reviewStatus !== 'pending' && typeof outcome.decidedAt !== 'string')
    || (outcome.submittedByCurrentUser === true && outcome.canDecide === true)
    || (reviewStatus !== 'pending' && outcome.canDecide === true)
  ) throw new Error('The API returned an invalid trial outcome lifecycle.');
  return outcome as TrialOutcome;
}

function parseTrialFeedback(value: unknown): TrialFeedback {
  if (!value || typeof value !== 'object') throw new Error('The API returned invalid private feedback.');
  const feedback = value as Record<string, unknown>;
  const input = feedback.input as Record<string, unknown> | undefined;
  const author = feedback.author as Record<string, unknown> | undefined;
  const behaviors = input?.observedBehaviors;
  if (
    typeof feedback.id !== 'string'
    || typeof feedback.proposalId !== 'string'
    || !author
    || typeof author.displayName !== 'string'
    || !['applicant', 'owner'].includes(feedback.authorRole as string)
    || typeof feedback.authoredByCurrentUser !== 'boolean'
    || typeof feedback.canAcknowledge !== 'boolean'
    || typeof feedback.submittedAt !== 'string'
    || (feedback.acknowledgedAt !== null && typeof feedback.acknowledgedAt !== 'string')
    || !['visible', 'removed'].includes(feedback.moderationStatus as string)
    || (feedback.authoredByCurrentUser === true && feedback.canAcknowledge === true)
    || (feedback.acknowledgedAt !== null && feedback.canAcknowledge === true)
  ) throw new Error('The API returned invalid private feedback.');
  if (feedback.moderationStatus === 'removed') {
    if (input || feedback.canAcknowledge === true) throw new Error('The API returned invalid removed feedback.');
    return feedback as TrialFeedback;
  }
  if (
    !input
    || !Array.isArray(behaviors)
    || behaviors.length < 2
    || behaviors.length > 4
    || new Set(behaviors).size !== behaviors.length
    || behaviors.some((behavior) => !trialFeedbackBehaviors.includes(behavior as TrialFeedbackBehavior))
    || typeof input.collaborationExample !== 'string'
    || !['yes', 'maybe', 'no'].includes(input.collaborateAgain as string)
    || typeof input.reviewSummary !== 'string'
  ) throw new Error('The API returned invalid private feedback.');
  return feedback as TrialFeedback;
}

function parseTrialTrustCandidate(value: unknown): TrialTrustCandidate {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid private trust candidate.');
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.proposalId !== 'string'
    || typeof candidate.ready !== 'boolean'
    || !['not_ready', 'collaboration_proven', 'work_demonstrated', 'no_signal', 'suppressed'].includes(candidate.kind as string)
    || typeof candidate.title !== 'string'
    || typeof candidate.explanation !== 'string'
    || !Array.isArray(candidate.factors)
    || candidate.factors.some((factor) => typeof factor !== 'string')
    || (candidate.ready === false && !['not_ready', 'suppressed'].includes(candidate.kind as string))
    || (candidate.ready === true && ['not_ready', 'suppressed'].includes(candidate.kind as string))
  ) throw new Error('The API returned an invalid private trust candidate.');
  return candidate as TrialTrustCandidate;
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

export async function listTrialCheckIns(proposalId: string, signal?: AbortSignal) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/trial-proposals/${encodeURIComponent(proposalId)}/check-ins`,
    { credentials: 'include', headers: { Accept: 'application/json' }, signal },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  if (!Array.isArray(body.data)) throw new Error('The API returned invalid trial check-ins.');
  return body.data.map(parseTrialCheckIn);
}

export async function addTrialCheckIn(proposalId: string, input: TrialCheckInInput) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/trial-proposals/${encodeURIComponent(proposalId)}/check-ins`,
    {
      body: JSON.stringify(input), credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, method: 'POST',
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialCheckIn(body.data);
}

export async function loadTrialOutcome(proposalId: string, signal?: AbortSignal) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/trial-proposals/${encodeURIComponent(proposalId)}/outcome`,
    { credentials: 'include', headers: { Accept: 'application/json' }, signal },
  );
  if (response.status === 404) return null;
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialOutcome(body.data);
}

export async function createTrialOutcome(proposalId: string, input: TrialOutcomeInput) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/trial-proposals/${encodeURIComponent(proposalId)}/outcome`,
    {
      body: JSON.stringify(input), credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, method: 'POST',
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialOutcome(body.data);
}

export async function decideTrialOutcome(proposalId: string, decision: 'confirmed' | 'disputed') {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/trial-proposals/${encodeURIComponent(proposalId)}/outcome/decision`,
    {
      body: JSON.stringify({ decision }), credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, method: 'POST',
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialOutcome(body.data);
}

export async function loadTrialFeedback(proposalId: string, signal?: AbortSignal) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/trial-proposals/${encodeURIComponent(proposalId)}/feedback`,
    { credentials: 'include', headers: { Accept: 'application/json' }, signal },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  if (!Array.isArray(body.data)) throw new Error('The API returned an invalid private feedback list.');
  return body.data.map(parseTrialFeedback);
}

export async function createTrialFeedback(proposalId: string, input: TrialFeedbackInput) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/trial-proposals/${encodeURIComponent(proposalId)}/feedback`,
    {
      body: JSON.stringify(input), credentials: 'include',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, method: 'POST',
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialFeedback(body.data);
}

export async function acknowledgeTrialFeedback(proposalId: string, feedbackId: string) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/trial-proposals/${encodeURIComponent(proposalId)}/feedback/${encodeURIComponent(feedbackId)}/acknowledge`,
    {
      credentials: 'include', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, method: 'POST',
    },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialFeedback(body.data);
}

export async function loadTrialTrustCandidate(proposalId: string, signal?: AbortSignal) {
  const response = await fetch(
    `${getAPIBaseURL()}/v1/trial-proposals/${encodeURIComponent(proposalId)}/trust-candidate`,
    { credentials: 'include', headers: { Accept: 'application/json' }, signal },
  );
  if (!response.ok) throw await parseError(response);
  const body = await response.json() as APIEnvelope;
  return parseTrialTrustCandidate(body.data);
}
