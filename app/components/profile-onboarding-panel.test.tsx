import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthenticatedUser } from '../data/auth';
import {
  PROFILE_DRAFT_STORAGE_KEY,
  type ProfileDraft,
  ProfileOnboardingPanel,
  validateProfileStep,
} from './profile-onboarding-panel';

const completeProfile: ProfileDraft = {
  displayName: 'Asha Rao',
  primaryRole: 'Software developer',
  bio: 'I build accessible data products and enjoy small teams with clear ownership.',
  timezone: 'UTC+5:30',
  weeklyAvailability: '6–8 hrs/week',
  preferredDuration: '5–8 weeks',
  workStyle: 'Async-first',
  communicationCadence: 'Three updates per week',
  skills: 'TypeScript, React, accessibility',
  githubUrl: 'https://github.com/asha-rao',
  portfolioUrl: 'https://asha.example/work',
  evidenceSummary: 'The linked repositories show interfaces and tests I personally delivered.',
};

const authenticatedUser: AuthenticatedUser = {
  id: 7,
  githubUserId: 42,
  githubLogin: 'asha-rao',
  displayName: 'Asha Rao',
  avatarUrl: 'https://avatars.githubusercontent.com/u/42',
  profileUrl: 'https://github.com/asha-rao',
  accountRole: 'member',
};

const savedProfile = {
  userId: 7,
  ...completeProfile,
  skills: ['TypeScript', 'React', 'accessibility'],
  githubUrl: authenticatedUser.profileUrl,
  portfolioUrl: completeProfile.portfolioUrl,
  createdAt: '2026-08-29T08:00:00Z',
  updatedAt: '2026-08-29T08:00:00Z',
};

describe('validateProfileStep', () => {
  it('validates only the visible step', () => {
    const errors = validateProfileStep({ ...completeProfile, displayName: '' }, 0);
    expect(errors.displayName).toMatch(/required/i);
    expect(errors.weeklyAvailability).toBeUndefined();
  });

  it('requires a real GitHub profile and safe portfolio URL', () => {
    const errors = validateProfileStep({ ...completeProfile, githubUrl: 'https://example.com/me', portfolioUrl: 'javascript:bad' }, 2);
    expect(errors.githubUrl).toMatch(/github profile/i);
    expect(errors.portfolioUrl).toMatch(/http or https/i);
  });

  it('rejects duplicate or oversized skill lists', () => {
    expect(validateProfileStep({ ...completeProfile, skills: 'React, react' }, 2).skills).toMatch(/only once/i);
    expect(validateProfileStep({ ...completeProfile, skills: Array.from({ length: 11 }, (_, index) => `Skill ${index}`).join(',') }, 2).skills).toMatch(/no more than 10/i);
  });
});

describe('ProfileOnboardingPanel', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('shows accessible errors before advancing', () => {
    render(<ProfileOnboardingPanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getAllByText(/this field is required/i).length).toBeGreaterThan(0);
    expect(screen.getByLabelText(/display name/i)).toHaveAttribute('aria-invalid', 'true');
  });

  it('restores and updates a device-local profile draft', () => {
    localStorage.setItem(PROFILE_DRAFT_STORAGE_KEY, JSON.stringify(completeProfile));
    render(<ProfileOnboardingPanel onClose={vi.fn()} />);
    expect(screen.getByLabelText(/display name/i)).toHaveValue('Asha Rao');
    fireEvent.change(screen.getByLabelText(/display name/i), { target: { value: 'Asha R.' } });
    fireEvent.click(screen.getByRole('button', { name: /save draft/i }));
    expect(screen.getByText(/profile draft saved/i)).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(PROFILE_DRAFT_STORAGE_KEY) ?? '{}').displayName).toBe('Asha R.');
  });

  it('completes all steps without claiming an account was created', () => {
    localStorage.setItem(PROFILE_DRAFT_STORAGE_KEY, JSON.stringify(completeProfile));
    render(<ProfileOnboardingPanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /complete profile draft/i }));

    const completion = screen.getByRole('status');
    expect(completion).toHaveTextContent('Profile draft ready');
    expect(completion).toHaveTextContent('not an account');
    expect(completion).toHaveTextContent('Asha Rao');
  });

  it('closes with Escape', () => {
    const onClose = vi.fn();
    render(<ProfileOnboardingPanel onClose={onClose} />);
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('loads and saves the authenticated account profile', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: savedProfile }), { status: 200 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ data: savedProfile }), { status: 200 }));
    vi.stubGlobal('fetch', fetcher);
    render(<ProfileOnboardingPanel authenticatedUser={authenticatedUser} onClose={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Loading your saved profile');
    await waitFor(() => expect(screen.getByLabelText(/display name/i)).toHaveValue('Asha Rao'));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    fireEvent.click(screen.getByRole('button', { name: /continue/i }));
    expect(screen.getByLabelText(/github profile/i)).toHaveAttribute('readonly');
    fireEvent.click(screen.getByRole('button', { name: /^save profile$/i }));

    const completion = await screen.findByRole('status');
    expect(completion).toHaveTextContent('Profile saved');
    expect(completion).toHaveTextContent('saved to your Branch-Out account');
    const request = fetcher.mock.calls[1][1];
    const body = JSON.parse(request.body);
    expect(body.githubUrl).toBeUndefined();
    expect(body.skills).toEqual(['TypeScript', 'React', 'accessibility']);
    expect(localStorage.getItem(PROFILE_DRAFT_STORAGE_KEY)).toBeNull();
  });
});
