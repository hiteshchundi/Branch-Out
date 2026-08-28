import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HomeExperience } from './home-experience';

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
