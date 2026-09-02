import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { TrialCheckInInput } from '../data/trial-proposals';
import { TrialCheckInLog, validateTrialCheckIn } from './trial-check-in-log';

vi.mock('./trial-outcome-closeout', () => ({ TrialOutcomeCloseout: () => <section aria-label="Trial outcome test boundary" /> }));

const proposalID = '81818181-8181-4181-a181-818181818181';
const validInput: TrialCheckInInput = {
  kind: 'progress', update: 'Completed the API boundary and added focused tests.', evidenceUrl: '',
};
const savedCheckIn = {
  id: '91919191-9191-4191-a191-919191919191', proposalId: proposalID, ...validInput,
  author: { displayName: 'Asha Rao' }, authorRole: 'applicant', createdAt: '2026-09-02T10:00:00Z',
};

afterEach(() => vi.unstubAllGlobals());

describe('trial check-in rules', () => {
  it('requires a concrete update and safe optional evidence URL', () => {
    expect(validateTrialCheckIn({ ...validInput, update: 'Too short' }).update).toMatch(/20 to 1000/i);
    expect(validateTrialCheckIn({ ...validInput, evidenceUrl: 'javascript:alert(1)' }).evidenceUrl).toMatch(/http or https/i);
    expect(validateTrialCheckIn(validInput)).toEqual({});
  });
});

describe('TrialCheckInLog', () => {
  it('loads the private timeline and labels participant roles', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: [savedCheckIn] }), { status: 200 })));
    render(<TrialCheckInLog proposalId={proposalID} />);
    expect(await screen.findByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('Applicant')).toBeInTheDocument();
    expect(screen.getByText(validInput.update)).toBeInTheDocument();
  });

  it('validates before appending an immutable check-in', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: savedCheckIn }), { status: 201 }));
    vi.stubGlobal('fetch', fetcher);
    render(<TrialCheckInLog proposalId={proposalID} />);
    await screen.findByText(/No check-ins yet/i);
    fireEvent.click(screen.getByRole('button', { name: /add private check-in/i }));
    expect(screen.getByText(/20 to 1000 characters/i)).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fireEvent.change(screen.getByPlaceholderText(/Describe what changed/i), { target: { value: validInput.update } });
    fireEvent.click(screen.getByRole('button', { name: /add private check-in/i }));
    expect(await screen.findByText(/Check-in added/i)).toBeInTheDocument();
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it('shows a retry boundary when the private timeline cannot load', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{}', { status: 500 })));
    render(<TrialCheckInLog proposalId={proposalID} />);
    expect(await screen.findByRole('alert')).toHaveTextContent(/could not be loaded/i);
    await waitFor(() => expect(screen.queryByRole('button', { name: /add private check-in/i })).not.toBeInTheDocument());
  });
});
