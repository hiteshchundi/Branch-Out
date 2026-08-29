import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadCurrentProfile, ProfileAPIError, saveCurrentProfile } from './profile';

const profile = {
  userId: 7,
  displayName: 'Asha Rao',
  primaryRole: 'Software developer',
  bio: 'I build accessible data products and enjoy small teams with clear ownership.',
  timezone: 'UTC+5:30',
  weeklyAvailability: '6–8 hrs/week',
  preferredDuration: '5–8 weeks',
  workStyle: 'Async-first',
  communicationCadence: 'Three updates per week',
  skills: ['TypeScript', 'React'],
  githubUrl: 'https://github.com/asha-rao',
  portfolioUrl: 'https://asha.example/work',
  evidenceSummary: 'The linked work shows interfaces and tests I personally delivered.',
  createdAt: '2026-08-29T08:00:00Z',
  updatedAt: '2026-08-29T08:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('profile API client', () => {
  it('loads the current profile with the session cookie', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: profile }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadCurrentProfile()).resolves.toEqual(profile);
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/v1/profile', expect.objectContaining({ credentials: 'include' }));
  });

  it('returns null for a profile that has not been created', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(loadCurrentProfile()).resolves.toBeNull();
  });

  it('saves editable fields without sending GitHub identity', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: profile }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    const input = {
      displayName: profile.displayName,
      primaryRole: profile.primaryRole,
      bio: profile.bio,
      timezone: profile.timezone,
      weeklyAvailability: profile.weeklyAvailability,
      preferredDuration: profile.preferredDuration,
      workStyle: profile.workStyle,
      communicationCadence: profile.communicationCadence,
      skills: profile.skills,
      portfolioUrl: profile.portfolioUrl,
      evidenceSummary: profile.evidenceSummary,
    };
    await expect(saveCurrentProfile(input)).resolves.toEqual(profile);
    const request = fetcher.mock.calls[0][1];
    expect(request.method).toBe('PUT');
    expect(JSON.parse(request.body)).not.toHaveProperty('githubUrl');
  });

  it('preserves HTTP status when a profile request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    await expect(loadCurrentProfile()).rejects.toEqual(expect.objectContaining<Partial<ProfileAPIError>>({ status: 401 }));
  });
});
