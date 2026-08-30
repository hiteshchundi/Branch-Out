import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createOpeningDraft,
  closeOpening,
  listOwnedOpeningDrafts,
  listOwnedOpenings,
  OpeningDraftAPIError,
  publishOpening,
  updateOpeningDraft,
  type OpeningDraftInput,
} from './opening-drafts';

const input: OpeningDraftInput = {
  projectName: 'Climate mapper',
  problem: 'Help local teams understand climate risks with clear regional data.',
  role: 'Frontend engineer',
  skills: ['TypeScript', 'React'],
  commitment: '6–8 hrs/week',
  duration: '5–8 weeks',
  timezone: 'UTC to UTC+4',
  compensation: 'Fixed bounty',
  firstMilestone: 'Build the first interactive region comparison with test coverage.',
  ownerContribution: 'The API, research notes, and working wireframes are already complete.',
  confidentiality: 'Public',
};

const responseDraft = {
  id: '61616161-6161-4161-a161-616161616161',
  title: 'Frontend engineer for Climate mapper',
  summary: input.problem,
  skills: input.skills,
  commitment: input.commitment,
  role: 'Engineering',
  duration: input.duration,
  timezone: input.timezone,
  compensation: input.compensation,
  firstMilestone: input.firstMilestone,
  ownerContribution: input.ownerContribution,
  confidentiality: 'Public project details; no private credentials or client-confidential material.',
  publicationStatus: 'draft',
};

afterEach(() => vi.unstubAllGlobals());

describe('opening draft API client', () => {
  it('loads and maps the current member draft', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [responseDraft, { ...responseDraft, id: '71717171-7171-4171-a171-717171717171', publicationStatus: 'published' }],
      meta: { count: 2 },
    }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(listOwnedOpeningDrafts()).resolves.toEqual([{
      id: responseDraft.id,
      publicationStatus: 'draft',
      input,
    }]);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8080/v1/openings/mine',
      expect.objectContaining({ credentials: 'include' }),
    );
  });

  it('loads every owned lifecycle state for opening management', async () => {
    const published = {
      ...responseDraft,
      id: '71717171-7171-4171-a171-717171717171',
      publicationStatus: 'published',
    };
    const closed = {
      ...responseDraft,
      id: '81818181-8181-4181-a181-818181818181',
      publicationStatus: 'closed',
    };
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [published, closed],
    }), { status: 200 })));

    await expect(listOwnedOpenings()).resolves.toEqual([
      { id: published.id, publicationStatus: 'published', input },
      { id: closed.id, publicationStatus: 'closed', input },
    ]);
  });

  it('creates a private draft with the session cookie', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: responseDraft }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(createOpeningDraft(input)).resolves.toMatchObject({ id: responseDraft.id, input });
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8080/v1/openings',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(input), credentials: 'include' }),
    );
  });

  it('updates an existing private draft by encoded ID', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: responseDraft }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await updateOpeningDraft('draft/id', input);
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8080/v1/openings/draft%2Fid',
      expect.objectContaining({ method: 'PUT' }),
    );
  });

  it('publishes an owned draft with an explicit lifecycle request', async () => {
    const published = { ...responseDraft, publicationStatus: 'published' };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: published }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(publishOpening('draft/id')).resolves.toMatchObject({ publicationStatus: 'published' });
    expect(fetcher).toHaveBeenCalledWith(
      'http://localhost:8080/v1/openings/draft%2Fid/publish',
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('closes an owned published opening with an explicit lifecycle request', async () => {
    const closed = { ...responseDraft, publicationStatus: 'closed' };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: closed }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(closeOpening(responseDraft.id)).resolves.toMatchObject({ publicationStatus: 'closed' });
    expect(fetcher).toHaveBeenCalledWith(
      `http://localhost:8080/v1/openings/${responseDraft.id}/close`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('reverses backend display mappings for editable portfolio drafts', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{
      ...responseDraft,
      compensation: 'Portfolio',
      confidentiality: 'Limited public details; additional context is shared only after owner review.',
    }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);

    const [draft] = await listOwnedOpeningDrafts();
    expect(draft.input.compensation).toBe('Unpaid / portfolio');
    expect(draft.input.confidentiality).toBe('Limited details');
  });

  it('preserves structured API errors', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      error: { code: 'invalid_opening', message: 'invalid', field: 'problem' },
    }), { status: 400 }));
    vi.stubGlobal('fetch', fetcher);

    await expect(createOpeningDraft(input)).rejects.toEqual(
      new OpeningDraftAPIError(400, 'invalid_opening', 'problem'),
    );
  });

  it('rejects a malformed success response', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [{
      ...responseDraft,
      title: 'Unexpected title format',
    }] }), { status: 200 })));
    await expect(listOwnedOpeningDrafts()).rejects.toThrow(/invalid opening draft/i);
  });
});
