import { afterEach, describe, expect, it, vi } from 'vitest';
import { decideModerationAppeal, listModerationAppeals } from './moderation-appeals';

const appeal = {
  id: 'appeal-id', reportId: 'report-id', targetKind: 'trial_feedback', targetId: 'feedback-id',
  reason: 'The complete trial context should be considered before the removal remains permanent.',
  status: 'pending', appellantLogin: 'review-author', moderatorNotes: null,
  createdAt: '2026-09-02T10:00:00Z', decidedAt: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('moderation appeal API client', () => {
  it('loads the appeal queue and validates decision metadata', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [appeal] }), { status: 200 })));
    await expect(listModerationAppeals()).resolves.toEqual([appeal]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(new Response(JSON.stringify({ data: [{ ...appeal, status: 'granted', decidedAt: 'not-a-date' }] }), { status: 200 })));
    await expect(listModerationAppeals()).rejects.toThrow(/invalid moderation appeal/i);
  });

  it('records a permanent appeal decision', async () => {
    const decided = { ...appeal, status: 'granted', moderatorNotes: 'The complete context supports restoring this item.', decidedAt: '2026-09-02T11:00:00Z' };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: decided }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    await expect(decideModerationAppeal(appeal.id, 'granted', decided.moderatorNotes)).resolves.toEqual(decided);
    expect(fetcher).toHaveBeenCalledWith(expect.stringContaining('/moderation/appeals/appeal-id/decision'), expect.objectContaining({
      body: JSON.stringify({ decision: 'granted', moderatorNotes: decided.moderatorNotes }), method: 'POST',
    }));
  });
});
