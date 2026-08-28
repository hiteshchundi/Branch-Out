import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CreateOpeningPanel,
  OPENING_DRAFT_STORAGE_KEY,
  type OpeningDraft,
  validateOpeningStep,
} from './create-opening-panel';

const completeDraft: OpeningDraft = {
  projectName: 'Climate mapper',
  problem: 'Help local teams understand climate risks with clear regional data.',
  role: 'Frontend engineer',
  skills: 'TypeScript, React',
  commitment: '6–8 hrs/week',
  duration: '5–8 weeks',
  timezone: 'UTC to UTC+4',
  compensation: 'Fixed bounty',
  firstMilestone: 'Build the first interactive region comparison with test coverage.',
  ownerContribution: 'The API, research notes, and working wireframes are already complete.',
  confidentiality: 'Public',
};

describe('validateOpeningStep', () => {
  it('validates only the requested step', () => {
    const errors = validateOpeningStep({ ...completeDraft, projectName: '' }, 0);
    expect(errors.projectName).toMatch(/required/i);
    expect(errors.commitment).toBeUndefined();
  });

  it('requires enough detail for outcome and trial fields', () => {
    expect(validateOpeningStep({ ...completeDraft, problem: 'Too short' }, 0).problem).toMatch(/20 characters/i);
    expect(validateOpeningStep({ ...completeDraft, firstMilestone: 'Tiny' }, 2).firstMilestone).toMatch(/20 characters/i);
  });
});

describe('CreateOpeningPanel', () => {
  beforeEach(() => localStorage.clear());

  it('shows accessible validation errors before advancing', () => {
    render(<CreateOpeningPanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Project name is required.')).toBeInTheDocument();
    expect(screen.getByLabelText(/project name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { name: /what are you building/i })).toBeInTheDocument();
  });

  it('restores and saves a device-local draft', () => {
    localStorage.setItem(OPENING_DRAFT_STORAGE_KEY, JSON.stringify(completeDraft));
    render(<CreateOpeningPanel onClose={vi.fn()} />);

    expect(screen.getByLabelText(/project name/i)).toHaveValue('Climate mapper');
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Climate atlas' } });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    expect(screen.getByText(/draft saved on this device/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(OPENING_DRAFT_STORAGE_KEY) ?? '{}').projectName).toBe('Climate atlas');
  });

  it('completes all three steps and saves the final draft', () => {
    localStorage.setItem(OPENING_DRAFT_STORAGE_KEY, JSON.stringify(completeDraft));
    render(<CreateOpeningPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /what commitment/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /focused and safe/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /complete draft/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Draft ready');
    expect(screen.getByRole('status')).toHaveTextContent('Climate mapper');
    expect(localStorage.getItem(OPENING_DRAFT_STORAGE_KEY)).toContain('Fixed bounty');
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<CreateOpeningPanel onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
