import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { projects } from '../data/projects';
import { SavedProjectComparisonPanel } from './saved-project-comparison-panel';

describe('SavedProjectComparisonPanel', () => {
  it('compares concrete facts for up to three saved openings', () => {
    render(
      <SavedProjectComparisonPanel
        onClose={vi.fn()}
        onViewProject={vi.fn()}
        savedProjects={projects.slice(0, 4)}
      />,
    );

    const comparison = screen.getByRole('region', {
      name: /comparison of 3 saved openings/i,
    });
    expect(within(comparison).getAllByText('Two-week trial')).toHaveLength(3);
    expect(within(comparison).getByText('Maya Chen · Collaboration Proven · 3 projects')).toBeInTheDocument();
    expect(within(comparison).queryByText(projects[3].title)).not.toBeInTheDocument();
  });

  it('lets people choose a different opening after freeing a comparison slot', () => {
    render(
      <SavedProjectComparisonPanel
        onClose={vi.fn()}
        onViewProject={vi.fn()}
        savedProjects={projects.slice(0, 4)}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: projects[0].title }));
    fireEvent.click(screen.getByRole('checkbox', { name: projects[3].title }));

    const comparison = screen.getByRole('region', {
      name: /comparison of 3 saved openings/i,
    });
    expect(within(comparison).getByText(projects[3].title)).toBeInTheDocument();
    expect(within(comparison).queryByText(projects[0].title)).not.toBeInTheDocument();
  });

  it('shows guidance when fewer than two openings are selected', () => {
    render(
      <SavedProjectComparisonPanel
        onClose={vi.fn()}
        onViewProject={vi.fn()}
        savedProjects={projects.slice(0, 2)}
      />,
    );

    fireEvent.click(screen.getByRole('checkbox', { name: projects[0].title }));
    expect(screen.getByRole('status')).toHaveTextContent(/select at least two/i);
  });

  it('opens a selected project and closes with Escape', () => {
    const onClose = vi.fn();
    const onViewProject = vi.fn();
    render(
      <SavedProjectComparisonPanel
        onClose={onClose}
        onViewProject={onViewProject}
        savedProjects={projects.slice(0, 2)}
      />,
    );

    const firstCard = screen.getByRole('heading', { name: projects[0].title }).closest('article');
    expect(firstCard).not.toBeNull();
    fireEvent.click(within(firstCard!).getByRole('button', { name: /view this opening/i }));
    expect(onViewProject).toHaveBeenCalledWith(projects[0]);

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
