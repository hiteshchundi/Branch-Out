import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  loadOwnTrialProposal,
  saveOwnTrialProposal,
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
  openingId: 'climate-data-explorer', input, status: 'draft',
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
});
