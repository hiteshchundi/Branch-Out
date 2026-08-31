import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../data/auth';
import { projects } from '../data/projects';
import {
  TrialAgreementPanel,
  trialAgreementStorageKey,
  type TrialAgreementDraft,
  validateTrialStep,
} from './trial-agreement-panel';

const project = projects[0];
const authenticatedUser: AuthenticatedUser = {
  id: 42,
  githubUserId: 4242,
  githubLogin: 'accepted-builder',
  displayName: 'Accepted Builder',
  avatarUrl: 'https://avatars.githubusercontent.com/u/4242',
  profileUrl: 'https://github.com/accepted-builder',
};
const applicationInput = {
  message: 'I can build the comparison flow and document the decisions.',
  workSampleUrl: 'https://github.com/accepted-builder/comparison',
  workSampleContext: 'A similar evidence-backed interface.',
  availability: '8 hours each week',
  availabilityConfirmed: true,
  proposedContribution: 'Implement and test the regional comparison flow.',
};
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
  beforeEach(() => {
    localStorage.clear();
    vi.unstubAllGlobals();
  });

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

  it('completes all steps without claiming the agreement was accepted', async () => {
    localStorage.setItem(trialAgreementStorageKey(project.id), JSON.stringify(completeDraft));
    render(<TrialAgreementPanel onClose={vi.fn()} project={project} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /complete trial draft/i }));
    const status = await screen.findByRole('status');
    expect(status).toHaveTextContent(/draft ready for mutual review/i);
    expect(status).toHaveTextContent(/has not been sent, accepted/i);
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<TrialAgreementPanel onClose={onClose} project={project} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('loads an accepted applicant private proposal from the account', async () => {
    const serverDraft = { ...completeDraft, outcome: 'Build the accepted account-backed regional comparison experience.' };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: 'application-id', openingId: project.id, input: applicationInput, status: 'accepted',
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: 'proposal-id', applicationId: 'application-id', openingId: project.id,
        input: { ...serverDraft, weeklyHours: 8 }, status: 'draft',
      } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    render(<TrialAgreementPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} project={project} />);

    expect(await screen.findByText(/application was accepted/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/trial outcome/i)).toHaveValue(serverDraft.outcome);
    expect(screen.getByRole('button', { name: /save private proposal/i })).toBeInTheDocument();
  });

  it('saves a complete accepted-applicant proposal privately to the account', async () => {
    localStorage.setItem(trialAgreementStorageKey(project.id), JSON.stringify(completeDraft));
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: 'application-id', openingId: project.id, input: applicationInput, status: 'accepted',
      } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'trial_proposal_not_found' } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: {
        id: 'proposal-id', applicationId: 'application-id', openingId: project.id,
        input: { ...completeDraft, weeklyHours: 8 }, status: 'draft',
      } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    render(<TrialAgreementPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} project={project} />);
    await screen.findByText(/application was accepted/i);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /complete trial draft/i }));

    await waitFor(() => expect(fetcher).toHaveBeenCalledTimes(3));
    expect(fetcher.mock.calls[2][1]).toEqual(expect.objectContaining({ method: 'PUT' }));
    expect(await screen.findByRole('status')).toHaveTextContent(/saved privately to your Branch-Out account/i);
    expect(screen.getByRole('status')).toHaveTextContent(/has not been sent, accepted/i);
  });

  it('keeps a signed-in non-accepted applicant in device preview mode', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: {
      id: 'application-id', openingId: project.id, input: applicationInput, status: 'submitted',
    } }), { status: 200 })));

    render(<TrialAgreementPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} project={project} />);

    expect(await screen.findByText(/account saving unlocks after your application is accepted/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^save draft$/i })).toBeInTheDocument();
  });
});
