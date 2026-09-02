import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SafetyReportForm } from './safety-report-form';

afterEach(() => vi.unstubAllGlobals());

describe('SafetyReportForm', () => {
  it('requires a category, bounded explanation, and disclosure confirmation', () => {
    render(<SafetyReportForm buttonLabel="Report this feedback" targetId="feedback-id" targetKind="trial_feedback" />);
    fireEvent.click(screen.getByRole('button', { name: /report this feedback/i }));
    fireEvent.click(screen.getByRole('button', { name: /submit safety report/i }));
    expect(screen.getByText(/choose the closest safety category/i)).toBeInTheDocument();
    expect(screen.getByText(/30 to 1000 characters/i)).toBeInTheDocument();
    expect(screen.getByText(/shared with moderators/i)).toBeInTheDocument();
  });

  it('submits a participant-scoped report with explicit snapshot disclosure', async () => {
    const receipt = {
      id: '94949494-9494-4494-a494-949494949494', targetKind: 'trial_feedback', targetId: 'feedback-id',
      category: 'privacy', status: 'pending', createdAt: '2026-09-16T10:00:00Z',
    };
    const fetcher = vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: receipt }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    render(<SafetyReportForm buttonLabel="Report this feedback" targetId="feedback-id" targetKind="trial_feedback" />);
    fireEvent.click(screen.getByRole('button', { name: /report this feedback/i }));
    fireEvent.change(screen.getByLabelText(/concern category/i), { target: { value: 'privacy' } });
    fireEvent.change(screen.getByLabelText(/what should moderators review/i), { target: { value: 'This feedback includes private client information that should be reviewed.' } });
    fireEvent.click(screen.getByLabelText(/private snapshot will be shared/i));
    fireEvent.click(screen.getByRole('button', { name: /submit safety report/i }));
    expect(await screen.findByRole('status')).toHaveTextContent(/submitted for moderator review/i);
    expect(fetcher).toHaveBeenCalledWith('http://localhost:8080/v1/safety-reports', expect.objectContaining({
      method: 'POST', credentials: 'include', body: JSON.stringify({
        targetKind: 'trial_feedback', targetId: 'feedback-id', category: 'privacy',
        details: 'This feedback includes private client information that should be reviewed.',
      }),
    }));
  });
});
