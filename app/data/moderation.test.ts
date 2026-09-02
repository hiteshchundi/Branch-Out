import { afterEach, describe, expect, it, vi } from 'vitest';
import { decideModerationReport, listModerationReports } from './moderation';

const report = {
  id: '61616161-6161-4161-a161-616161616161', targetKind: 'trial_feedback', targetId: 'feedback-id',
  category: 'privacy', details: 'The feedback contains private client information.',
  targetSnapshot: { reviewSummary: 'Captured private review' }, status: 'pending',
  reporter: { githubLogin: 'reporter' }, moderatorNotes: null,
  createdAt: '2026-09-02T08:00:00Z', decidedAt: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('moderation API client', () => {
  it('loads and validates the private moderation queue', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [report] }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(listModerationReports()).resolves.toEqual([report]);
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/v1/moderation/reports', expect.objectContaining({ credentials: 'include' }));
  });

  it('rejects malformed snapshots and records an immutable decision', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ ...report, targetSnapshot: [] }] }), { status: 200 })));
    await expect(listModerationReports()).rejects.toThrow(/invalid moderation report/i);

    const decided = { ...report, status: 'upheld', moderatorNotes: 'The snapshot confirms private client information.', decidedAt: '2026-09-02T09:00:00Z' };
    const fetcher = vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: decided }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(decideModerationReport(report.id, 'upheld', decided.moderatorNotes)).resolves.toEqual(decided);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining(encodeURIComponent(report.id)), expect.objectContaining({ method: 'POST' }));
  });
});
