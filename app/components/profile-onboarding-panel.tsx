'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { AuthenticatedUser } from '../data/auth';
import {
  loadCurrentProfile,
  ProfileAPIError,
  saveCurrentProfile,
  type CollaborationProfile,
} from '../data/profile';
import { useAccessibleDialog } from './use-accessible-dialog';

export const PROFILE_DRAFT_STORAGE_KEY = 'branch-out-profile-draft';

export type ProfileDraft = {
  displayName: string;
  primaryRole: string;
  bio: string;
  timezone: string;
  weeklyAvailability: string;
  preferredDuration: string;
  workStyle: string;
  communicationCadence: string;
  skills: string;
  githubUrl: string;
  portfolioUrl: string;
  evidenceSummary: string;
};

type DraftField = keyof ProfileDraft;
type ProfileErrors = Partial<Record<DraftField, string>>;

const emptyDraft: ProfileDraft = {
  displayName: '',
  primaryRole: '',
  bio: '',
  timezone: '',
  weeklyAvailability: '',
  preferredDuration: '',
  workStyle: '',
  communicationCadence: '',
  skills: '',
  githubUrl: '',
  portfolioUrl: '',
  evidenceSummary: '',
};

const stepFields: DraftField[][] = [
  ['displayName', 'primaryRole', 'bio', 'timezone'],
  ['weeklyAvailability', 'preferredDuration', 'workStyle', 'communicationCadence'],
  ['skills', 'githubUrl', 'portfolioUrl', 'evidenceSummary'],
];

function loadSavedProfile(): ProfileDraft {
  if (typeof window === 'undefined') return emptyDraft;
  try {
    const parsed = JSON.parse(window.localStorage.getItem(PROFILE_DRAFT_STORAGE_KEY) ?? '{}');
    return Object.fromEntries(
      Object.keys(emptyDraft).map((key) => {
        const field = key as DraftField;
        return [field, typeof parsed[field] === 'string' ? parsed[field] : ''];
      }),
    ) as unknown as ProfileDraft;
  } catch {
    return emptyDraft;
  }
}

function profileToDraft(profile: CollaborationProfile): ProfileDraft {
  return {
    displayName: profile.displayName,
    primaryRole: profile.primaryRole,
    bio: profile.bio,
    timezone: profile.timezone,
    weeklyAvailability: profile.weeklyAvailability,
    preferredDuration: profile.preferredDuration,
    workStyle: profile.workStyle,
    communicationCadence: profile.communicationCadence,
    skills: profile.skills.join(', '),
    githubUrl: profile.githubUrl,
    portfolioUrl: profile.portfolioUrl ?? '',
    evidenceSummary: profile.evidenceSummary,
  };
}

function isHttpUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

function isGitHubProfile(value: string) {
  try {
    const url = new URL(value);
    const isGitHub = url.hostname === 'github.com' || url.hostname === 'www.github.com';
    return url.protocol === 'https:' && isGitHub && url.pathname.split('/').filter(Boolean).length >= 1;
  } catch {
    return false;
  }
}

/** Validates the visible onboarding step without pretending to verify identity. */
export function validateProfileStep(draft: ProfileDraft, step: number): ProfileErrors {
  const errors: ProfileErrors = {};
  for (const field of stepFields[step]) {
    if (field !== 'portfolioUrl' && !draft[field].trim()) errors[field] = 'This field is required.';
  }

  if (step === 0 && draft.bio.trim() && draft.bio.trim().length < 40) {
    errors.bio = 'Your bio should be at least 40 characters.';
  }
  if (step === 0 && draft.displayName.trim().length > 100) errors.displayName = 'Use 100 characters or fewer.';
  if (step === 0 && draft.bio.trim().length > 500) errors.bio = 'Use 500 characters or fewer.';
  if (step === 0 && draft.timezone.trim().length > 50) errors.timezone = 'Use 50 characters or fewer.';
  if (step === 2) {
    const skills = draft.skills.split(',').map((skill) => skill.trim()).filter(Boolean);
    const normalizedSkills = skills.map((skill) => skill.toLowerCase());
    if (skills.length > 10) errors.skills = 'Add no more than 10 skills.';
    else if (skills.some((skill) => skill.length > 40)) errors.skills = 'Keep each skill to 40 characters or fewer.';
    else if (new Set(normalizedSkills).size !== normalizedSkills.length) errors.skills = 'List each skill only once.';
    if (draft.githubUrl.trim() && !isGitHubProfile(draft.githubUrl.trim())) {
      errors.githubUrl = 'Enter a complete HTTPS GitHub profile link.';
    }
    if (draft.portfolioUrl.trim() && !isHttpUrl(draft.portfolioUrl.trim())) {
      errors.portfolioUrl = 'Enter a complete HTTP or HTTPS portfolio link.';
    }
    if (draft.evidenceSummary.trim() && draft.evidenceSummary.trim().length < 20) {
      errors.evidenceSummary = 'Describe your evidence in at least 20 characters.';
    }
    if (draft.evidenceSummary.trim().length > 500) errors.evidenceSummary = 'Use 500 characters or fewer.';
  }
  return errors;
}

function FieldError({ field, errors }: { field: DraftField; errors: ProfileErrors }) {
  return errors[field] ? <span className="field-error" id={`profile-${field}-error`}>{errors[field]}</span> : null;
}

export function ProfileOnboardingPanel({
  authenticatedUser = null,
  onClose,
}: {
  authenticatedUser?: AuthenticatedUser | null;
  onClose: () => void;
}) {
  const isAuthenticated = authenticatedUser !== null;
  const [draft, setDraft] = useState<ProfileDraft>(() => isAuthenticated ? {
    ...emptyDraft,
    displayName: authenticatedUser.displayName || authenticatedUser.githubLogin,
    githubUrl: authenticatedUser.profileUrl,
  } : loadSavedProfile());
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<ProfileErrors>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [profileLoadStatus, setProfileLoadStatus] = useState<'local' | 'loading' | 'ready' | 'error'>(
    isAuthenticated ? 'loading' : 'local',
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useAccessibleDialog({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  useEffect(() => {
    if (step > 0) stepHeadingRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (!authenticatedUser) return;
    const controller = new AbortController();
    let active = true;
    loadCurrentProfile(controller.signal)
      .then((profile) => {
        if (!active) return;
        if (profile) setDraft(profileToDraft(profile));
        setProfileLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setProfileLoadStatus('error');
        setSaveMessage(
          error instanceof ProfileAPIError && error.status === 401
            ? 'Your session expired. Log in again before saving a profile.'
            : 'Your saved profile could not be loaded. You can retry by reopening this panel.',
        );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authenticatedUser]);

  const updateDraft = (field: DraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage('');
  };

  const persistDraft = () => {
    if (isAuthenticated) {
      setSaveMessage('Complete all three steps to save this profile to your account.');
      return false;
    }
    try {
      window.localStorage.setItem(PROFILE_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setSaveMessage('Profile draft saved on this device.');
      return true;
    } catch {
      setSaveMessage('This browser could not save the profile draft. Your entries remain open.');
      return false;
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateProfileStep(draft, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    if (!isAuthenticated) {
      if (persistDraft()) setIsComplete(true);
      return;
    }

    setIsSaving(true);
    setSaveMessage('');
    try {
      const saved = await saveCurrentProfile({
        displayName: draft.displayName.trim(),
        primaryRole: draft.primaryRole,
        bio: draft.bio.trim(),
        timezone: draft.timezone.trim(),
        weeklyAvailability: draft.weeklyAvailability,
        preferredDuration: draft.preferredDuration,
        workStyle: draft.workStyle,
        communicationCadence: draft.communicationCadence,
        skills: draft.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
        portfolioUrl: draft.portfolioUrl.trim() || null,
        evidenceSummary: draft.evidenceSummary.trim(),
      });
      setDraft(profileToDraft(saved));
      setIsComplete(true);
    } catch (error) {
      setSaveMessage(
        error instanceof ProfileAPIError && error.status === 401
          ? 'Your session expired. Log in again before saving this profile.'
          : 'Your profile could not be saved. Review the fields and try again.',
      );
    } finally {
      setIsSaving(false);
    }
  };

  const describedBy = (field: DraftField) => errors[field] ? `profile-${field}-error` : undefined;

  return (
    <div className="modal-backdrop profile-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="profile-onboarding-title" aria-modal="true" className="profile-panel" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="dialog">
        <header className="profile-header">
          <div><span className="eyebrow">{isAuthenticated ? 'Account profile' : 'Profile onboarding preview'}</span><h2 id="profile-onboarding-title">Make your collaboration fit visible.</h2></div>
          <button aria-label="Close profile onboarding" className="icon-button" onClick={onClose} ref={closeButtonRef} type="button">×</button>
        </header>

        {isComplete ? (
          <div className="profile-complete" role="status">
            <span aria-hidden="true" className="complete-mark">✓</span>
            <span className="eyebrow">{isAuthenticated ? 'Profile saved' : 'Profile draft ready'}</span>
            <h3>{draft.displayName}</h3>
            <p>{isAuthenticated
              ? 'Your profile is saved to your Branch-Out account. It has not been published or verified.'
              : 'Your profile draft is saved on this device. It is not an account and has not been published.'}</p>
            <div className="profile-preview-card">
              <div className="profile-preview-top"><span aria-hidden="true">{draft.displayName.charAt(0).toUpperCase()}</span><div><strong>{draft.primaryRole}</strong><small>{draft.timezone} · {draft.weeklyAvailability}</small></div></div>
              <p>{draft.bio}</p>
              <div className="profile-preview-skills">{draft.skills.split(',').map((skill) => skill.trim()).filter(Boolean).map((skill) => <span key={skill}>{skill}</span>)}</div>
              <a href={draft.githubUrl} rel="noreferrer" target="_blank">View GitHub evidence <span aria-hidden="true">↗</span></a>
            </div>
            <button className="primary-button" onClick={onClose} type="button">Return to homepage</button>
          </div>
        ) : profileLoadStatus === 'loading' ? (
          <div className="profile-loading" role="status">Loading your saved profile…</div>
        ) : (
          <>
            <ol className="profile-progress" aria-label={`Step ${step + 1} of 3`}>
              {['Identity', 'Availability', 'Evidence'].map((label, index) => <li className={index === step ? 'active' : index < step ? 'complete' : ''} key={label}><span>{index + 1}</span>{label}</li>)}
            </ol>

            <form className="profile-form" noValidate onSubmit={handleSubmit}>
              <div className="profile-form-intro">
                <h3 ref={stepHeadingRef} tabIndex={-1}>{step === 0 ? 'How should collaborators understand you?' : step === 1 ? 'When and how do you work best?' : 'What evidence supports your skills?'}</h3>
                <p>{step === 0 ? 'Use a real working identity without exposing private contact details.' : step === 1 ? 'Set expectations before a project starts.' : 'Link evidence and explain what you personally contributed.'}</p>
              </div>

              {step === 0 && <div className="profile-form-grid">
                <label>Display name<input aria-describedby={describedBy('displayName')} aria-invalid={Boolean(errors.displayName)} maxLength={100} onChange={(e) => updateDraft('displayName', e.target.value)} placeholder="Your working name" value={draft.displayName} /><FieldError field="displayName" errors={errors} /></label>
                <label>Primary role<select aria-describedby={describedBy('primaryRole')} aria-invalid={Boolean(errors.primaryRole)} onChange={(e) => updateDraft('primaryRole', e.target.value)} value={draft.primaryRole}><option value="">Select your role</option><option>Software developer</option><option>Product designer</option><option>UX researcher</option><option>Product builder</option></select><FieldError field="primaryRole" errors={errors} /></label>
                <label className="full-field">Short bio<textarea aria-describedby={describedBy('bio')} aria-invalid={Boolean(errors.bio)} maxLength={500} onChange={(e) => updateDraft('bio', e.target.value)} placeholder="Describe what you build, the problems you enjoy, and the teams you work well with." rows={4} value={draft.bio} /><FieldError field="bio" errors={errors} /></label>
                <label>Timezone<input aria-describedby={describedBy('timezone')} aria-invalid={Boolean(errors.timezone)} maxLength={50} onChange={(e) => updateDraft('timezone', e.target.value)} placeholder="e.g. UTC+5:30" value={draft.timezone} /><FieldError field="timezone" errors={errors} /></label>
              </div>}

              {step === 1 && <div className="profile-form-grid">
                <label>Weekly availability<select aria-describedby={describedBy('weeklyAvailability')} aria-invalid={Boolean(errors.weeklyAvailability)} onChange={(e) => updateDraft('weeklyAvailability', e.target.value)} value={draft.weeklyAvailability}><option value="">Select weekly time</option><option>Under 6 hrs/week</option><option>6–8 hrs/week</option><option>8–12 hrs/week</option><option>12+ hrs/week</option></select><FieldError field="weeklyAvailability" errors={errors} /></label>
                <label>Preferred project duration<select aria-describedby={describedBy('preferredDuration')} aria-invalid={Boolean(errors.preferredDuration)} onChange={(e) => updateDraft('preferredDuration', e.target.value)} value={draft.preferredDuration}><option value="">Select duration</option><option>2–4 weeks</option><option>5–8 weeks</option><option>2–3 months</option></select><FieldError field="preferredDuration" errors={errors} /></label>
                <label>Working style<select aria-describedby={describedBy('workStyle')} aria-invalid={Boolean(errors.workStyle)} onChange={(e) => updateDraft('workStyle', e.target.value)} value={draft.workStyle}><option value="">Select a style</option><option>Async-first</option><option>Balanced async and live</option><option>Live collaboration preferred</option></select><FieldError field="workStyle" errors={errors} /></label>
                <label>Communication cadence<select aria-describedby={describedBy('communicationCadence')} aria-invalid={Boolean(errors.communicationCadence)} onChange={(e) => updateDraft('communicationCadence', e.target.value)} value={draft.communicationCadence}><option value="">Select a cadence</option><option>Daily async update</option><option>Three updates per week</option><option>Weekly planning and demo</option></select><FieldError field="communicationCadence" errors={errors} /></label>
              </div>}

              {step === 2 && <div className="profile-form-grid">
                <label className="full-field">Skills to demonstrate<input aria-describedby={describedBy('skills')} aria-invalid={Boolean(errors.skills)} onChange={(e) => updateDraft('skills', e.target.value)} placeholder="TypeScript, React, data visualisation" value={draft.skills} /><FieldError field="skills" errors={errors} /></label>
                <label>GitHub profile<input aria-describedby={describedBy('githubUrl')} aria-invalid={Boolean(errors.githubUrl)} inputMode="url" onChange={(e) => updateDraft('githubUrl', e.target.value)} placeholder="https://github.com/your-name" readOnly={isAuthenticated} type="url" value={draft.githubUrl} /><FieldError field="githubUrl" errors={errors} />{isAuthenticated && <small>Verified from your signed-in GitHub account.</small>}</label>
                <label>Portfolio link <span className="optional-label">Optional</span><input aria-describedby={describedBy('portfolioUrl')} aria-invalid={Boolean(errors.portfolioUrl)} inputMode="url" onChange={(e) => updateDraft('portfolioUrl', e.target.value)} placeholder="https://your-work.example" type="url" value={draft.portfolioUrl} /><FieldError field="portfolioUrl" errors={errors} /></label>
                <label className="full-field">What does this evidence show?<textarea aria-describedby={describedBy('evidenceSummary')} aria-invalid={Boolean(errors.evidenceSummary)} maxLength={500} onChange={(e) => updateDraft('evidenceSummary', e.target.value)} placeholder="Explain the work you personally delivered and the judgment it demonstrates." rows={3} value={draft.evidenceSummary} /><FieldError field="evidenceSummary" errors={errors} /></label>
                <aside className="profile-safety-note full-field"><strong>Public evidence only</strong><p>Link public work or a portfolio page. Never enter passwords, tokens, private repository URLs, or client-confidential information.</p></aside>
              </div>}

              <footer className="profile-actions">
                <div>{isAuthenticated ? <small>Saved to your account when all steps are complete.</small> : <button className="secondary-button" onClick={persistDraft} type="button">Save draft</button>}{saveMessage && <span aria-live="polite" className="save-message">{saveMessage}</span>}</div>
                <div>{step > 0 && <button className="text-button" disabled={isSaving} onClick={() => setStep((current) => current - 1)} type="button">Back</button>}<button className="primary-button" disabled={isSaving || profileLoadStatus === 'error'} type="submit">{isSaving ? 'Saving profile…' : step === 2 ? (isAuthenticated ? 'Save profile' : 'Complete profile draft') : 'Continue'}</button></div>
              </footer>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
