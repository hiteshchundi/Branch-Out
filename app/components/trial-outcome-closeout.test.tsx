import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrialOutcomeCloseout, validateTrialOutcome } from './trial-outcome-closeout';

const proposalID = '81818181-8181-4181-a181-818181818181';
const input = {
  outcomeStatus: 'completed', deliverableStatus: 'met',
  workSummary: 'Delivered the agreed comparison flow with focused tests and review notes.',
  evidenceUrl: '', closeoutNotes: 'Repository access can be removed after the documented handoff.',
} as const;
const pendingOutcome = {
  id: '92929292-9292-4292-a292-929292929292', proposalId: proposalID, input,
  reviewStatus: 'pending', submittedBy: { displayName: 'Asha Rao' }, submittedByRole: 'applicant',
  submittedByCurrentUser: true, canDecide: false, submittedAt: '2026-09-15T10:00:00Z', decidedAt: null,
} as const;

afterEach(() => vi.unstubAllGlobals());

describe('trial outcome rules', () => {
  it('requires bounded factual fields and a safe optional link', () => {
    expect(validateTrialOutcome({ ...input, outcomeStatus: '' }).outcomeStatus).toMatch(/choose/i);
    expect(validateTrialOutcome({ ...input, workSummary: 'short' }).workSummary).toMatch(/30 to 1000/i);
    expect(validateTrialOutcome({ ...input, evidenceUrl: 'javascript:alert(1)' }).evidenceUrl).toMatch(/http or https/i);
    expect(validateTrialOutcome(input)).toEqual({});
  });
});

describe('TrialOutcomeCloseout', () => {
  it('validates a new closeout before submission', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'trial_outcome_not_found' } }), { status: 404 })));
    render(<TrialOutcomeCloseout proposalId={proposalID} />);
    const submit = await screen.findByRole('button', { name: /submit private outcome/i });
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/understand submitting makes it read-only/i));
    fireEvent.click(submit);
    expect(screen.getByText(/choose how the trial ended/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/trial result/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('submits one read-only private outcome', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: pendingOutcome }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    render(<TrialOutcomeCloseout proposalId={proposalID} />);
    await screen.findByRole('button', { name: /submit private outcome/i });
    fireEvent.change(screen.getByLabelText(/trial result/i), { target: { value: 'completed' } });
    fireEvent.change(screen.getByLabelText(/^deliverable/i), { target: { value: 'met' } });
    fireEvent.change(screen.getByLabelText(/what was delivered/i), { target: { value: input.workSummary } });
    fireEvent.change(screen.getByLabelText(/handoff and remaining work/i), { target: { value: input.closeoutNotes } });
    fireEvent.click(screen.getByLabelText(/understand submitting makes it read-only/i));
    fireEvent.click(screen.getByRole('button', { name: /submit private outcome/i }));
    expect(await screen.findByText(/waiting for the other participant/i)).toBeInTheDocument();
    expect(screen.getByText(/private outcome submitted/i)).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('requires a separate permanent counterpart confirmation', async () => {
    const ownerView = { ...pendingOutcome, submittedByCurrentUser: false, canDecide: true };
    const confirmed = { ...ownerView, reviewStatus: 'confirmed', canDecide: false, decidedAt: '2026-09-15T11:00:00Z' };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: ownerView }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: confirmed }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(<TrialOutcomeCloseout proposalId={proposalID} />);
    const confirm = await screen.findByRole('button', { name: /^confirm outcome$/i });
    fireEvent.click(confirm);
    const finalButton = screen.getAllByRole('button', { name: /^confirm outcome$/i })[1];
    expect(finalButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/understand my confirmation is permanent/i));
    fireEvent.click(finalButton);
    expect(await screen.findByText(/Both participants confirmed/i)).toBeInTheDocument();
    expect(screen.getByText(/No trust signal has been published/i)).toBeInTheDocument();
  });

  it('preserves a disputed closeout without publishing trust', async () => {
    const disputed = { ...pendingOutcome, reviewStatus: 'disputed', submittedByCurrentUser: false, decidedAt: '2026-09-15T11:00:00Z' };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: disputed }), { status: 200 })));
    render(<TrialOutcomeCloseout proposalId={proposalID} />);
    expect(await screen.findByText(/did not agree on this closeout/i)).toBeInTheDocument();
    expect(screen.getByText('Disputed')).toBeInTheDocument();
  });
});
