import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../data/auth';
import {
  CreateOpeningPanel,
  OPENING_DRAFT_STORAGE_KEY,
  type OpeningDraft,
  validateOpeningStep,
} from './create-opening-panel';

const completeDraft: OpeningDraft = {
  projectName: 'Climate mapper',
  problem: 'Help local teams understand climate risks with clear regional data.',
  role: 'Frontend engineer',
  skills: 'TypeScript, React',
  commitment: '6–8 hrs/week',
  duration: '5–8 weeks',
  timezone: 'UTC to UTC+4',
  compensation: 'Fixed bounty',
  firstMilestone: 'Build the first interactive region comparison with test coverage.',
  ownerContribution: 'The API, research notes, and working wireframes are already complete.',
  confidentiality: 'Public',
};

const authenticatedUser: AuthenticatedUser = {
  id: 7,
  githubUserId: 42,
  githubLogin: 'branch-builder',
  displayName: 'Branch Builder',
  avatarUrl: 'https://avatars.githubusercontent.com/u/42',
  profileUrl: 'https://github.com/branch-builder',
};

function managedDraft(
  projectName = completeDraft.projectName,
  publicationStatus: 'draft' | 'published' | 'closed' = 'draft',
) {
  return {
    id: '61616161-6161-4161-a161-616161616161',
    title: `Frontend engineer for ${projectName}`,
    summary: completeDraft.problem,
    skills: ['TypeScript', 'React'],
    commitment: completeDraft.commitment,
    role: 'Engineering',
    duration: completeDraft.duration,
    timezone: completeDraft.timezone,
    compensation: completeDraft.compensation,
    firstMilestone: completeDraft.firstMilestone,
    ownerContribution: completeDraft.ownerContribution,
    confidentiality: 'Public project details; no private credentials or client-confidential material.',
    publicationStatus,
  };
}

describe('validateOpeningStep', () => {
  it('validates only the requested step', () => {
    const errors = validateOpeningStep({ ...completeDraft, projectName: '' }, 0);
    expect(errors.projectName).toMatch(/required/i);
    expect(errors.commitment).toBeUndefined();
  });

  it('requires enough detail for outcome and trial fields', () => {
    expect(validateOpeningStep({ ...completeDraft, problem: 'Too short' }, 0).problem).toMatch(/20 characters/i);
    expect(validateOpeningStep({ ...completeDraft, firstMilestone: 'Tiny' }, 2).firstMilestone).toMatch(/20 characters/i);
  });

  it('matches backend skill and text limits', () => {
    expect(validateOpeningStep({ ...completeDraft, skills: 'React, react' }, 0).skills).toMatch(/only once/i);
    expect(validateOpeningStep({ ...completeDraft, projectName: 'x' }, 0).projectName).toMatch(/3 to 80/i);
    expect(validateOpeningStep({ ...completeDraft, timezone: 'x' }, 1).timezone).toMatch(/3 to 80/i);
    expect(validateOpeningStep({ ...completeDraft, compensation: 'Exploratory' }, 1).compensation).toMatch(/supported/i);
  });
});

describe('CreateOpeningPanel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows accessible validation errors before advancing', () => {
    render(<CreateOpeningPanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));

    expect(screen.getByText('Project name is required.')).toBeInTheDocument();
    expect(screen.getByLabelText(/project name/i)).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('heading', { name: /what are you building/i })).toBeInTheDocument();
  });

  it('restores and saves a device-local draft', () => {
    localStorage.setItem(OPENING_DRAFT_STORAGE_KEY, JSON.stringify(completeDraft));
    render(<CreateOpeningPanel onClose={vi.fn()} />);

    expect(screen.getByLabelText(/project name/i)).toHaveValue('Climate mapper');
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Climate atlas' } });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    expect(screen.getByText(/draft saved on this device/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(OPENING_DRAFT_STORAGE_KEY) ?? '{}').projectName).toBe('Climate atlas');
  });

  it('completes all three steps and saves the final draft', () => {
    localStorage.setItem(OPENING_DRAFT_STORAGE_KEY, JSON.stringify(completeDraft));
    render(<CreateOpeningPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /what commitment/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByRole('heading', { name: /focused and safe/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /complete draft/i }));

    expect(screen.getByRole('status')).toHaveTextContent('Draft ready');
    expect(screen.getByRole('status')).toHaveTextContent('Climate mapper');
    expect(localStorage.getItem(OPENING_DRAFT_STORAGE_KEY)).toContain('Fixed bounty');
  });

  it('loads and updates the authenticated member private draft', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [managedDraft()], meta: { count: 1 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: managedDraft('Climate atlas') }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(<CreateOpeningPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent(/loading your latest opening/i);
    expect(await screen.findByLabelText(/project name/i)).toHaveValue('Climate mapper');
    fireEvent.change(screen.getByLabelText(/project name/i), { target: { value: 'Climate atlas' } });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));

    expect(await screen.findByText(/private draft saved to your account/i)).toBeInTheDocument();
    expect(fetcher).toHaveBeenLastCalledWith(
      'http://localhost:8080/v1/openings/61616161-6161-4161-a161-616161616161',
      expect.objectContaining({ method: 'PUT', credentials: 'include' }),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: /save draft/i })).toBeEnabled());
    expect(localStorage.getItem(OPENING_DRAFT_STORAGE_KEY)).toBeNull();
  });

  it('requires explicit confirmation before publishing a private draft', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [managedDraft()] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: managedDraft() }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: managedDraft(completeDraft.projectName, 'published') }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(<CreateOpeningPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} />);
    await screen.findByLabelText(/project name/i);

    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /save private draft/i }));

    const publishButton = await screen.findByRole('button', { name: /publish opening/i });
    expect(publishButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/safe to publish publicly/i));
    expect(publishButton).toBeEnabled();
    fireEvent.click(publishButton);

    expect(await screen.findByText('Published opening')).toBeInTheDocument();
    expect(fetcher).toHaveBeenLastCalledWith(
      `http://localhost:8080/v1/openings/${managedDraft().id}/publish`,
      expect.objectContaining({ method: 'POST', credentials: 'include' }),
    );
  });

  it('loads a published opening and requires separate confirmation to close it', async () => {
    const published = managedDraft(completeDraft.projectName, 'published');
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [published] }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: { ...published, publicationStatus: 'closed' } }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(<CreateOpeningPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} />);

    expect(await screen.findByText('Published opening')).toBeInTheDocument();
    const closeButton = screen.getByRole('button', { name: /close opening/i });
    expect(closeButton).toBeDisabled();
    fireEvent.click(screen.getByLabelText(/reopening is not available/i));
    fireEvent.click(closeButton);

    expect(await screen.findByText('Opening closed')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /start another draft/i })).toBeInTheDocument();
  });

  it('starts a fresh draft after loading a closed opening', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({
      data: [managedDraft(completeDraft.projectName, 'closed')],
    }), { status: 200 })));
    render(<CreateOpeningPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} />);

    expect(await screen.findByText('Opening closed')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /start another draft/i }));
    expect(screen.getByLabelText(/project name/i)).toHaveValue('');
  });

  it('explains that a collaboration profile is required for account drafts', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: [managedDraft()], meta: { count: 1 } }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ error: { code: 'profile_required', message: 'required' } }), { status: 409 }));
    vi.stubGlobal('fetch', fetcher);
    render(<CreateOpeningPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} />);
    await screen.findByLabelText(/project name/i);

    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    expect(await screen.findByText(/complete your collaboration profile/i)).toBeInTheDocument();
  });

  it('blocks account saving when server drafts cannot be loaded', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { code: 'internal_error' } }), { status: 500 })));
    render(<CreateOpeningPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} />);

    expect(await screen.findByText(/account drafts could not be loaded/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByRole('button', { name: /save draft/i })).toBeDisabled());
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<CreateOpeningPanel onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });
});
