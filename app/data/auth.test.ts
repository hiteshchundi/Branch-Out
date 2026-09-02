import { afterEach, describe, expect, it, vi } from 'vitest';
import { endCurrentSession, getAPIBaseURL, getGitHubLoginURL, loadCurrentUser } from './auth';

const user = {
  id: 7,
  githubUserId: 42,
  githubLogin: 'branch-builder',
  displayName: 'Branch Builder',
  avatarUrl: 'https://avatars.githubusercontent.com/u/42',
  profileUrl: 'https://github.com/branch-builder',
  accountRole: 'member',
};

afterEach(() => {
  vi.unstubAllGlobals();
  delete process.env.NEXT_PUBLIC_BRANCH_OUT_API_URL;
});

describe('authentication API client', () => {
  it('builds login URLs from the configured public API origin', () => {
    process.env.NEXT_PUBLIC_BRANCH_OUT_API_URL = 'https://api.branch-out.test/';
    expect(getAPIBaseURL()).toBe('https://api.branch-out.test');
    expect(getGitHubLoginURL()).toBe('https://api.branch-out.test/v1/auth/github/start');
  });

  it('loads and validates the authenticated user with cookies', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: user }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    vi.stubGlobal('fetch', fetcher);

    await expect(loadCurrentUser()).resolves.toEqual(user);
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/v1/session', expect.objectContaining({
      credentials: 'include',
      headers: { Accept: 'application/json' },
    }));
  });

  it('treats HTTP 401 as an anonymous session and rejects malformed identities', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(null, { status: 401 })));
    await expect(loadCurrentUser()).resolves.toBeNull();

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({
      data: { ...user, profileUrl: 'javascript:alert(1)' },
    }), { status: 200 })));
    await expect(loadCurrentUser()).rejects.toThrow('invalid user');
  });

  it('ends the current cookie-backed session', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(endCurrentSession()).resolves.toBeUndefined();
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/v1/session', {
      credentials: 'include',
      method: 'DELETE',
    });
  });
});
