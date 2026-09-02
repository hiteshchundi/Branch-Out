export type AuthenticatedUser = {
  id: number;
  githubUserId: number;
  githubLogin: string;
  displayName: string | null;
  avatarUrl: string;
  profileUrl: string;
  accountRole: 'member' | 'moderator';
};

type SessionEnvelope = {
  data?: unknown;
};

const defaultAPIBaseURL = 'http://localhost:8080';

/** Returns the public API origin without a trailing slash. */
export function getAPIBaseURL() {
  return (process.env.NEXT_PUBLIC_BRANCH_OUT_API_URL || defaultAPIBaseURL).replace(/\/+$/, '');
}

export function getGitHubLoginURL() {
  return `${getAPIBaseURL()}/v1/auth/github/start`;
}

function isHTTPSURL(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' && Boolean(parsed.host);
  } catch {
    return false;
  }
}

function parseUser(value: unknown): AuthenticatedUser {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid user.');
  const user = value as Record<string, unknown>;
  if (
    !Number.isSafeInteger(user.id)
    || (user.id as number) <= 0
    || !Number.isSafeInteger(user.githubUserId)
    || (user.githubUserId as number) <= 0
    || typeof user.githubLogin !== 'string'
    || !/^[A-Za-z0-9-]{1,39}$/.test(user.githubLogin)
    || (user.displayName !== null && typeof user.displayName !== 'string')
    || !isHTTPSURL(user.avatarUrl)
    || !isHTTPSURL(user.profileUrl)
    || !['member', 'moderator'].includes(user.accountRole as string)
  ) {
    throw new Error('The API returned an invalid user.');
  }
  return user as AuthenticatedUser;
}

export async function loadCurrentUser(signal?: AbortSignal): Promise<AuthenticatedUser | null> {
  const response = await fetch(`${getAPIBaseURL()}/v1/session`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error('The session could not be checked.');
  const body = await response.json() as SessionEnvelope;
  return parseUser(body.data);
}

export async function endCurrentSession(): Promise<void> {
  const response = await fetch(`${getAPIBaseURL()}/v1/session`, {
    credentials: 'include',
    method: 'DELETE',
  });
  if (response.status !== 204) throw new Error('The session could not be ended.');
}
