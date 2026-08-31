import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../data/auth';
import { projects } from '../data/projects';
import {
  applicationDraftStorageKey,
  type ApplicationDraft,
  ProofApplicationPanel,
  validateApplicationDraft,
} from './proof-application-panel';

const project = projects[0];
const completeDraft: ApplicationDraft = {
  message: 'I have built public climate dashboards and enjoy making complex data understandable.',
  workSampleUrl: 'https://github.com/example/climate-dashboard',
  workSampleContext: 'I designed and implemented the interactive comparison view.',
  availability: '7 hours each week, starting next Monday',
  availabilityConfirmed: true,
  proposedContribution: 'I can audit the current data flow and prototype the region selector.',
};

const authenticatedUser: AuthenticatedUser = {
  id: 7,
  githubUserId: 42,
  githubLogin: 'branch-builder',
  displayName: 'Branch Builder',
  avatarUrl: 'https://avatars.githubusercontent.com/u/42',
  profileUrl: 'https://github.com/branch-builder',
};

function managedApplication(status: 'draft' | 'submitted' | 'accepted' | 'declined' = 'draft') {
  return {
    id: '61616161-6161-4161-a161-616161616161',
    openingId: project.id,
    input: completeDraft,
    status,
  };
}

describe('validateApplicationDraft', () => {
  it('accepts a complete proof-led application', () => {
    expect(validateApplicationDraft(completeDraft)).toEqual({});
  });

  it('rejects weak evidence and unsafe URLs', () => {
    const errors = validateApplicationDraft({
      ...completeDraft,
      workSampleUrl: 'javascript:alert(1)',
      proposedContribution: 'Anything',
      availabilityConfirmed: false,
    });
    expect(errors.workSampleUrl).toMatch(/http or https/i);
    expect(errors.proposedContribution).toMatch(/20 characters/i);
    expect(errors.availabilityConfirmed).toMatch(/confirm/i);
  });
});

describe('ProofApplicationPanel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows validation errors without completing an empty draft', () => {
    render(<ProofApplicationPanel project={project} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /complete application draft/i }));
    expect(screen.getByText(/note should be at least 30 characters/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/short note/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByText(/application ready/i)).not.toBeInTheDocument();
  });

  it('restores and updates a project-specific draft', () => {
    localStorage.setItem(applicationDraftStorageKey(project.id), JSON.stringify(completeDraft));
    render(<ProofApplicationPanel project={project} onClose={vi.fn()} />);
    expect(screen.getByLabelText(/short note/i)).toHaveValue(completeDraft.message);

    fireEvent.change(screen.getByLabelText(/availability for this project/i), {
      target: { value: '8 hours each week' },
    });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    expect(screen.getByText(/application draft saved/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(applicationDraftStorageKey(project.id)) ?? '{}').availability).toBe('8 hours each week');
  });

  it('completes a valid application without claiming it was sent', () => {
    localStorage.setItem(applicationDraftStorageKey(project.id), JSON.stringify(completeDraft));
    render(<ProofApplicationPanel project={project} onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /complete application draft/i }));

    const completion = screen.getByRole('status');
    expect(completion).toHaveTextContent('Application ready');
    expect(completion).toHaveTextContent('has not been sent');
    expect(screen.getByText(completeDraft.proposedContribution)).toBeInTheDocument();
  });

  it('loads and saves the authenticated member private application', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: managedApplication() }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: managedApplication() }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(<ProofApplicationPanel authenticatedUser={authenticatedUser} project={project} onClose={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading your application/i);
    expect(await screen.findByLabelText(/short note/i)).toHaveValue(completeDraft.message);
    fireEvent.click(screen.getByRole('button', { name: /^save draft$/i }));
    expect(await screen.findByText(/private application draft saved/i)).toBeInTheDocument();
    expect(fetcher).toHaveBeenLastCalledWith(
      `http://localhost:8080/v1/openings/${project.id}/application`,
      expect.objectContaining({ method: 'PUT', credentials: 'include' }),
    );
  });

  it('requires explicit confirmation before submitting an account application', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: managedApplication() }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: managedApplication() }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: managedApplication('submitted') }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(<ProofApplicationPanel authenticatedUser={authenticatedUser} project={project} onClose={vi.fn()} />);
    await screen.findByLabelText(/short note/i);

    fireEvent.click(screen.getByRole('button', { name: /save private application/i }));
    const submitButton = await screen.findByRole('button', { name: /submit application/i });
    expect(submitButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/cannot be edited after submission/i));
    fireEvent.click(submitButton);

    expect(await screen.findByText('Application submitted')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/can no longer be edited/i);
    expect(fetcher).toHaveBeenLastCalledWith(
      `http://localhost:8080/v1/openings/${project.id}/application/submit`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('loads a submitted application as immutable', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: managedApplication('submitted'),
    }), { status: 200 })));
    render(<ProofApplicationPanel authenticatedUser={authenticatedUser} project={project} onClose={vi.fn()} />);

    expect(await screen.findByText('Application submitted')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit application/i })).not.toBeInTheDocument();
    expect(screen.queryByLabelText(/short note/i)).not.toBeInTheDocument();
  });

  it('shows an owner decision to the applicant without restoring editing', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: managedApplication('accepted'),
    }), { status: 200 })));
    render(<ProofApplicationPanel authenticatedUser={authenticatedUser} project={project} onClose={vi.fn()} />);

    expect(await screen.findByText('Application accepted')).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(/owner accepted/i);
    expect(screen.getByRole('status')).toHaveTextContent(/messaging are not available/i);
    expect(screen.queryByLabelText(/short note/i)).not.toBeInTheDocument();
  });

  it('explains when a profile is required for an account application', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'application_not_found' } }), { status: 404 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'profile_required' } }), { status: 409 }));
    vi.stubGlobal('fetch', fetcher);
    render(<ProofApplicationPanel authenticatedUser={authenticatedUser} project={project} onClose={vi.fn()} />);
    await screen.findByLabelText(/short note/i);

    for (const [label, value] of [
      [/short note/i, completeDraft.message],
      [/one relevant work sample/i, completeDraft.workSampleUrl],
      [/what was your contribution/i, completeDraft.workSampleContext],
      [/availability for this project/i, completeDraft.availability],
      [/proposed first contribution/i, completeDraft.proposedContribution],
    ] as const) {
      fireEvent.change(screen.getByLabelText(label), { target: { value } });
    }
    fireEvent.click(screen.getByLabelText(/availability above is realistic/i));
    fireEvent.click(screen.getByRole('button', { name: /^save draft$/i }));
    expect(await screen.findByText(/complete your collaboration profile/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /^save draft$/i })).toBeEnabled());
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<ProofApplicationPanel project={project} onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
