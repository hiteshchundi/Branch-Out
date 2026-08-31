'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { AuthenticatedUser } from '../data/auth';
import {
  ApplicationAPIError,
  loadOwnApplication,
  saveApplicationDraft,
  submitApplication,
  withdrawApplication,
  type ApplicationInput,
  type ManagedApplication,
} from '../data/applications';
import type { ProjectOpening } from '../data/projects';
import { useAccessibleDialog } from './use-accessible-dialog';

export type ApplicationDraft = ApplicationInput;

type DraftField = keyof ApplicationDraft;
type ApplicationErrors = Partial<Record<DraftField, string>>;

const emptyDraft: ApplicationDraft = {
  message: '',
  workSampleUrl: '',
  workSampleContext: '',
  availability: '',
  availabilityConfirmed: false,
  proposedContribution: '',
};

export function applicationDraftStorageKey(projectId: string) {
  return `branch-out-application-draft:${projectId}`;
}

function loadSavedDraft(projectId: string): ApplicationDraft {
  if (typeof window === 'undefined') return emptyDraft;

  try {
    const parsed = JSON.parse(window.localStorage.getItem(applicationDraftStorageKey(projectId)) ?? '{}');
    return {
      message: typeof parsed.message === 'string' ? parsed.message : '',
      workSampleUrl: typeof parsed.workSampleUrl === 'string' ? parsed.workSampleUrl : '',
      workSampleContext: typeof parsed.workSampleContext === 'string' ? parsed.workSampleContext : '',
      availability: typeof parsed.availability === 'string' ? parsed.availability : '',
      availabilityConfirmed: parsed.availabilityConfirmed === true,
      proposedContribution: typeof parsed.proposedContribution === 'string' ? parsed.proposedContribution : '',
    };
  } catch {
    return emptyDraft;
  }
}

function isValidWorkSampleUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Keeps applications brief while requiring enough evidence to be useful to an owner. */
export function validateApplicationDraft(draft: ApplicationDraft): ApplicationErrors {
  const errors: ApplicationErrors = {};
  if (draft.message.trim().length < 30) errors.message = 'Your note should be at least 30 characters.';
  if (!isValidWorkSampleUrl(draft.workSampleUrl.trim())) errors.workSampleUrl = 'Enter a complete http or https link.';
  if (draft.workSampleContext.trim().length < 20) errors.workSampleContext = 'Explain your contribution in at least 20 characters.';
  if (!draft.availability.trim()) errors.availability = 'Confirm the hours you can contribute each week.';
  if (!draft.availabilityConfirmed) errors.availabilityConfirmed = 'Confirm that this availability is accurate.';
  if (draft.proposedContribution.trim().length < 20) errors.proposedContribution = 'Propose a first contribution of at least 20 characters.';
  return errors;
}

function FieldError({ field, errors }: { field: DraftField; errors: ApplicationErrors }) {
  return errors[field] ? <span className="field-error" id={`application-${field}-error`}>{errors[field]}</span> : null;
}

export function ProofApplicationPanel({
  authenticatedUser = null,
  project,
  onClose,
}: {
  authenticatedUser?: AuthenticatedUser | null;
  project: ProjectOpening;
  onClose: () => void;
}) {
  const isAuthenticated = authenticatedUser !== null;
  const [draft, setDraft] = useState<ApplicationDraft>(() => isAuthenticated ? emptyDraft : loadSavedDraft(project.id));
  const [errors, setErrors] = useState<ApplicationErrors>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [applicationStatus, setApplicationStatus] = useState<ManagedApplication['status'] | null>(null);
  const [submitConfirmed, setSubmitConfirmed] = useState(false);
  const [withdrawConfirmed, setWithdrawConfirmed] = useState(false);
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [loadStatus, setLoadStatus] = useState<'local' | 'loading' | 'ready' | 'error'>(
    isAuthenticated ? 'loading' : 'local',
  );
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useAccessibleDialog({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  useEffect(() => {
    if (!authenticatedUser) return;
    const controller = new AbortController();
    let active = true;
    loadOwnApplication(project.id, controller.signal)
      .then((application) => {
        if (!active) return;
        if (application) {
          setDraft(application.input);
          setApplicationStatus(application.status);
          if (application.status !== 'draft') setIsComplete(true);
        }
        setLoadStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setLoadStatus('error');
        setSaveMessage(
          error instanceof ApplicationAPIError && error.status === 401
            ? 'Your session expired. Log in again before managing this application.'
            : 'Your account application could not be loaded. Close and reopen this panel to retry.',
        );
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [authenticatedUser, project.id]);

  const updateDraft = <Field extends DraftField>(field: Field, value: ApplicationDraft[Field]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage('');
  };

  const persistLocalDraft = () => {
    try {
      window.localStorage.setItem(applicationDraftStorageKey(project.id), JSON.stringify(draft));
      setSaveMessage('Application draft saved on this device.');
      return true;
    } catch {
      setSaveMessage('This browser could not save the draft. Your current entries are still open.');
      return false;
    }
  };

  const saveAccountDraft = async (complete: boolean) => {
    const nextErrors = validateApplicationDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      setSaveMessage('Complete every application field before saving it to your account.');
      return false;
    }
    setIsSaving(true);
    setSaveMessage('');
    try {
      const saved = await saveApplicationDraft(project.id, draft);
      setDraft(saved.input);
      setApplicationStatus(saved.status);
      if (complete) setIsComplete(true);
      else setSaveMessage('Private application draft saved to your account. It has not been submitted.');
      return true;
    } catch (error) {
      if (error instanceof ApplicationAPIError && error.field && error.field in draft) {
        setErrors((current) => ({ ...current, [error.field as DraftField]: 'Review this field and try again.' }));
      }
      setSaveMessage(
        error instanceof ApplicationAPIError && error.status === 401
          ? 'Your session expired. Log in again before saving this application.'
          : error instanceof ApplicationAPIError && error.code === 'profile_required'
            ? 'Complete your collaboration profile before saving an application.'
            : error instanceof ApplicationAPIError && error.code === 'application_unavailable'
              ? 'This opening is unavailable, belongs to you, or already has a submitted application.'
              : 'Your application draft could not be saved. Review the fields and try again.',
      );
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const saveDraft = async () => {
    if (isAuthenticated) await saveAccountDraft(false);
    else persistLocalDraft();
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateApplicationDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (isAuthenticated) await saveAccountDraft(true);
    else if (persistLocalDraft()) setIsComplete(true);
  };

  const handleApplicationSubmission = async () => {
    if (!isAuthenticated || applicationStatus !== 'draft' || !submitConfirmed) return;
    setIsSubmitting(true);
    setSaveMessage('');
    try {
      const submitted = await submitApplication(project.id);
      setDraft(submitted.input);
      setApplicationStatus(submitted.status);
      setSubmitConfirmed(false);
      setSaveMessage('Your application has been submitted and can no longer be edited.');
    } catch (error) {
      setSaveMessage(
        error instanceof ApplicationAPIError && error.status === 401
          ? 'Your session expired. Log in again before submitting this application.'
          : error instanceof ApplicationAPIError && error.code === 'application_unavailable'
            ? 'This application cannot be submitted. The opening may have closed or the application may already be submitted.'
            : 'Your application could not be submitted. Please try again.',
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdrawal = async () => {
    if (!isAuthenticated || applicationStatus !== 'submitted' || !withdrawConfirmed) return;
    setIsWithdrawing(true);
    setSaveMessage('');
    try {
      const withdrawn = await withdrawApplication(project.id);
      setApplicationStatus(withdrawn.status);
      setWithdrawConfirmed(false);
      setSaveMessage('Your application was withdrawn and can no longer be decided.');
    } catch (error) {
      setSaveMessage(
        error instanceof ApplicationAPIError && error.status === 401
          ? 'Your session expired. Log in again before withdrawing this application.'
          : error instanceof ApplicationAPIError && error.code === 'application_withdrawal_unavailable'
            ? 'This application was already decided, withdrawn, or is no longer available.'
            : 'Your application could not be withdrawn. Please try again.',
      );
    } finally {
      setIsWithdrawing(false);
    }
  };

  const describedBy = (field: DraftField) => errors[field] ? `application-${field}-error` : undefined;

  return (
    <div className="modal-backdrop application-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        aria-labelledby="application-title"
        aria-modal="true"
        className="application-panel"
        onMouseDown={(event) => event.stopPropagation()}
        ref={dialogRef}
        role="dialog"
      >
        <header className="application-header">
          <div>
            <span className="eyebrow">Proof-led application</span>
            <h2 id="application-title">Show why this specific project fits.</h2>
          </div>
          <button aria-label="Close application" className="icon-button" onClick={onClose} ref={closeButtonRef} type="button">×</button>
        </header>

        <div className="application-project-context">
          <div><span>{project.role}</span><strong>{project.title}</strong></div>
          <dl>
            <div><dt>Time</dt><dd>{project.commitment}</dd></div>
            <div><dt>Trial</dt><dd>{project.firstMilestone}</dd></div>
          </dl>
        </div>

        {loadStatus === 'loading' ? (
          <div className="application-loading" role="status">Loading your application…</div>
        ) : isComplete ? (
          <div className="application-complete">
            <div className="application-complete-announcement" role="status">
              <span aria-hidden="true" className="complete-mark">✓</span>
              <span className="eyebrow">
                {applicationStatus === 'accepted' ? 'Application accepted' : applicationStatus === 'declined' ? 'Application declined' : applicationStatus === 'withdrawn' ? 'Application withdrawn' : applicationStatus === 'submitted' ? 'Application submitted' : 'Application ready'}
              </span>
              <h3>
                {applicationStatus === 'accepted' ? 'The opening owner accepted your application.' : applicationStatus === 'declined' ? 'The opening owner declined your application.' : applicationStatus === 'withdrawn' ? 'You withdrew this application.' : applicationStatus === 'submitted' ? 'Your application is submitted.' : 'Your proof-led draft is complete.'}
              </h3>
              <p>
                {applicationStatus === 'accepted'
                  ? 'This decision is stored in your Branch-Out account. Next-step coordination and messaging are not available yet.'
                  : applicationStatus === 'declined'
                    ? 'This decision is stored in your Branch-Out account. The application remains read-only and private to you and the opening owner.'
                    : applicationStatus === 'withdrawn'
                      ? 'The withdrawal is stored in your Branch-Out account. The opening owner can see it, and the application cannot be submitted again.'
                      : applicationStatus === 'submitted'
                      ? 'It is stored in your Branch-Out account and can no longer be edited. The opening owner can review and decide it privately.'
                  : isAuthenticated
                    ? 'It is saved privately to your Branch-Out account and has not been submitted.'
                    : 'It is saved on this device and has not been sent.'}
              </p>
            </div>
            <div className="application-summary">
              <span>Relevant sample</span><strong>{draft.workSampleUrl}</strong>
              <span>Confirmed availability</span><strong>{draft.availability}</strong>
              <span>Proposed contribution</span><strong>{draft.proposedContribution}</strong>
            </div>
            {isAuthenticated && applicationStatus === 'draft' && (
              <div className="application-submit-confirmation">
                <label>
                  <input checked={submitConfirmed} onChange={(event) => setSubmitConfirmed(event.target.checked)} type="checkbox" />
                  <span>I reviewed this application and understand it cannot be edited after submission.</span>
                </label>
                <button className="primary-button" disabled={!submitConfirmed || isSubmitting} onClick={handleApplicationSubmission} type="button">
                  {isSubmitting ? 'Submitting…' : 'Submit application'}
                </button>
              </div>
            )}
            {isAuthenticated && applicationStatus === 'submitted' && (
              <div className="application-submit-confirmation application-withdraw-confirmation">
                <label>
                  <input checked={withdrawConfirmed} onChange={(event) => setWithdrawConfirmed(event.target.checked)} type="checkbox" />
                  <span>I understand withdrawal is permanent and I cannot submit another application for this opening.</span>
                </label>
                <button className="secondary-button danger-button" disabled={!withdrawConfirmed || isWithdrawing} onClick={handleWithdrawal} type="button">
                  {isWithdrawing ? 'Withdrawing…' : 'Withdraw application'}
                </button>
              </div>
            )}
            {saveMessage && <p aria-live="polite" className="save-message">{saveMessage}</p>}
            <button className="primary-button" onClick={onClose} type="button">Return to opening</button>
          </div>
        ) : (
          <form className="application-form" noValidate onSubmit={handleSubmit}>
            <div className="application-fields">
              <label>Short note to the project owner
                <textarea aria-describedby={describedBy('message')} aria-invalid={Boolean(errors.message)} onChange={(e) => updateDraft('message', e.target.value)} placeholder="Explain why this project and your experience are a strong fit." rows={4} value={draft.message} />
                <FieldError field="message" errors={errors} />
              </label>

              <div className="application-sample-fields">
                <label>One relevant work sample
                  <input aria-describedby={describedBy('workSampleUrl')} aria-invalid={Boolean(errors.workSampleUrl)} inputMode="url" onChange={(e) => updateDraft('workSampleUrl', e.target.value)} placeholder="https://github.com/you/relevant-project" type="url" value={draft.workSampleUrl} />
                  <FieldError field="workSampleUrl" errors={errors} />
                </label>
                <label>What was your contribution?
                  <input aria-describedby={describedBy('workSampleContext')} aria-invalid={Boolean(errors.workSampleContext)} onChange={(e) => updateDraft('workSampleContext', e.target.value)} placeholder="Describe the part you personally delivered." value={draft.workSampleContext} />
                  <FieldError field="workSampleContext" errors={errors} />
                </label>
              </div>

              <label>Availability for this project
                <input aria-describedby={describedBy('availability')} aria-invalid={Boolean(errors.availability)} onChange={(e) => updateDraft('availability', e.target.value)} placeholder={`e.g. ${project.commitment}, starting next Monday`} value={draft.availability} />
                <FieldError field="availability" errors={errors} />
              </label>

              <label>Proposed first contribution
                <textarea aria-describedby={describedBy('proposedContribution')} aria-invalid={Boolean(errors.proposedContribution)} onChange={(e) => updateDraft('proposedContribution', e.target.value)} placeholder="Suggest one small contribution you could make before or during the trial." rows={3} value={draft.proposedContribution} />
                <FieldError field="proposedContribution" errors={errors} />
              </label>

              <label className="availability-confirmation">
                <input aria-describedby={describedBy('availabilityConfirmed')} aria-invalid={Boolean(errors.availabilityConfirmed)} checked={draft.availabilityConfirmed} onChange={(e) => updateDraft('availabilityConfirmed', e.target.checked)} type="checkbox" />
                <span>I confirm that the availability above is realistic for the stated project duration.</span>
              </label>
              <FieldError field="availabilityConfirmed" errors={errors} />
            </div>

            <aside className="application-proof-guide">
              <span className="eyebrow">A strong application</span>
              <h3>One signal is better than ten claims.</h3>
              <ol>
                <li><span>01</span><div><strong>Be specific</strong><p>Write for this project, not every opening.</p></div></li>
                <li><span>02</span><div><strong>Show your part</strong><p>Link one sample and explain what you delivered.</p></div></li>
                <li><span>03</span><div><strong>Start small</strong><p>Suggest a contribution that reduces risk for both people.</p></div></li>
              </ol>
              <p className="application-privacy-note">
                {isAuthenticated
                  ? 'Saving keeps this draft private. Submission is a separate, explicit step.'
                  : 'Your draft stays in this browser. Branch-Out does not send it anywhere.'}
              </p>
            </aside>

            <footer className="application-actions">
              <div>
                <button className="secondary-button" disabled={isSaving || loadStatus === 'error'} onClick={saveDraft} type="button">{isSaving ? 'Saving draft…' : 'Save draft'}</button>
                {saveMessage && <span aria-live="polite" className="save-message">{saveMessage}</span>}
              </div>
              <button className="primary-button" disabled={isSaving || loadStatus === 'error'} type="submit">{isSaving ? 'Saving draft…' : isAuthenticated ? 'Save private application' : 'Complete application draft'}</button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
