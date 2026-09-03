import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModerationQueuePanel } from './moderation-queue-panel';

const pendingReport = {
  id: '61616161-6161-4161-a161-616161616161', targetKind: 'trial_feedback', targetId: 'feedback-id',
  category: 'privacy', details: 'The feedback includes private client information that should be reviewed.',
  targetSnapshot: { observedBehaviors: ['Clear communication', 'Reliable delivery'], reviewSummary: 'Captured review summary' },
  status: 'pending', reporter: { githubLogin: 'careful-builder' }, moderatorNotes: null,
  createdAt: '2026-09-02T08:00:00Z', decidedAt: null,
};

afterEach(() => vi.unstubAllGlobals());

describe('ModerationQueuePanel', () => {
  it('shows captured evidence and requires a complete permanent decision', async () => {
    const decidedReport = { ...pendingReport, status: 'upheld', moderatorNotes: 'The captured review contains private client information.', decidedAt: '2026-09-02T09:00:00Z' };
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [pendingReport] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: decidedReport }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(<ModerationQueuePanel onClose={vi.fn()} />);

    const report = await screen.findByRole('article');
    expect(report).toHaveTextContent('@careful-builder');
    fireEvent.click(within(report).getByText(/review captured evidence/i));
    expect(report).toHaveTextContent('Captured review summary');

    fireEvent.click(within(report).getByRole('button', { name: /record decision/i }));
    const submit = within(report).getByRole('button', { name: /record permanent decision/i });
    expect(submit).toBeDisabled();
    fireEvent.click(within(report).getByLabelText(/uphold report/i));
    fireEvent.change(within(report).getByLabelText(/moderator notes/i), { target: { value: decidedReport.moderatorNotes } });
    fireEvent.click(within(report).getByLabelText(/is permanent/i));
    expect(submit).toBeEnabled();
    fireEvent.click(submit);

    expect(await screen.findByRole('status')).toHaveTextContent(/report upheld/i);
    await waitFor(() => expect(screen.queryByRole('article')).not.toBeInTheDocument());
    expect(fetcher).toHaveBeenLastCalledWith(expect.stringContaining('/decision'), expect.objectContaining({
      body: JSON.stringify({ decision: 'upheld', moderatorNotes: decidedReport.moderatorNotes }), method: 'POST',
    }));
  });

  it('closes with Escape and offers a retry after a queue failure', async () => {
    const onClose = vi.fn();
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 })));
    render(<ModerationQueuePanel onClose={onClose} />);
    expect(await screen.findByText(/queue could not be loaded/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /retry/i }));
    expect(await screen.findByText(/no pending review reports/i)).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('shows pending participant appeals without implying a decision', async () => {
    const appeal = { id: 'appeal-id', reportId: pendingReport.id, targetKind: 'trial_feedback', targetId: 'feedback-id', reason: 'The complete trial context should be considered before this removal remains permanent.', status: 'pending', appellantLogin: 'review-author', createdAt: '2026-09-02T10:00:00Z' };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [appeal] }), { status: 200 })));
    render(<ModerationQueuePanel onClose={vi.fn()} />);
    fireEvent.click(await screen.findByRole('button', { name: /pending appeals 1/i }));
    expect(screen.getByText('@review-author')).toBeInTheDocument();
    expect(screen.getByText(appeal.reason)).toBeInTheDocument();
    expect(screen.getByText(/appeal decisions and restoration are not part/i)).toBeInTheDocument();
  });
});
