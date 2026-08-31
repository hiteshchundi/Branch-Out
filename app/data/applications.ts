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
  status: 'draft' | 'submitted';
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
    || !['draft', 'submitted'].includes(application.status as string)
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
