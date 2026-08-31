'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { AuthenticatedUser } from '../data/auth';
import {
  ApplicationAPIError,
  listSubmittedApplications,
  type OwnerApplication,
} from '../data/applications';
import {
  closeOpening,
  createOpeningDraft,
  listOwnedOpenings,
  OpeningDraftAPIError,
  publishOpening,
  updateOpeningDraft,
  type OpeningDraftInput,
  type PublicationStatus,
} from '../data/opening-drafts';
import { useAccessibleDialog } from './use-accessible-dialog';

export const OPENING_DRAFT_STORAGE_KEY = 'branch-out-opening-draft';

export type OpeningDraft = {
  projectName: string;
  problem: string;
  role: string;
  skills: string;
  commitment: string;
  duration: string;
  timezone: string;
  compensation: string;
  firstMilestone: string;
  ownerContribution: string;
  confidentiality: string;
};

type DraftField = keyof OpeningDraft;
type ValidationErrors = Partial<Record<DraftField, string>>;

const emptyDraft: OpeningDraft = {
  projectName: '',
  problem: '',
  role: '',
  skills: '',
  commitment: '',
  duration: '',
  timezone: '',
  compensation: '',
  firstMilestone: '',
  ownerContribution: '',
  confidentiality: '',
};

const stepFields: DraftField[][] = [
  ['projectName', 'problem', 'role', 'skills'],
  ['commitment', 'duration', 'timezone', 'compensation'],
  ['firstMilestone', 'ownerContribution', 'confidentiality'],
];

const supportedValues: Partial<Record<DraftField, string[]>> = {
  role: ['Frontend engineer', 'Backend engineer', 'Product designer', 'UX researcher'],
  commitment: ['Under 6 hrs/week', '6–8 hrs/week', '8+ hrs/week'],
  duration: ['2–4 weeks', '5–8 weeks', '2–3 months'],
  compensation: ['Paid', 'Fixed bounty', 'Revenue share', 'Unpaid / portfolio'],
  confidentiality: ['Public', 'Limited details', 'Confidential after agreement'],
};

const fieldLabels: Record<DraftField, string> = {
  projectName: 'Project name',
  problem: 'Problem and desired outcome',
  role: 'Open role',
  skills: 'Must-have skills',
  commitment: 'Weekly commitment',
  duration: 'Expected duration',
  timezone: 'Timezone overlap',
  compensation: 'Compensation',
  firstMilestone: 'First two-week milestone',
  ownerContribution: 'Your existing contribution',
  confidentiality: 'Confidentiality level',
};

function loadSavedDraft(): OpeningDraft {
  if (typeof window === 'undefined') return emptyDraft;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(OPENING_DRAFT_STORAGE_KEY) ?? '{}');
    return Object.fromEntries(
      Object.keys(emptyDraft).map((key) => {
        const field = key as DraftField;
        return [field, typeof parsed[field] === 'string' ? parsed[field] : ''];
      }),
    ) as unknown as OpeningDraft;
  } catch {
    return emptyDraft;
  }
}

/** Validates only the current step so people can progress without hidden errors. */
export function validateOpeningStep(draft: OpeningDraft, step: number): ValidationErrors {
  return stepFields[step].reduce<ValidationErrors>((errors, field) => {
    const value = draft[field].trim();
    if (!value) errors[field] = `${fieldLabels[field]} is required.`;
    if (value && supportedValues[field] && !supportedValues[field]?.includes(value)) {
      errors[field] = `Select a supported ${fieldLabels[field].toLowerCase()}.`;
    }
    if (field === 'projectName' && value && (value.length < 3 || value.length > 80)) {
      errors[field] = 'Project name should contain 3 to 80 characters.';
    }
    if ((field === 'problem' || field === 'firstMilestone' || field === 'ownerContribution') && value && value.length < 20) {
      errors[field] = `${fieldLabels[field]} should be at least 20 characters.`;
    }
    if (field === 'problem' && value.length > 240) errors[field] = 'Use 240 characters or fewer.';
    if ((field === 'firstMilestone' || field === 'ownerContribution') && value.length > 500) {
      errors[field] = 'Use 500 characters or fewer.';
    }
    if (field === 'timezone' && value && (value.length < 3 || value.length > 80)) {
      errors[field] = 'Timezone overlap should contain 3 to 80 characters.';
    }
    if (field === 'skills' && value) {
      const skills = value.split(',').map((skill) => skill.trim()).filter(Boolean);
      const normalized = skills.map((skill) => skill.toLowerCase());
      if (skills.length > 12) errors[field] = 'Add no more than 12 skills.';
      else if (skills.some((skill) => skill.length > 40)) errors[field] = 'Keep each skill to 40 characters or fewer.';
      else if (new Set(normalized).size !== normalized.length) errors[field] = 'List each skill only once.';
    }
    return errors;
  }, {});
}

function validateOpeningDraft(draft: OpeningDraft) {
  return stepFields.reduce<ValidationErrors>(
    (allErrors, _, index) => ({ ...allErrors, ...validateOpeningStep(draft, index) }),
    {},
  );
}

function toAPIInput(draft: OpeningDraft): OpeningDraftInput {
  return {
    ...draft,
    projectName: draft.projectName.trim(),
    problem: draft.problem.trim(),
    skills: draft.skills.split(',').map((skill) => skill.trim()).filter(Boolean),
    timezone: draft.timezone.trim(),
    firstMilestone: draft.firstMilestone.trim(),
    ownerContribution: draft.ownerContribution.trim(),
  };
}

function fromAPIInput(input: OpeningDraftInput): OpeningDraft {
  return { ...input, skills: input.skills.join(', ') };
}

function FieldError({ field, errors }: { field: DraftField; errors: ValidationErrors }) {
  return errors[field] ? <span className="field-error" id={`${field}-error`}>{errors[field]}</span> : null;
}

export function CreateOpeningPanel({
  authenticatedUser = null,
  onClose,
  onOpeningChanged,
}: {
  authenticatedUser?: AuthenticatedUser | null;
  onClose: () => void;
  onOpeningChanged?: () => void;
}) {
  const isAuthenticated = authenticatedUser !== null;
  const [draft, setDraft] = useState<OpeningDraft>(() => isAuthenticated ? emptyDraft : loadSavedDraft());
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);
  const [openingID, setOpeningID] = useState<string | null>(null);
  const [openingStatus, setOpeningStatus] = useState<PublicationStatus | null>(null);
  const [publishConfirmed, setPublishConfirmed] = useState(false);
  const [closeConfirmed, setCloseConfirmed] = useState(false);
  const [transitionMessage, setTransitionMessage] = useState('');
  const [loadStatus, setLoadStatus] = useState<'local' | 'loading' | 'ready' | 'error'>(
    isAuthenticated ? 'loading' : 'local',
  );
  const [reviewApplications, setReviewApplications] = useState<OwnerApplication[]>([]);
  const [reviewStatus, setReviewStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
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
    listOwnedOpenings(controller.signal)
      .then((openings) => {
        if (!active) return;
        if (openings[0]) {
          setOpeningID(openings[0].id);
          setOpeningStatus(openings[0].publicationStatus);
          setDraft(fromAPIInput(openings[0].input));
        }
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadStatus('error');
        setSaveMessage(
          error instanceof OpeningDraftAPIError && error.status === 401
            ? 'Your session expired. Log in again before saving an opening.'
            : 'Your account drafts could not be loaded. Close and reopen this panel to retry.',
        );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authenticatedUser]);

  useEffect(() => {
    if (!authenticatedUser || !openingID || openingStatus === null || openingStatus === 'draft') {
      setReviewApplications([]);
      setReviewStatus('idle');
      return;
    }
    const controller = new AbortController();
    let active = true;
    setReviewStatus('loading');
    listSubmittedApplications(openingID, controller.signal)
      .then((applications) => {
        if (!active) return;
        setReviewApplications(applications);
        setReviewStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setReviewStatus('error');
        if (error instanceof ApplicationAPIError && error.status === 401) {
          setTransitionMessage('Your session expired. Log in again before reviewing applications.');
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authenticatedUser, openingID, openingStatus]);

  const updateDraft = (field: DraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage('');
  };

  const saveLocalDraft = () => {
    try {
      window.localStorage.setItem(OPENING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setSaveMessage('Draft saved on this device.');
      return true;
    } catch {
      setSaveMessage('This browser could not save the draft. Your current entries are still open.');
      return false;
    }
  };

  const saveAccountDraft = async (complete: boolean) => {
    const allErrors = validateOpeningDraft(draft);
    if (Object.keys(allErrors).length > 0) {
      setErrors(validateOpeningStep(draft, step));
      setSaveMessage('Complete all three steps before saving this draft to your account.');
      return false;
    }
    setIsSaving(true);
    setSaveMessage('');
    try {
      const saved = openingID
        ? await updateOpeningDraft(openingID, toAPIInput(draft))
        : await createOpeningDraft(toAPIInput(draft));
      setOpeningID(saved.id);
      setOpeningStatus(saved.publicationStatus);
      setDraft(fromAPIInput(saved.input));
      if (complete) setIsComplete(true);
      else setSaveMessage('Private draft saved to your account. It has not been published.');
      return true;
    } catch (error) {
      if (error instanceof OpeningDraftAPIError && error.field && error.field in draft) {
        setErrors((current) => ({ ...current, [error.field as DraftField]: 'Review this field and try again.' }));
      }
      setSaveMessage(
        error instanceof OpeningDraftAPIError && error.status === 401
          ? 'Your session expired. Log in again before saving this opening.'
          : error instanceof OpeningDraftAPIError && error.status === 409
            ? 'Complete your collaboration profile before saving an opening to your account.'
            : error instanceof OpeningDraftAPIError && error.status === 404
              ? 'This draft is no longer editable. Close and reopen the panel to reload your drafts.'
              : 'Your opening draft could not be saved. Review the fields and try again.',
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveDraft = async () => {
    if (isAuthenticated) await saveAccountDraft(false);
    else saveLocalDraft();
  };

  const handleStepSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateOpeningStep(draft, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }

    if (isAuthenticated) await saveAccountDraft(true);
    else if (saveLocalDraft()) setIsComplete(true);
  };

  const transitionErrorMessage = (error: unknown, action: 'published' | 'closed') => {
    if (error instanceof OpeningDraftAPIError && error.status === 401) {
      return `Your session expired. Log in again before this opening can be ${action}.`;
    }
    if (error instanceof OpeningDraftAPIError && error.status === 404) {
      return 'This opening changed or is no longer available. Close and reopen the panel to refresh it.';
    }
    return `This opening could not be ${action}. Please try again.`;
  };

  const handlePublish = async () => {
    if (!openingID || openingStatus !== 'draft' || !publishConfirmed) return;
    setIsTransitioning(true);
    setTransitionMessage('');
    try {
      const published = await publishOpening(openingID);
      setOpeningStatus(published.publicationStatus);
      setDraft(fromAPIInput(published.input));
      setPublishConfirmed(false);
      setTransitionMessage('Your opening is now visible in public discovery.');
      onOpeningChanged?.();
    } catch (error) {
      setTransitionMessage(transitionErrorMessage(error, 'published'));
    } finally {
      setIsTransitioning(false);
    }
  };

  const handleCloseOpening = async () => {
    if (!openingID || openingStatus !== 'published' || !closeConfirmed) return;
    setIsTransitioning(true);
    setTransitionMessage('');
    try {
      const closed = await closeOpening(openingID);
      setOpeningStatus(closed.publicationStatus);
      setDraft(fromAPIInput(closed.input));
      setCloseConfirmed(false);
      setTransitionMessage('The opening has been removed from public discovery.');
      onOpeningChanged?.();
    } catch (error) {
      setTransitionMessage(transitionErrorMessage(error, 'closed'));
    } finally {
      setIsTransitioning(false);
    }
  };

  const startAnotherDraft = () => {
    setDraft(emptyDraft);
    setStep(0);
    setErrors({});
    setSaveMessage('');
    setTransitionMessage('');
    setOpeningID(null);
    setOpeningStatus(null);
    setIsComplete(false);
  };

  const describedBy = (field: DraftField) => errors[field] ? `${field}-error` : undefined;

  return (
    <div className="modal-backdrop create-opening-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="create-opening-title"
        aria-modal="true"
        className="create-opening-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <header className="create-opening-header">
          <div>
            <span className="eyebrow">{isAuthenticated ? 'Account opening' : 'Opening preview'}</span>
            <h2 id="create-opening-title">Start with a clear, safe first step.</h2>
          </div>
          <button
            aria-label="Close create opening"
            className="icon-button"
            onClick={onClose}
            ref={closeButtonRef}
            type="button"
          >
            ×
          </button>
        </header>

        {isComplete || (isAuthenticated && openingStatus !== null && openingStatus !== 'draft') ? (
          <div className="opening-complete">
            <div className="opening-complete-announcement" role="status">
              <span aria-hidden="true" className="complete-mark">✓</span>
              <span className="eyebrow">
                {openingStatus === 'published'
                  ? 'Published opening'
                  : openingStatus === 'closed'
                    ? 'Opening closed'
                    : isAuthenticated ? 'Private draft saved' : 'Draft ready'}
              </span>
              <h3>{draft.projectName}</h3>
              <p>
                {openingStatus === 'published'
                  ? 'This opening is visible in public discovery. Close it when you are no longer accepting collaborators.'
                  : openingStatus === 'closed'
                    ? 'This opening is no longer visible in public discovery. Closed openings cannot be reopened.'
                    : isAuthenticated
                      ? 'Your opening draft is saved privately to your Branch-Out account. It has not been published.'
                      : 'Your opening draft is saved on this device. It has not been published.'}
              </p>
            </div>
            <dl>
              <div><dt>Role</dt><dd>{draft.role}</dd></div>
              <div><dt>Commitment</dt><dd>{draft.commitment}</dd></div>
              <div><dt>Compensation</dt><dd>{draft.compensation}</dd></div>
              <div><dt>First milestone</dt><dd>{draft.firstMilestone}</dd></div>
            </dl>
            {isAuthenticated && (openingStatus === 'published' || openingStatus === 'closed') && (
              <section aria-labelledby="submitted-applications-title" className="owner-application-review">
                <div className="owner-application-review-heading">
                  <div>
                    <span className="eyebrow">Private owner review</span>
                    <h4 id="submitted-applications-title">Submitted applications</h4>
                  </div>
                  {reviewStatus === 'ready' && <strong>{reviewApplications.length}</strong>}
                </div>
                {reviewStatus === 'loading' && <p role="status">Loading submitted applications…</p>}
                {reviewStatus === 'error' && (
                  <p role="alert">Submitted applications could not be loaded. Close and reopen this panel to retry.</p>
                )}
                {reviewStatus === 'ready' && reviewApplications.length === 0 && (
                  <p>No submitted applications yet. Applicant drafts remain private.</p>
                )}
                {reviewStatus === 'ready' && reviewApplications.length > 0 && (
                  <ol className="owner-application-list">
                    {reviewApplications.map((application) => (
                      <li className="owner-application-card" key={application.id}>
                        <header>
                          <div>
                            <strong>{application.applicant.displayName}</strong>
                            <span>{application.applicant.primaryRole}</span>
                          </div>
                          <time dateTime={application.submittedAt}>
                            Submitted {new Date(application.submittedAt).toLocaleDateString('en-GB', { dateStyle: 'medium', timeZone: 'UTC' })}
                          </time>
                        </header>
                        <p>{application.input.message}</p>
                        <dl>
                          <div><dt>Contribution shown</dt><dd>{application.input.workSampleContext}</dd></div>
                          <div><dt>Availability</dt><dd>{application.input.availability}</dd></div>
                          <div><dt>Proposed first step</dt><dd>{application.input.proposedContribution}</dd></div>
                          <div><dt>Profile evidence</dt><dd>{application.applicant.evidenceSummary}</dd></div>
                        </dl>
                        <div className="owner-application-skills" aria-label="Applicant skills">
                          {application.applicant.skills.map((skill) => <span key={skill}>{skill}</span>)}
                        </div>
                        <div className="owner-application-links">
                          <a href={application.input.workSampleUrl} rel="noreferrer" target="_blank">View work sample</a>
                          <a href={application.applicant.githubUrl} rel="noreferrer" target="_blank">GitHub profile</a>
                          {application.applicant.portfolioUrl && (
                            <a href={application.applicant.portfolioUrl} rel="noreferrer" target="_blank">Portfolio</a>
                          )}
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
                <p className="owner-application-review-note">Decisions and messaging are not available yet. Reviewing an application does not notify the applicant.</p>
              </section>
            )}
            {isAuthenticated && openingStatus === 'draft' && (
              <div className="opening-lifecycle-confirmation">
                <label>
                  <input
                    checked={publishConfirmed}
                    onChange={(event) => setPublishConfirmed(event.target.checked)}
                    type="checkbox"
                  />
                  <span>I reviewed this opening and confirm its details are safe to publish publicly.</span>
                </label>
                <button
                  className="primary-button"
                  disabled={!publishConfirmed || isTransitioning}
                  onClick={handlePublish}
                  type="button"
                >
                  {isTransitioning ? 'Publishing…' : 'Publish opening'}
                </button>
              </div>
            )}
            {isAuthenticated && openingStatus === 'published' && (
              <div className="opening-lifecycle-confirmation">
                <label>
                  <input
                    checked={closeConfirmed}
                    onChange={(event) => setCloseConfirmed(event.target.checked)}
                    type="checkbox"
                  />
                  <span>I understand closing removes this opening from public discovery and reopening is not available.</span>
                </label>
                <button
                  className="secondary-button danger-button"
                  disabled={!closeConfirmed || isTransitioning}
                  onClick={handleCloseOpening}
                  type="button"
                >
                  {isTransitioning ? 'Closing…' : 'Close opening'}
                </button>
              </div>
            )}
            {transitionMessage && <p aria-live="polite" className="save-message">{transitionMessage}</p>}
            <div className="opening-complete-actions">
              {isAuthenticated && openingStatus === 'closed' && (
                <button className="secondary-button" onClick={startAnotherDraft} type="button">Start another draft</button>
              )}
              <button className="primary-button" onClick={onClose} type="button">Return to openings</button>
            </div>
          </div>
        ) : loadStatus === 'loading' ? (
          <div className="opening-loading" role="status">Loading your latest opening…</div>
        ) : (
          <>
            {/* Progress labels keep the three-part form understandable at a glance. */}
            <ol className="opening-progress" aria-label={`Step ${step + 1} of 3`}>
              {['Project', 'Commitment', 'Trial'].map((label, index) => (
                <li className={index === step ? 'active' : index < step ? 'complete' : ''} key={label}>
                  <span>{index + 1}</span>{label}
                </li>
              ))}
            </ol>

            <form className="opening-form" noValidate onSubmit={handleStepSubmit}>
              <h3 ref={stepHeadingRef} tabIndex={-1}>
                {step === 0 && 'What are you building?'}
                {step === 1 && 'What commitment are you asking for?'}
                {step === 2 && 'How will the trial stay focused and safe?'}
              </h3>

              {step === 0 && (
                <div className="form-grid">
                  <label className="full-field">Project name
                    <input aria-describedby={describedBy('projectName')} aria-invalid={Boolean(errors.projectName)} onChange={(e) => updateDraft('projectName', e.target.value)} placeholder="e.g. Local climate data explorer" value={draft.projectName} />
                    <FieldError field="projectName" errors={errors} />
                  </label>
                  <label className="full-field">Problem and desired outcome
                    <textarea aria-describedby={describedBy('problem')} aria-invalid={Boolean(errors.problem)} onChange={(e) => updateDraft('problem', e.target.value)} placeholder="Explain the problem and what a successful outcome looks like." rows={4} value={draft.problem} />
                    <FieldError field="problem" errors={errors} />
                  </label>
                  <label>Open role
                    <select aria-describedby={describedBy('role')} aria-invalid={Boolean(errors.role)} onChange={(e) => updateDraft('role', e.target.value)} value={draft.role}>
                      <option value="">Select a role</option><option>Frontend engineer</option><option>Backend engineer</option><option>Product designer</option><option>UX researcher</option>
                    </select>
                    <FieldError field="role" errors={errors} />
                  </label>
                  <label>Must-have skills
                    <input aria-describedby={describedBy('skills')} aria-invalid={Boolean(errors.skills)} onChange={(e) => updateDraft('skills', e.target.value)} placeholder="TypeScript, React, data visualisation" value={draft.skills} />
                    <FieldError field="skills" errors={errors} />
                  </label>
                </div>
              )}

              {step === 1 && (
                <div className="form-grid">
                  <label>Weekly commitment
                    <select aria-describedby={describedBy('commitment')} aria-invalid={Boolean(errors.commitment)} onChange={(e) => updateDraft('commitment', e.target.value)} value={draft.commitment}>
                      <option value="">Select weekly time</option><option>Under 6 hrs/week</option><option>6–8 hrs/week</option><option>8+ hrs/week</option>
                    </select>
                    <FieldError field="commitment" errors={errors} />
                  </label>
                  <label>Expected duration
                    <select aria-describedby={describedBy('duration')} aria-invalid={Boolean(errors.duration)} onChange={(e) => updateDraft('duration', e.target.value)} value={draft.duration}>
                      <option value="">Select duration</option><option>2–4 weeks</option><option>5–8 weeks</option><option>2–3 months</option>
                    </select>
                    <FieldError field="duration" errors={errors} />
                  </label>
                  <label>Timezone overlap
                    <input aria-describedby={describedBy('timezone')} aria-invalid={Boolean(errors.timezone)} onChange={(e) => updateDraft('timezone', e.target.value)} placeholder="e.g. UTC to UTC+4" value={draft.timezone} />
                    <FieldError field="timezone" errors={errors} />
                  </label>
                  <label>Compensation
                    <select aria-describedby={describedBy('compensation')} aria-invalid={Boolean(errors.compensation)} onChange={(e) => updateDraft('compensation', e.target.value)} value={draft.compensation}>
                      <option value="">Select compensation</option><option>Paid</option><option>Fixed bounty</option><option>Revenue share</option><option>Unpaid / portfolio</option>
                    </select>
                    <FieldError field="compensation" errors={errors} />
                  </label>
                </div>
              )}

              {step === 2 && (
                <div className="form-grid">
                  <label className="full-field">First two-week milestone
                    <textarea aria-describedby={describedBy('firstMilestone')} aria-invalid={Boolean(errors.firstMilestone)} onChange={(e) => updateDraft('firstMilestone', e.target.value)} placeholder="Describe one small, reversible result for the trial." rows={3} value={draft.firstMilestone} />
                    <FieldError field="firstMilestone" errors={errors} />
                  </label>
                  <label className="full-field">Your existing contribution
                    <textarea aria-describedby={describedBy('ownerContribution')} aria-invalid={Boolean(errors.ownerContribution)} onChange={(e) => updateDraft('ownerContribution', e.target.value)} placeholder="Show what you have already built, researched, or validated." rows={3} value={draft.ownerContribution} />
                    <FieldError field="ownerContribution" errors={errors} />
                  </label>
                  <label className="full-field">Confidentiality level
                    <select aria-describedby={describedBy('confidentiality')} aria-invalid={Boolean(errors.confidentiality)} onChange={(e) => updateDraft('confidentiality', e.target.value)} value={draft.confidentiality}>
                      <option value="">Select a level</option><option>Public</option><option>Limited details</option><option>Confidential after agreement</option>
                    </select>
                    <FieldError field="confidentiality" errors={errors} />
                  </label>
                  <aside className="responsibility-note">
                    <strong>Keep the trial safe</strong>
                    <p>Share only what is needed. Your team controls contracts, IP, credentials, repository access, and offboarding.</p>
                  </aside>
                </div>
              )}

              <footer className="opening-form-actions">
                <div>
                  <button className="secondary-button" disabled={isSaving || loadStatus === 'error'} onClick={saveDraft} type="button">{isSaving ? 'Saving draft…' : 'Save draft'}</button>
                  {saveMessage && <span aria-live="polite" className="save-message">{saveMessage}</span>}
                </div>
                <div>
                  {step > 0 && <button className="text-button" disabled={isSaving} onClick={() => setStep((current) => current - 1)} type="button">Back</button>}
                  <button className="primary-button" disabled={isSaving || loadStatus === 'error'} type="submit">{isSaving ? 'Saving draft…' : step === 2 ? (isAuthenticated ? 'Save private draft' : 'Complete draft') : 'Continue'}</button>
                </div>
              </footer>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
