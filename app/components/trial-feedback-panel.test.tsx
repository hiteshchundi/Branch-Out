import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TrialFeedbackPanel, validateTrialFeedback } from './trial-feedback-panel';

const proposalID = '81818181-8181-4181-a181-818181818181';
const input = {
  observedBehaviors: ['reliable_delivery', 'clear_communication'] as const,
  collaborationExample: 'They surfaced a blocker early and delivered the revised milestone on the agreed date.',
  collaborateAgain: 'yes' as const,
  reviewSummary: 'A dependable collaborator who communicated tradeoffs clearly throughout the bounded trial.',
};
const feedback = {
  id: '93939393-9393-4393-a393-939393939393', proposalId: proposalID, input,
  author: { displayName: 'Asha Rao' }, authorRole: 'applicant', authoredByCurrentUser: true,
  canAcknowledge: false, submittedAt: '2026-09-15T12:00:00Z', acknowledgedAt: null,
} as const;

afterEach(() => vi.unstubAllGlobals());

describe('private trial feedback rules', () => {
  it('requires evidence-backed bounded feedback', () => {
    expect(validateTrialFeedback({ ...input, observedBehaviors: ['reliable_delivery'] }).observedBehaviors).toMatch(/at least two/i);
    expect(validateTrialFeedback({ ...input, collaborationExample: 'too short' }).collaborationExample).toMatch(/30 to 1000/i);
    expect(validateTrialFeedback(input)).toEqual({});
  });
});

describe('TrialFeedbackPanel', () => {
  it('submits one immutable private review', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: feedback }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    render(<TrialFeedbackPanel proposalId={proposalID} />);
    await screen.findByRole('button', { name: /submit private feedback/i });
    fireEvent.click(screen.getByLabelText('Reliable delivery'));
    fireEvent.click(screen.getByLabelText('Clear communication'));
    fireEvent.change(screen.getByLabelText(/one concrete example/i), { target: { value: input.collaborationExample } });
    fireEvent.change(screen.getByLabelText(/would you collaborate again/i), { target: { value: 'yes' } });
    fireEvent.change(screen.getByLabelText(/private review summary/i), { target: { value: input.reviewSummary } });
    fireEvent.click(screen.getByLabelText(/becomes read-only/i));
    fireEvent.click(screen.getByRole('button', { name: /submit private feedback/i }));
    expect(await screen.findByText(/read-only feedback was submitted/i)).toBeInTheDocument();
    expect(screen.getByText(/awaiting acknowledgement/i)).toBeInTheDocument();
    expect(fetcher).toHaveBeenLastCalledWith(
      `http://localhost:8080/v1/trial-proposals/${proposalID}/feedback`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input) }),
    );
  });

  it('requires a separate acknowledgement and does not imply agreement', async () => {
    const counterpartView = { ...feedback, authoredByCurrentUser: false, canAcknowledge: true };
    const acknowledged = { ...counterpartView, canAcknowledge: false, acknowledgedAt: '2026-09-15T13:00:00Z' };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [counterpartView] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: acknowledged }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(<TrialFeedbackPanel proposalId={proposalID} />);
    const acknowledge = await screen.findByRole('button', { name: /acknowledge receipt/i });
    fireEvent.click(acknowledge);
    fireEvent.click(screen.getByRole('button', { name: /confirm acknowledgement/i }));
    expect(await screen.findByText(/content was not approved or changed/i)).toBeInTheDocument();
    expect(screen.getByText('Acknowledged')).toBeInTheDocument();
  });
});
