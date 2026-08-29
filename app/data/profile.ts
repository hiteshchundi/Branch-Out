import { getAPIBaseURL } from './auth';

export type CollaborationProfile = {
  userId: number;
  displayName: string;
  primaryRole: string;
  bio: string;
  timezone: string;
  weeklyAvailability: string;
  preferredDuration: string;
  workStyle: string;
  communicationCadence: string;
  skills: string[];
  githubUrl: string;
  portfolioUrl: string | null;
  evidenceSummary: string;
  createdAt: string;
  updatedAt: string;
};

export type CollaborationProfileInput = Omit<
  CollaborationProfile,
  'userId' | 'githubUrl' | 'createdAt' | 'updatedAt'
>;

type ProfileEnvelope = { data?: unknown };

export class ProfileAPIError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function isHTTPURL(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return (parsed.protocol === 'http:' || parsed.protocol === 'https:') && Boolean(parsed.host);
  } catch {
    return false;
  }
}

function isGitHubProfileURL(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:'
      && (parsed.hostname === 'github.com' || parsed.hostname === 'www.github.com')
      && parsed.pathname.split('/').filter(Boolean).length >= 1;
  } catch {
    return false;
  }
}

function parseProfile(value: unknown): CollaborationProfile {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid profile.');
  const profile = value as Record<string, unknown>;
  const requiredStrings = [
    'displayName', 'primaryRole', 'bio', 'timezone', 'weeklyAvailability',
    'preferredDuration', 'workStyle', 'communicationCadence', 'evidenceSummary',
    'createdAt', 'updatedAt',
  ];
  if (
    !Number.isSafeInteger(profile.userId)
    || (profile.userId as number) <= 0
    || requiredStrings.some((field) => typeof profile[field] !== 'string' || !(profile[field] as string).trim())
    || !Array.isArray(profile.skills)
    || profile.skills.length < 1
    || profile.skills.length > 10
    || profile.skills.some((skill) => typeof skill !== 'string' || !skill.trim() || skill.length > 40)
    || new Set(profile.skills.map((skill) => (skill as string).toLowerCase())).size !== profile.skills.length
    || !isGitHubProfileURL(profile.githubUrl)
    || (profile.portfolioUrl !== null && !isHTTPURL(profile.portfolioUrl))
  ) {
    throw new Error('The API returned an invalid profile.');
  }
  return profile as CollaborationProfile;
}

async function parseResponse(response: Response): Promise<CollaborationProfile> {
  if (!response.ok) throw new ProfileAPIError(response.status, 'The profile request failed.');
  const envelope = await response.json() as ProfileEnvelope;
  return parseProfile(envelope.data);
}

export async function loadCurrentProfile(signal?: AbortSignal): Promise<CollaborationProfile | null> {
  const response = await fetch(`${getAPIBaseURL()}/v1/profile`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal,
  });
  if (response.status === 404) return null;
  return parseResponse(response);
}

export async function saveCurrentProfile(input: CollaborationProfileInput): Promise<CollaborationProfile> {
  const response = await fetch(`${getAPIBaseURL()}/v1/profile`, {
    body: JSON.stringify(input),
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    method: 'PUT',
  });
  return parseResponse(response);
}
