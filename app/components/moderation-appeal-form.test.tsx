import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ModerationAppealForm } from './moderation-appeal-form';

afterEach(() => vi.unstubAllGlobals());

describe('ModerationAppealForm', () => {
  it('requires a bounded reason and explicit pending-removal confirmation', async () => {
    const appeal = { id: 'appeal-id', reportId: 'report-id', targetKind: 'trial_feedback', targetId: 'feedback-id', reason: 'The complete trial context should be considered before this removal remains permanent.', status: 'pending', appellantLogin: 'author', createdAt: '2026-09-02T10:00:00Z' };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: appeal }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    render(<ModerationAppealForm targetId="feedback-id" targetKind="trial_feedback" />);
    fireEvent.click(screen.getByRole('button', { name: /appeal this removal/i }));
    const submit = screen.getByRole('button', { name: /submit appeal/i });
    expect(submit).toBeDisabled();
    fireEvent.change(screen.getByLabelText(/why should this removal/i), { target: { value: appeal.reason } });
    fireEvent.click(screen.getByLabelText(/removal stays active/i));
    fireEvent.click(submit);
    expect(await screen.findByRole('status')).toHaveTextContent(/appeal submitted/i);
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/v1/moderation-appeals', expect.objectContaining({ method: 'POST', body: JSON.stringify({ targetKind: 'trial_feedback', targetId: 'feedback-id', reason: appeal.reason }) }));
  });
});
