import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeExperience } from './home-experience';
import { SAVED_PROJECTS_STORAGE_KEY } from '../data/saved-projects';
import {
  defaultProjectFilters,
  filterProjects,
  projects,
  type ProjectFilters,
} from '../data/projects';

function defaultAPIFetch(input: string | URL | Request, init?: RequestInit) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (url.pathname === '/v1/session') return Promise.resolve(new Response(null, { status: 401 }));
  if (url.pathname === '/v1/openings' && (!init?.method || init.method === 'GET')) {
    const filters: ProjectFilters = {
      query: url.searchParams.get('query') ?? '',
      role: (url.searchParams.get('role') ?? defaultProjectFilters.role) as ProjectFilters['role'],
      compensation: (url.searchParams.get('compensation') ?? defaultProjectFilters.compensation) as ProjectFilters['compensation'],
      commitment: (url.searchParams.get('commitment') ?? defaultProjectFilters.commitment) as ProjectFilters['commitment'],
    };
    const data = filterProjects(projects, filters);
    return Promise.resolve(new Response(JSON.stringify({ data, meta: { count: data.length } }), { status: 200 }));
  }
  return new Promise<Response>(() => {});
}

describe('HomeExperience', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, '', '/');
    document.documentElement.removeAttribute('data-theme');
    vi.stubGlobal('fetch', vi.fn(defaultAPIFetch));
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders the three main page regions', async () => {
    render(<HomeExperience />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /skip to main content/i })).toHaveAttribute('href', '#main-content');
    expect(screen.getAllByRole('link', { name: /branch-out home/i })).toHaveLength(2);
    expect(await screen.findByText('5 openings')).toBeInTheDocument();
  });

  it('filters openings from the header search through the live API', async () => {
    render(<HomeExperience />);
    const fetcher = vi.mocked(fetch);

    fireEvent.change(
      screen.getByRole('searchbox', { name: /search project openings/i }),
      { target: { value: 'accessibility' } },
    );

    expect(await screen.findByText('Product designer for an accessible finance app')).toBeInTheDocument();
    expect(screen.queryByText('Frontend engineer for a climate data explorer')).not.toBeInTheDocument();
    expect(screen.getByText('1 opening')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8080/v1/openings?query=accessibility',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('shows a retryable error instead of sample data when discovery is unavailable', async () => {
    let discoveryAttempts = 0;
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === '/v1/openings') {
        discoveryAttempts += 1;
        return discoveryAttempts === 1
          ? Promise.reject(new TypeError('network unavailable'))
          : defaultAPIFetch(input, init);
      }
      return defaultAPIFetch(input, init);
    }));
    render(<HomeExperience />);

    const error = await screen.findByRole('alert');
    expect(error).toHaveTextContent(/could not be loaded/i);
    expect(screen.getByText('Openings unavailable')).toBeInTheDocument();
    expect(screen.queryByText('Frontend engineer for a climate data explorer')).not.toBeInTheDocument();
    fireEvent.click(within(error).getByRole('button', { name: /retry loading openings/i }));
    expect(await screen.findByText('Frontend engineer for a climate data explorer')).toBeInTheDocument();
    expect(discoveryAttempts).toBe(2);
  });

  it('keeps and labels the last successful catalogue when a refresh fails', async () => {
    let discoveryAttempts = 0;
    vi.stubGlobal('fetch', vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === '/v1/openings') {
        discoveryAttempts += 1;
        if (discoveryAttempts > 1) return Promise.reject(new TypeError('network unavailable'));
      }
      return defaultAPIFetch(input, init);
    }));
    render(<HomeExperience />);
    await screen.findByText('5 openings');

    fireEvent.change(screen.getByRole('searchbox', { name: /search project openings/i }), {
      target: { value: 'React' },
    });

    expect(await screen.findByText(/showing the last successful results/i)).toBeInTheDocument();
    expect(screen.getByText('Frontend engineer for a climate data explorer')).toBeInTheDocument();
  });

  it('combines role and compensation filters and resets them', async () => {
    render(<HomeExperience />);

    await screen.findByText('5 openings');

    fireEvent.change(screen.getByRole('combobox', { name: /filter by role/i }), {
      target: { value: 'Design' },
    });
    expect(await screen.findByText('2 openings')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /filter by compensation/i }), {
      target: { value: 'Paid' },
    });
    expect(await screen.findByText('Product designer for an accessible finance app')).toBeInTheDocument();
    expect(await screen.findByText('1 opening')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset \(2\)/i }));
    expect(await screen.findByText('5 openings')).toBeInTheDocument();
  });

  it('shows a useful empty state when no opening matches', async () => {
    render(<HomeExperience />);

    fireEvent.change(
      screen.getByRole('searchbox', { name: /search project openings/i }),
      { target: { value: 'underwater archaeology' } },
    );

    expect(await screen.findByText('No openings match the current filters')).toBeInTheDocument();
  });

  it('opens and closes the login panel', async () => {
    render(<HomeExperience />);

    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(screen.getByRole('dialog', { name: /log in to branch-out/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close login/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^log in$/i })).toHaveFocus();
    });
  });

  it('offers the real backend GitHub sign-in route', async () => {
    render(<HomeExperience />);
    await screen.findByText('5 openings');

    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(screen.getByRole('link', { name: /continue with github/i })).toHaveAttribute(
      'href',
      'http://localhost:8080/v1/auth/github/start',
    );
  });

  it('shows the authenticated GitHub member and logs out', async () => {
    const authenticatedUser = {
      id: 7,
      githubUserId: 42,
      githubLogin: 'branch-builder',
      displayName: 'Branch Builder',
      avatarUrl: 'https://avatars.githubusercontent.com/u/42',
      profileUrl: 'https://github.com/branch-builder',
    };
    const fetcher = vi.fn((input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
      if (url.pathname === '/v1/session' && init?.method === 'DELETE') {
        return Promise.resolve(new Response(null, { status: 204 }));
      }
      if (url.pathname === '/v1/session') {
        return Promise.resolve(new Response(JSON.stringify({ data: authenticatedUser }), { status: 200 }));
      }
      return defaultAPIFetch(input, init);
    });
    vi.stubGlobal('fetch', fetcher);
    render(<HomeExperience />);

    const accountButton = await screen.findByRole('button', { name: 'Branch Builder' });
    fireEvent.click(accountButton);
    const account = screen.getByRole('dialog', { name: /your branch-out account/i });
    expect(account).toHaveTextContent('@branch-builder');
    expect(within(account).getByRole('link', { name: /view github profile/i })).toHaveAttribute(
      'href',
      'https://github.com/branch-builder',
    );

    fireEvent.click(within(account).getByRole('button', { name: /^log out$/i }));
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /^log in$/i })).toBeInTheDocument();
    });
    expect(screen.getByRole('status')).toHaveTextContent('You have been logged out.');
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/v1/session', {
      credentials: 'include',
      method: 'DELETE',
    });
  });

  it('reports and removes the OAuth callback result from the address', async () => {
    window.history.replaceState({}, '', '/?auth=denied');
    render(<HomeExperience />);

    expect(await screen.findByText('GitHub sign-in was cancelled.')).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });

  it('explains when the session API cannot be reached', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('network unavailable')));
    render(<HomeExperience />);

    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText(/api could not be reached/i)).toBeInTheDocument();
  });

  it('starts profile onboarding from the login preview', async () => {
    render(<HomeExperience />);
    await screen.findByText('5 openings');

    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview profile setup/i }));

    const onboarding = screen.getByRole('dialog', {
      name: /make your collaboration fit visible/i,
    });
    expect(onboarding).toHaveTextContent('Profile onboarding preview');
    expect(onboarding).toHaveTextContent('Identity');
  });

  it('opens and closes the create-opening flow from the header', async () => {
    render(<HomeExperience />);
    await screen.findByText('5 openings');

    fireEvent.click(screen.getByRole('button', { name: /post a project/i }));
    expect(screen.getByRole('dialog', { name: /start with a clear, safe first step/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close create opening/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a complete project detail panel and closes it', async () => {
    render(<HomeExperience />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: /view details for frontend engineer for a climate data explorer/i,
      }),
    );

    const detailPanel = screen.getByRole('dialog', {
      name: /frontend engineer for a climate data explorer/i,
    });
    expect(detailPanel).toHaveTextContent('Two-week trial milestone');
    expect(detailPanel).toHaveTextContent('Maya Chen');
    expect(detailPanel).toHaveTextContent('limited repository access');

    fireEvent.click(screen.getByRole('button', { name: /close project details/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts a proof-led application from project details', async () => {
    render(<HomeExperience />);

    fireEvent.click(
      await screen.findByRole('button', {
        name: /view details for frontend engineer for a climate data explorer/i,
      }),
    );
    fireEvent.click(screen.getByRole('button', { name: /apply with proof/i }));

    const application = screen.getByRole('dialog', {
      name: /show why this specific project fits/i,
    });
    expect(application).toHaveTextContent('Frontend engineer for a climate data explorer');
    expect(application).toHaveTextContent('One relevant work sample');
  });

  it('starts a two-week trial agreement from project details', async () => {
    render(<HomeExperience />);
    fireEvent.click(await screen.findByRole('button', {
      name: /view details for frontend engineer for a climate data explorer/i,
    }));
    fireEvent.click(screen.getByRole('button', { name: /plan this trial/i }));

    const trial = screen.getByRole('dialog', {
      name: /agree on the small bet before the big commitment/i,
    });
    expect(trial).toHaveTextContent('Two-week trial draft');
    expect(trial).toHaveTextContent('Scope');
    expect(trial).toHaveTextContent('Frontend engineer for a climate data explorer');
  });

  it('starts a post-trial outcome review from project details', async () => {
    render(<HomeExperience />);
    fireEvent.click(await screen.findByRole('button', { name: /view details for frontend engineer for a climate data explorer/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview outcome review/i }));
    const review = screen.getByRole('dialog', { name: /turn observed work into explainable trust/i });
    expect(review).toHaveTextContent('Post-trial outcome review');
    expect(review).toHaveTextContent('Outcome');
    expect(review).toHaveTextContent('Frontend engineer for a climate data explorer');
  });

  it('saves an opening on this device and filters to the saved list', async () => {
    render(<HomeExperience />);

    const saveButton = await screen.findByRole('button', {
      name: /save frontend engineer for a climate data explorer/i,
    });
    fireEvent.click(saveButton);

    await waitFor(() => {
      expect(localStorage.getItem(SAVED_PROJECTS_STORAGE_KEY)).toBe(
        JSON.stringify(['climate-data-explorer']),
      );
    });
    expect(saveButton).toHaveAccessibleName(
      /remove saved frontend engineer for a climate data explorer/i,
    );

    fireEvent.click(screen.getByRole('button', { name: /saved only 1/i }));
    expect(screen.getByText('1 opening')).toBeInTheDocument();
    expect(screen.queryByText('Product designer for an accessible finance app')).not.toBeInTheDocument();
  });

  it('recovers saved openings and can remove one from project details', async () => {
    localStorage.setItem(
      SAVED_PROJECTS_STORAGE_KEY,
      JSON.stringify(['accessible-finance', 'stale-project']),
    );
    render(<HomeExperience />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /saved only 1/i })).toBeInTheDocument();
    });
    fireEvent.click(await screen.findByRole('button', {
      name: /view details for product designer for an accessible finance app/i,
    }));
    const detailPanel = screen.getByRole('dialog', {
      name: /product designer for an accessible finance app/i,
    });
    fireEvent.click(
      within(detailPanel).getByRole('button', { name: /^remove saved$/i }),
    );

    await waitFor(() => {
      expect(localStorage.getItem(SAVED_PROJECTS_STORAGE_KEY)).toBe('[]');
    });
  });

  it('opens a comparison when at least two projects are saved', async () => {
    localStorage.setItem(
      SAVED_PROJECTS_STORAGE_KEY,
      JSON.stringify(['climate-data-explorer', 'accessible-finance']),
    );
    render(<HomeExperience />);

    const compareButton = await screen.findByRole('button', { name: /compare saved/i });
    await waitFor(() => expect(compareButton).toBeEnabled());
    fireEvent.click(compareButton);

    const comparison = screen.getByRole('dialog', {
      name: /compare the work, not just the title/i,
    });
    expect(comparison).toHaveTextContent('Frontend engineer for a climate data explorer');
    expect(comparison).toHaveTextContent('Product designer for an accessible finance app');
    expect(comparison).toHaveTextContent('Two-week trial');
  });

  it('toggles and persists the color theme', async () => {
    render(<HomeExperience />);

    const toggle = screen.getByRole('button', { name: /switch to dark mode/i });
    fireEvent.click(toggle);

    await waitFor(() => {
      expect(document.documentElement).toHaveAttribute('data-theme', 'dark');
    });
    expect(localStorage.getItem('branch-out-theme')).toBe('dark');
    expect(toggle).toHaveAccessibleName(/switch to light mode/i);
  });
});
