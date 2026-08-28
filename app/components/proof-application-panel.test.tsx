import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projects } from '../data/projects';
import {
  applicationDraftStorageKey,
  type ApplicationDraft,
  ProofApplicationPanel,
  validateApplicationDraft,
} from './proof-application-panel';

const project = projects[0];
const completeDraft: ApplicationDraft = {
  message: 'I have built public climate dashboards and enjoy making complex data understandable.',
  workSampleUrl: 'https://github.com/example/climate-dashboard',
  workSampleContext: 'I designed and implemented the interactive comparison view.',
  availability: '7 hours each week, starting next Monday',
  availabilityConfirmed: true,
  proposedContribution: 'I can audit the current data flow and prototype the region selector.',
};

describe('validateApplicationDraft', () => {
  it('accepts a complete proof-led application', () => {
    expect(validateApplicationDraft(completeDraft)).toEqual({});
  });

  it('rejects weak evidence and unsafe URLs', () => {
    const errors = validateApplicationDraft({
      ...completeDraft,
      workSampleUrl: 'javascript:alert(1)',
      proposedContribution: 'Anything',
      availabilityConfirmed: false,
    });
    expect(errors.workSampleUrl).toMatch(/http or https/i);
    expect(errors.proposedContribution).toMatch(/20 characters/i);
    expect(errors.availabilityConfirmed).toMatch(/confirm/i);
  });
});

describe('ProofApplicationPanel', () => {
  beforeEach(() => localStorage.clear());

  it('shows validation errors without completing an empty draft', () => {
    render(<ProofApplicationPanel project={project} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /complete application draft/i }));
    expect(screen.getByText(/note should be at least 30 characters/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/short note/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/application ready/i)).not.toBeInTheDocument();
  });

  it('restores and updates a project-specific draft', () => {
    localStorage.setItem(applicationDraftStorageKey(project.id), JSON.stringify(completeDraft));
    render(<ProofApplicationPanel project={project} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/short note/i)).toHaveValue(completeDraft.message);

    fireEvent.change(screen.getByLabelText(/availability for this project/i), {
      target: { value: '8 hours each week' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    expect(screen.getByText(/application draft saved/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(applicationDraftStorageKey(project.id)) ?? '{}').availability).toBe('8 hours each week');
  });

  it('completes a valid application without claiming it was sent', () => {
    localStorage.setItem(applicationDraftStorageKey(project.id), JSON.stringify(completeDraft));
    render(<ProofApplicationPanel project={project} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /complete application draft/i }));

    const completion = screen.getByRole('status');
    expect(completion).toHaveTextContent('Application ready');
    expect(completion).toHaveTextContent('has not been sent');
    expect(completion).toHaveTextContent(completeDraft.proposedContribution);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<ProofApplicationPanel project={project} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
