import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
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
});

describe('ProfileOnboardingPanel', () => {
  beforeEach(() => localStorage.clear());

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
});
