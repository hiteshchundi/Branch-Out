'use client';

import { FormEvent, useRef, useState } from 'react';
import type { ProjectOpening } from '../data/projects';
import { useAccessibleDialog } from './use-accessible-dialog';

export type ApplicationDraft = {
  message: string;
  workSampleUrl: string;
  workSampleContext: string;
  availability: string;
  availabilityConfirmed: boolean;
  proposedContribution: string;
};

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
  project,
  onClose,
}: {
  project: ProjectOpening;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<ApplicationDraft>(() => loadSavedDraft(project.id));
  const [errors, setErrors] = useState<ApplicationErrors>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useAccessibleDialog({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  const updateDraft = <Field extends DraftField>(field: Field, value: ApplicationDraft[Field]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage('');
  };

  const persistDraft = () => {
    try {
      window.localStorage.setItem(applicationDraftStorageKey(project.id), JSON.stringify(draft));
      setSaveMessage('Application draft saved on this device.');
      return true;
    } catch {
      setSaveMessage('This browser could not save the draft. Your current entries are still open.');
      return false;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateApplicationDraft(draft);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (persistDraft()) setIsComplete(true);
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

        {isComplete ? (
          <div className="application-complete" role="status">
            <span aria-hidden="true" className="complete-mark">✓</span>
            <span className="eyebrow">Application ready</span>
            <h3>Your proof-led draft is complete.</h3>
            <p>
              It is saved on this device and has not been sent. Submission will be
              enabled after account onboarding and the applications API are connected.
            </p>
            <div className="application-summary">
              <span>Relevant sample</span><strong>{draft.workSampleUrl}</strong>
              <span>Confirmed availability</span><strong>{draft.availability}</strong>
              <span>Proposed contribution</span><strong>{draft.proposedContribution}</strong>
            </div>
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
              <p className="application-privacy-note">Your draft stays in this browser. Branch-Out does not send it anywhere yet.</p>
            </aside>

            <footer className="application-actions">
              <div>
                <button className="secondary-button" onClick={persistDraft} type="button">Save draft</button>
                {saveMessage && <span aria-live="polite" className="save-message">{saveMessage}</span>}
              </div>
              <button className="primary-button" type="submit">Complete application draft</button>
            </footer>
          </form>
        )}
      </section>
    </div>
  );
}
