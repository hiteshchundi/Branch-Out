import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeExperience } from './home-experience';
import { SAVED_PROJECTS_STORAGE_KEY } from '../data/saved-projects';

describe('HomeExperience', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.removeAttribute('data-theme');
    vi.stubGlobal(
      'matchMedia',
      vi.fn().mockReturnValue({
        matches: false,
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      }),
    );
  });

  it('renders the three main page regions', () => {
    render(<HomeExperience />);

    expect(screen.getByRole('banner')).toBeInTheDocument();
    expect(screen.getByRole('main')).toBeInTheDocument();
    expect(screen.getByRole('contentinfo')).toBeInTheDocument();
  });

  it('filters openings from the header search', () => {
    render(<HomeExperience />);

    fireEvent.change(
      screen.getByRole('searchbox', { name: /search project openings/i }),
      { target: { value: 'accessibility' } },
    );

    expect(screen.getByText('Product designer for an accessible finance app')).toBeInTheDocument();
    expect(screen.queryByText('Frontend engineer for a climate data explorer')).not.toBeInTheDocument();
    expect(screen.getByText('1 opening')).toBeInTheDocument();
  });

  it('combines role and compensation filters and resets them', () => {
    render(<HomeExperience />);

    fireEvent.change(screen.getByRole('combobox', { name: /filter by role/i }), {
      target: { value: 'Design' },
    });
    expect(screen.getByText('2 openings')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('combobox', { name: /filter by compensation/i }), {
      target: { value: 'Paid' },
    });
    expect(screen.getByText('Product designer for an accessible finance app')).toBeInTheDocument();
    expect(screen.getByText('1 opening')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /reset \(2\)/i }));
    expect(screen.getByText('5 openings')).toBeInTheDocument();
  });

  it('shows a useful empty state when no opening matches', () => {
    render(<HomeExperience />);

    fireEvent.change(
      screen.getByRole('searchbox', { name: /search project openings/i }),
      { target: { value: 'underwater archaeology' } },
    );

    expect(screen.getByRole('status')).toHaveTextContent('No openings match');
  });

  it('opens and closes the login panel', () => {
    render(<HomeExperience />);

    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(screen.getByRole('dialog', { name: /log in to branch-out/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close login/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts profile onboarding from the login preview', () => {
    render(<HomeExperience />);

    fireEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    fireEvent.click(screen.getByRole('button', { name: /preview profile setup/i }));

    const onboarding = screen.getByRole('dialog', {
      name: /make your collaboration fit visible/i,
    });
    expect(onboarding).toHaveTextContent('Profile onboarding preview');
    expect(onboarding).toHaveTextContent('Identity');
  });

  it('opens and closes the create-opening flow from the header', () => {
    render(<HomeExperience />);

    fireEvent.click(screen.getByRole('button', { name: /post a project/i }));
    expect(screen.getByRole('dialog', { name: /start with a clear, safe first step/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /close create opening/i }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('opens a complete project detail panel and closes it', () => {
    render(<HomeExperience />);

    fireEvent.click(
      screen.getByRole('button', {
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

  it('starts a proof-led application from project details', () => {
    render(<HomeExperience />);

    fireEvent.click(
      screen.getByRole('button', {
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

  it('saves an opening on this device and filters to the saved list', async () => {
    render(<HomeExperience />);

    const saveButton = screen.getByRole('button', {
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
    fireEvent.click(screen.getByRole('button', {
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
