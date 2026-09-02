import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSafetyReport } from './safety-reports';

afterEach(() => vi.unstubAllGlobals());

describe('safety report API client', () => {
  it('validates the pending receipt', async () => {
    const receipt = {
      id: '94949494-9494-4494-a494-949494949494', targetKind: 'trust_candidate', targetId: 'proposal-id',
      category: 'fraud', status: 'pending', createdAt: '2026-09-16T10:00:00Z',
    } as const;
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: receipt }), { status: 201 })));
    await expect(createSafetyReport({
      targetKind: 'trust_candidate', targetId: 'proposal-id', category: 'fraud',
      details: 'The derived review appears to rely on materially misrepresented trial evidence.',
    })).resolves.toEqual(receipt);
  });

  it('rejects malformed receipts', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { id: 'report-id', status: 'upheld' } }), { status: 201 })));
    await expect(createSafetyReport({ targetKind: 'trial_feedback', targetId: 'feedback-id', category: 'other', details: 'This report has enough detail to pass the client request boundary.' })).rejects.toThrow(/invalid safety report/i);
  });
});
