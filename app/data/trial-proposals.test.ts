import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadOwnTrialProposal,
  listTrialProposalsForOwner,
  saveOwnTrialProposal,
  sendOwnTrialProposal,
  decideTrialProposal,
  addTrialCheckIn,
  listTrialCheckIns,
  createTrialOutcome,
  decideTrialOutcome,
  loadTrialOutcome,
  acknowledgeTrialFeedback,
  createTrialFeedback,
  loadTrialFeedback,
  loadTrialTrustCandidate,
  TrialProposalAPIError,
  type TrialProposalInput,
} from './trial-proposals';

const input: TrialProposalInput = {
  outcome: 'Build a usable regional comparison flow with documented decisions.',
  deliverable: 'A tested comparison component and a short implementation note.',
  nonGoals: 'No authentication or production data access.',
  startDate: '2026-09-01', endDate: '2026-09-15', weeklyHours: 8,
  checkInCadence: 'Async update every two days', accessLevel: 'Limited repository access',
  confidentiality: 'Synthetic data during trial',
  ipOwnership: 'Open-source contribution under the project license',
  exitPlan: 'Remove repository access and hand over all documented trial work.', termsConfirmed: true,
};

const proposal = {
  id: '81818181-8181-4181-a181-818181818181',
  applicationId: '71717171-7171-4171-a171-717171717171',
  openingId: 'climate-data-explorer', input, status: 'draft', sentAt: null, decidedAt: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('trial proposal API client', () => {
  it('loads the accepted applicant private draft with credentials', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: proposal }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadOwnTrialProposal(proposal.openingId)).resolves.toEqual(proposal);
    expect(fetcher).toHaveBeenCalledWith(
      `http://localhost:8080/v1/openings/${proposal.openingId}/trial-proposal`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('treats a missing proposal as a new accepted-applicant draft', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'trial_proposal_not_found' } }), { status: 404 })));
    await expect(loadOwnTrialProposal(proposal.openingId)).resolves.toBeNull();
  });

  it('saves a complete private trial proposal', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: proposal }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(saveOwnTrialProposal(proposal.openingId, input)).resolves.toEqual(proposal);
    expect(fetcher).toHaveBeenCalledWith(
      `http://localhost:8080/v1/openings/${proposal.openingId}/trial-proposal`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify(input) }),
    );
  });

  it('preserves accepted-application eligibility errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'trial_proposal_unavailable', field: 'outcome' },
    }), { status: 409 })));
    await expect(saveOwnTrialProposal(proposal.openingId, input)).rejects.toEqual(
      new TrialProposalAPIError(409, 'trial_proposal_unavailable', 'outcome'),
    );
  });

  it('sends the applicant proposal for owner review', async () => {
    const sent = { ...proposal, status: 'sent', sentAt: '2026-09-01T10:00:00Z' };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: sent }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(sendOwnTrialProposal(proposal.openingId)).resolves.toEqual(sent);
    expect(fetcher).toHaveBeenCalledWith(
      `http://localhost:8080/v1/openings/${proposal.openingId}/trial-proposal/send`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('lists owner-visible sent proposals and records a decision', async () => {
    const ownerProposal = {
      ...proposal, status: 'sent', sentAt: '2026-09-01T10:00:00Z',
      applicant: { displayName: 'Asha Rao', primaryRole: 'Software developer', githubUrl: 'https://github.com/asha' },
    };
    const accepted = { ...proposal, status: 'accepted', sentAt: ownerProposal.sentAt, decidedAt: '2026-09-01T11:00:00Z' };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [ownerProposal] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: accepted }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(listTrialProposalsForOwner(proposal.openingId)).resolves.toEqual([ownerProposal]);
    await expect(decideTrialProposal(proposal.openingId, proposal.id, 'accepted')).resolves.toEqual(accepted);
    expect(fetcher).toHaveBeenLastCalledWith(
      `http://localhost:8080/v1/openings/${proposal.openingId}/trial-proposals/${proposal.id}/decision`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ decision: 'accepted' }) }),
    );
  });

  it('lists and appends participant trial check-ins', async () => {
    const checkIn = {
      id: '91919191-9191-4191-a191-919191919191', proposalId: proposal.id,
      kind: 'progress', update: 'Completed the API boundary and added focused tests.', evidenceUrl: '',
      author: { displayName: 'Asha Rao' }, authorRole: 'applicant', createdAt: '2026-09-02T10:00:00Z',
    } as const;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [checkIn] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: checkIn }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(listTrialCheckIns(proposal.id)).resolves.toEqual([checkIn]);
    await expect(addTrialCheckIn(proposal.id, { kind: 'progress', update: checkIn.update, evidenceUrl: '' })).resolves.toEqual(checkIn);
    expect(fetcher).toHaveBeenLastCalledWith(
      `http://localhost:8080/v1/trial-proposals/${proposal.id}/check-ins`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('loads, submits, and confirms a private trial outcome', async () => {
    const outcomeInput = {
      outcomeStatus: 'completed', deliverableStatus: 'met',
      workSummary: 'Delivered the agreed comparison flow with focused tests and review notes.',
      evidenceUrl: '', closeoutNotes: 'Repository access can be removed after the documented handoff.',
    } as const;
    const pending = {
      id: '92929292-9292-4292-a292-929292929292', proposalId: proposal.id, input: outcomeInput,
      reviewStatus: 'pending', submittedBy: { displayName: 'Asha Rao' }, submittedByRole: 'applicant',
      submittedByCurrentUser: true, canDecide: false, submittedAt: '2026-09-15T10:00:00Z', decidedAt: null,
    } as const;
    const confirmed = { ...pending, reviewStatus: 'confirmed', submittedByCurrentUser: false, decidedAt: '2026-09-15T11:00:00Z' } as const;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: pending }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: pending }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: confirmed }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadTrialOutcome(proposal.id)).resolves.toEqual(pending);
    await expect(createTrialOutcome(proposal.id, outcomeInput)).resolves.toEqual(pending);
    await expect(decideTrialOutcome(proposal.id, 'confirmed')).resolves.toEqual(confirmed);
    expect(fetcher).toHaveBeenLastCalledWith(
      `http://localhost:8080/v1/trial-proposals/${proposal.id}/outcome/decision`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ decision: 'confirmed' }) }),
    );
  });

  it('lists, submits, and acknowledges participant-private feedback', async () => {
    const feedbackInput = {
      observedBehaviors: ['reliable_delivery', 'clear_communication'] as const,
      collaborationExample: 'They surfaced a blocker early and delivered the revised milestone on the agreed date.',
      collaborateAgain: 'yes' as const,
      reviewSummary: 'A dependable collaborator who communicated tradeoffs clearly throughout the bounded trial.',
    };
    const feedback = {
      id: '93939393-9393-4393-a393-939393939393', proposalId: proposal.id, input: feedbackInput,
      author: { displayName: 'Asha Rao' }, authorRole: 'applicant', authoredByCurrentUser: true,
      canAcknowledge: false, submittedAt: '2026-09-15T12:00:00Z', acknowledgedAt: null,
    } as const;
    const acknowledged = { ...feedback, authoredByCurrentUser: false, acknowledgedAt: '2026-09-15T13:00:00Z' } as const;
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [feedback] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: feedback }), { status: 201 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: acknowledged }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadTrialFeedback(proposal.id)).resolves.toEqual([feedback]);
    await expect(createTrialFeedback(proposal.id, feedbackInput)).resolves.toEqual(feedback);
    await expect(acknowledgeTrialFeedback(proposal.id, feedback.id)).resolves.toEqual(acknowledged);
    expect(fetcher).toHaveBeenLastCalledWith(
      `http://localhost:8080/v1/trial-proposals/${proposal.id}/feedback/${feedback.id}/acknowledge`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('loads and validates the transparent private trust candidate', async () => {
    const candidate = {
      proposalId: proposal.id, ready: true, kind: 'collaboration_proven',
      title: 'Collaboration Proven candidate',
      explanation: 'Every visible collaboration-evidence rule is satisfied.',
      factors: ['Outcome: Completed', 'Deliverable: Met', 'Shared observed behaviors: 2'],
    } as const;
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: candidate }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(loadTrialTrustCandidate(proposal.id)).resolves.toEqual(candidate);
    expect(fetcher).toHaveBeenCalledWith(
      `http://localhost:8080/v1/trial-proposals/${proposal.id}/trust-candidate`,
      expect.objectContaining({ credentials: 'include' }),
    );
  });
});
