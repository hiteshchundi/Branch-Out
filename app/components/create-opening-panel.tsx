'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
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
    if ((field === 'problem' || field === 'firstMilestone' || field === 'ownerContribution') && value && value.length < 20) {
      errors[field] = `${fieldLabels[field]} should be at least 20 characters.`;
    }
    return errors;
  }, {});
}

function FieldError({ field, errors }: { field: DraftField; errors: ValidationErrors }) {
  return errors[field] ? <span className="field-error" id={`${field}-error`}>{errors[field]}</span> : null;
}

export function CreateOpeningPanel({ onClose }: { onClose: () => void }) {
  const [draft, setDraft] = useState<OpeningDraft>(loadSavedDraft);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<ValidationErrors>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement>(null);

  useAccessibleDialog({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  useEffect(() => {
    if (step > 0) stepHeadingRef.current?.focus();
  }, [step]);

  const updateDraft = (field: DraftField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage('');
  };

  const saveDraft = () => {
    try {
      window.localStorage.setItem(OPENING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
      setSaveMessage('Draft saved on this device.');
    } catch {
      setSaveMessage('This browser could not save the draft. Your current entries are still open.');
    }
  };

  const handleStepSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateOpeningStep(draft, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }

    // Completing a frontend draft saves it locally without claiming it was published.
    try {
      window.localStorage.setItem(OPENING_DRAFT_STORAGE_KEY, JSON.stringify(draft));
    } catch {
      setSaveMessage('This browser could not save the completed draft.');
      return;
    }
    setIsComplete(true);
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
            <span className="eyebrow">Create an opening</span>
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

        {isComplete ? (
          <div className="opening-complete" role="status">
            <span aria-hidden="true" className="complete-mark">✓</span>
            <span className="eyebrow">Draft ready</span>
            <h3>{draft.projectName}</h3>
            <p>
              Your opening draft is saved on this device. After account onboarding is
              connected, you will be able to review and publish it.
            </p>
            <dl>
              <div><dt>Role</dt><dd>{draft.role}</dd></div>
              <div><dt>Commitment</dt><dd>{draft.commitment}</dd></div>
              <div><dt>Compensation</dt><dd>{draft.compensation}</dd></div>
              <div><dt>First milestone</dt><dd>{draft.firstMilestone}</dd></div>
            </dl>
            <button className="primary-button" onClick={onClose} type="button">Return to openings</button>
          </div>
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
                      <option value="">Select compensation</option><option>Paid</option><option>Fixed bounty</option><option>Revenue share</option><option>Unpaid / portfolio</option><option>Exploratory</option>
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
                  <button className="secondary-button" onClick={saveDraft} type="button">Save draft</button>
                  {saveMessage && <span aria-live="polite" className="save-message">{saveMessage}</span>}
                </div>
                <div>
                  {step > 0 && <button className="text-button" onClick={() => setStep((current) => current - 1)} type="button">Back</button>}
                  <button className="primary-button" type="submit">{step === 2 ? 'Complete draft' : 'Continue'}</button>
                </div>
              </footer>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
