import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { projects } from '../data/projects';
import {
  TrialAgreementPanel,
  trialAgreementStorageKey,
  type TrialAgreementDraft,
  validateTrialStep,
} from './trial-agreement-panel';

const project = projects[0];
const completeDraft: TrialAgreementDraft = {
  outcome: 'Build a usable regional comparison flow with documented decisions.',
  deliverable: 'A tested comparison component and a short implementation note.',
  nonGoals: 'No authentication or production data access.',
  startDate: '2026-09-01',
  endDate: '2026-09-15',
  weeklyHours: '8',
  checkInCadence: 'Async update every two days',
  accessLevel: 'Limited repository access',
  confidentiality: 'Synthetic data during trial',
  ipOwnership: 'Open-source contribution under the project license',
  exitPlan: 'Remove repository access and hand over all documented trial work.',
  termsConfirmed: true,
};

describe('validateTrialStep', () => {
  it('validates only the visible step', () => {
    const errors = validateTrialStep({ ...completeDraft, deliverable: '' }, 0);
    expect(errors.deliverable).toMatch(/20 characters/i);
    expect(errors.startDate).toBeUndefined();
  });

  it('requires an approximately two-week date range', () => {
    expect(validateTrialStep({ ...completeDraft, endDate: '2026-09-05' }, 1).endDate).toMatch(/13 and 15/i);
    expect(validateTrialStep({ ...completeDraft, endDate: '2026-08-31' }, 1).endDate).toMatch(/after the start/i);
  });

  it('requires bounded whole-number hours and mutual review confirmation', () => {
    expect(validateTrialStep({ ...completeDraft, weeklyHours: '4.5' }, 1).weeklyHours).toMatch(/whole weekly hours/i);
    expect(validateTrialStep({ ...completeDraft, termsConfirmed: false }, 2).termsConfirmed).toMatch(/both people/i);
  });
});

describe('TrialAgreementPanel', () => {
  beforeEach(() => localStorage.clear());

  it('prefills the opening milestone and reports scope errors accessibly', () => {
    render(<TrialAgreementPanel onClose={vi.fn()} project={project} />);
    expect(screen.getByLabelText(/trial outcome/i)).toHaveValue(project.firstMilestone);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByText(/reviewable deliverable in at least 20/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/reviewable deliverable/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('restores and saves a device-local project draft', () => {
    localStorage.setItem(trialAgreementStorageKey(project.id), JSON.stringify(completeDraft));
    render(<TrialAgreementPanel onClose={vi.fn()} project={project} />);
    expect(screen.getByLabelText(/reviewable deliverable/i)).toHaveValue(completeDraft.deliverable);
    fireEvent.change(screen.getByLabelText(/explicit non-goals/i), { target: { value: 'No production deployment is included.' } });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    expect(screen.getByText(/trial agreement draft saved/i)).toBeInTheDocument();
    expect(localStorage.getItem(trialAgreementStorageKey(project.id))).toContain('No production deployment');
  });

  it('completes all steps without claiming the agreement was accepted', () => {
    localStorage.setItem(trialAgreementStorageKey(project.id), JSON.stringify(completeDraft));
    render(<TrialAgreementPanel onClose={vi.fn()} project={project} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /complete trial draft/i }));
    const status = screen.getByRole('status');
    expect(status).toHaveTextContent(/draft ready for mutual review/i);
    expect(status).toHaveTextContent(/has not been sent, accepted/i);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<TrialAgreementPanel onClose={onClose} project={project} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
