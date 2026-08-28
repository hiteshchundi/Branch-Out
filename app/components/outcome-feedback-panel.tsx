'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { ProjectOpening } from '../data/projects';

export const collaborationBehaviors = [
  'Reliable delivery',
  'Clear communication',
  'Sound scope judgment',
  'Constructive feedback',
] as const;

export type OutcomeFeedbackDraft = {
  outcomeStatus: string;
  deliverableStatus: string;
  workSummary: string;
  evidenceUrl: string;
  behaviors: string[];
  collaborationExample: string;
  collaborateAgain: string;
  publicSummary: string;
  privacyConfirmed: boolean;
  mutualReviewConfirmed: boolean;
};

type DraftField = keyof OutcomeFeedbackDraft;
type OutcomeErrors = Partial<Record<DraftField, string>>;

export type TrustSignalPreview = {
  title: string;
  explanation: string;
  factors: string[];
};

const emptyDraft: OutcomeFeedbackDraft = {
  outcomeStatus: '',
  deliverableStatus: '',
  workSummary: '',
  evidenceUrl: '',
  behaviors: [],
  collaborationExample: '',
  collaborateAgain: '',
  publicSummary: '',
  privacyConfirmed: false,
  mutualReviewConfirmed: false,
};

export function outcomeFeedbackStorageKey(projectId: string) {
  return `branch-out-outcome-feedback:${projectId}`;
}

/** Restores only expected field types and recognized behavior labels. */
function loadOutcomeDraft(projectId: string): OutcomeFeedbackDraft {
  if (typeof window === 'undefined') return emptyDraft;
  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(outcomeFeedbackStorageKey(projectId)) ?? '{}',
    );
    if (!parsed || typeof parsed !== 'object') return emptyDraft;
    const stored = parsed as Partial<Record<DraftField, unknown>>;
    const allowedBehaviors = new Set<string>(collaborationBehaviors);
    return {
      outcomeStatus: typeof stored.outcomeStatus === 'string' ? stored.outcomeStatus : '',
      deliverableStatus: typeof stored.deliverableStatus === 'string' ? stored.deliverableStatus : '',
      workSummary: typeof stored.workSummary === 'string' ? stored.workSummary : '',
      evidenceUrl: typeof stored.evidenceUrl === 'string' ? stored.evidenceUrl : '',
      behaviors: Array.isArray(stored.behaviors)
        ? [...new Set(stored.behaviors.filter((item): item is string => typeof item === 'string' && allowedBehaviors.has(item)))]
        : [],
      collaborationExample: typeof stored.collaborationExample === 'string' ? stored.collaborationExample : '',
      collaborateAgain: typeof stored.collaborateAgain === 'string' ? stored.collaborateAgain : '',
      publicSummary: typeof stored.publicSummary === 'string' ? stored.publicSummary : '',
      privacyConfirmed: stored.privacyConfirmed === true,
      mutualReviewConfirmed: stored.mutualReviewConfirmed === true,
    };
  } catch {
    return emptyDraft;
  }
}

function isValidOptionalUrl(value: string) {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' || url.protocol === 'http:';
  } catch {
    return false;
  }
}

/** Validates only visible fields and requires evidence behind every collaboration claim. */
export function validateOutcomeStep(draft: OutcomeFeedbackDraft, step: number): OutcomeErrors {
  const errors: OutcomeErrors = {};
  if (step === 0) {
    if (!draft.outcomeStatus) errors.outcomeStatus = 'Choose how the trial ended.';
    if (!draft.deliverableStatus) errors.deliverableStatus = 'Choose whether the deliverable was met.';
    if (draft.workSummary.trim().length < 30) errors.workSummary = 'Describe the outcome in at least 30 characters.';
    if (!isValidOptionalUrl(draft.evidenceUrl.trim())) errors.evidenceUrl = 'Enter a complete http or https evidence link.';
  }
  if (step === 1) {
    if (draft.behaviors.length < 2) errors.behaviors = 'Choose at least two behaviors you directly observed.';
    if (draft.collaborationExample.trim().length < 30) errors.collaborationExample = 'Describe one observed example in at least 30 characters.';
    if (!draft.collaborateAgain) errors.collaborateAgain = 'Choose whether you would collaborate again.';
  }
  if (step === 2) {
    if (draft.publicSummary.trim().length < 30) errors.publicSummary = 'Write a public-safe summary of at least 30 characters.';
    if (!draft.privacyConfirmed) errors.privacyConfirmed = 'Confirm that the summary excludes private information.';
    if (!draft.mutualReviewConfirmed) errors.mutualReviewConfirmed = 'Confirm that both collaborators must review the record.';
  }
  return errors;
}

/** Uses explicit, inspectable rules so the preview never hides an opaque reputation score. */
export function deriveTrustSignalPreview(draft: OutcomeFeedbackDraft): TrustSignalPreview {
  const factors = [
    `Outcome: ${draft.outcomeStatus || 'Not recorded'}`,
    `Deliverable: ${draft.deliverableStatus || 'Not recorded'}`,
    `${draft.behaviors.length} observed collaboration behaviors`,
    `Collaborate again: ${draft.collaborateAgain || 'Not recorded'}`,
  ];
  const collaborationCandidate = draft.outcomeStatus === 'Completed'
    && draft.deliverableStatus === 'Met'
    && draft.behaviors.length >= 3
    && draft.collaborateAgain === 'Yes';

  if (collaborationCandidate) {
    return {
      title: 'Collaboration Proven candidate',
      explanation: 'The draft meets every visible collaboration-evidence rule. Mutual confirmation is still required.',
      factors,
    };
  }
  if (draft.outcomeStatus === 'Completed' || draft.outcomeStatus === 'Partially completed') {
    return {
      title: 'Work Demonstrated candidate',
      explanation: 'The outcome can support a work-evidence review, but it does not meet every Collaboration Proven rule.',
      factors,
    };
  }
  return {
    title: 'No trust signal candidate',
    explanation: 'The recorded outcome does not support a public trust signal. The private learning can still be retained.',
    factors,
  };
}

function FieldError({ field, errors }: { field: DraftField; errors: OutcomeErrors }) {
  return errors[field] ? <span className="field-error" id={`outcome-${field}-error`}>{errors[field]}</span> : null;
}

export function OutcomeFeedbackPanel({ onClose, project }: { onClose: () => void; project: ProjectOpening }) {
  const [draft, setDraft] = useState<OutcomeFeedbackDraft>(() => loadOutcomeDraft(project.id));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<OutcomeErrors>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  // The review remains usable by keyboard and can be dismissed consistently with every other flow.
  useEffect(() => {
    closeButtonRef.current?.focus();
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, [onClose]);

  const updateDraft = <Field extends DraftField>(field: Field, value: OutcomeFeedbackDraft[Field]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage('');
  };

  const toggleBehavior = (behavior: string) => {
    const nextBehaviors = draft.behaviors.includes(behavior)
      ? draft.behaviors.filter((item) => item !== behavior)
      : [...draft.behaviors, behavior];
    updateDraft('behaviors', nextBehaviors);
  };

  const persistDraft = () => {
    try {
      window.localStorage.setItem(outcomeFeedbackStorageKey(project.id), JSON.stringify(draft));
      setSaveMessage('Outcome review draft saved on this device.');
      return true;
    } catch {
      setSaveMessage('This browser could not save the draft. Your entries remain open.');
      return false;
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateOutcomeStep(draft, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    if (persistDraft()) setIsComplete(true);
  };

  const describedBy = (field: DraftField) => errors[field] ? `outcome-${field}-error` : undefined;
  const preview = deriveTrustSignalPreview(draft);

  return (
    <div className="modal-backdrop outcome-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="outcome-title" aria-modal="true" className="outcome-panel" onMouseDown={(event) => event.stopPropagation()} role="dialog">
        <header className="outcome-header"><div><span className="eyebrow">Post-trial outcome review</span><h2 id="outcome-title">Turn observed work into explainable trust.</h2></div><button aria-label="Close outcome review" className="icon-button" onClick={onClose} ref={closeButtonRef} type="button">×</button></header>
        <div className="outcome-project-context"><span>{project.stage}</span><strong>{project.title}</strong><small>Trial milestone: {project.firstMilestone}</small></div>

        {isComplete ? <div className="outcome-complete" role="status">
          <span aria-hidden="true" className="complete-mark">✓</span><span className="eyebrow">Outcome draft complete</span><h3>{preview.title}</h3><p>{preview.explanation}</p>
          <div className="trust-preview-card"><strong>Why this preview appears</strong><ul>{preview.factors.map((factor) => <li key={factor}>{factor}</li>)}</ul></div>
          <blockquote>“{draft.publicSummary}”</blockquote>
          <p className="outcome-boundary">No trust signal or feedback has been published. The other collaborator must confirm the record after accounts and moderation exist.</p>
          <button className="primary-button" onClick={onClose} type="button">Return to opening</button>
        </div> : <>
          <ol aria-label={`Step ${step + 1} of 3`} className="outcome-steps">{['Outcome', 'Collaboration', 'Mutual review'].map((label, index) => <li className={index === step ? 'active' : index < step ? 'complete' : ''} key={label}><span>{index + 1}</span>{label}</li>)}</ol>
          <form className="outcome-form" noValidate onSubmit={handleSubmit}>
            {step === 0 && <div className="outcome-form-grid"><div className="outcome-form-intro full-field"><h3>What actually happened?</h3><p>Record the outcome without turning effort or activity into proof by itself.</p></div>
              <label>Trial status<select aria-describedby={describedBy('outcomeStatus')} aria-invalid={Boolean(errors.outcomeStatus)} onChange={(e) => updateDraft('outcomeStatus', e.target.value)} value={draft.outcomeStatus}><option value="">Choose outcome</option><option>Completed</option><option>Partially completed</option><option>Stopped early</option></select><FieldError errors={errors} field="outcomeStatus" /></label>
              <label>Deliverable<select aria-describedby={describedBy('deliverableStatus')} aria-invalid={Boolean(errors.deliverableStatus)} onChange={(e) => updateDraft('deliverableStatus', e.target.value)} value={draft.deliverableStatus}><option value="">Choose result</option><option>Met</option><option>Partially met</option><option>Not met</option></select><FieldError errors={errors} field="deliverableStatus" /></label>
              <label className="full-field">What was delivered?<textarea aria-describedby={describedBy('workSummary')} aria-invalid={Boolean(errors.workSummary)} onChange={(e) => updateDraft('workSummary', e.target.value)} placeholder="Describe the inspectable result and the contributor's part." rows={3} value={draft.workSummary} /><FieldError errors={errors} field="workSummary" /></label>
              <label className="full-field">Public evidence link <span className="optional-label">Optional</span><input aria-describedby={describedBy('evidenceUrl')} aria-invalid={Boolean(errors.evidenceUrl)} inputMode="url" onChange={(e) => updateDraft('evidenceUrl', e.target.value)} placeholder="https://github.com/..." type="url" value={draft.evidenceUrl} /><FieldError errors={errors} field="evidenceUrl" /></label>
            </div>}
            {step === 1 && <div className="outcome-form-grid"><div className="outcome-form-intro full-field"><h3>What behavior did you directly observe?</h3><p>Choose at least two. A concrete example is required behind every claim.</p></div>
              <fieldset aria-describedby={describedBy('behaviors')} className="behavior-picker full-field"><legend>Observed behaviors</legend><div>{collaborationBehaviors.map((behavior) => <label className={draft.behaviors.includes(behavior) ? 'selected' : ''} key={behavior}><input checked={draft.behaviors.includes(behavior)} onChange={() => toggleBehavior(behavior)} type="checkbox" />{behavior}</label>)}</div><FieldError errors={errors} field="behaviors" /></fieldset>
              <label className="full-field">One observed example<textarea aria-describedby={describedBy('collaborationExample')} aria-invalid={Boolean(errors.collaborationExample)} onChange={(e) => updateDraft('collaborationExample', e.target.value)} placeholder="Describe what happened, not a personality judgment." rows={3} value={draft.collaborationExample} /><FieldError errors={errors} field="collaborationExample" /></label>
              <label className="full-field">Would you collaborate again?<select aria-describedby={describedBy('collaborateAgain')} aria-invalid={Boolean(errors.collaborateAgain)} onChange={(e) => updateDraft('collaborateAgain', e.target.value)} value={draft.collaborateAgain}><option value="">Choose answer</option><option>Yes</option><option>Maybe, with different scope</option><option>No</option></select><FieldError errors={errors} field="collaborateAgain" /></label>
            </div>}
            {step === 2 && <div className="outcome-form-grid"><div className="outcome-form-intro full-field"><h3>Prepare a fair, public-safe record.</h3><p>The counterpart must review the final record. This preview cannot publish it.</p></div>
              <label className="full-field">Public-safe summary<textarea aria-describedby={describedBy('publicSummary')} aria-invalid={Boolean(errors.publicSummary)} onChange={(e) => updateDraft('publicSummary', e.target.value)} placeholder="Summarize the outcome and observed collaboration without private details." rows={4} value={draft.publicSummary} /><FieldError errors={errors} field="publicSummary" /></label>
              <label className="outcome-confirmation full-field"><input aria-describedby={describedBy('privacyConfirmed')} aria-invalid={Boolean(errors.privacyConfirmed)} checked={draft.privacyConfirmed} onChange={(e) => updateDraft('privacyConfirmed', e.target.checked)} type="checkbox" /><span>I confirm this draft excludes secrets, private links, personal data, and confidential client information.</span></label><FieldError errors={errors} field="privacyConfirmed" />
              <label className="outcome-confirmation full-field"><input aria-describedby={describedBy('mutualReviewConfirmed')} aria-invalid={Boolean(errors.mutualReviewConfirmed)} checked={draft.mutualReviewConfirmed} onChange={(e) => updateDraft('mutualReviewConfirmed', e.target.checked)} type="checkbox" /><span>I understand both collaborators must review the record before any trust signal can be earned.</span></label><FieldError errors={errors} field="mutualReviewConfirmed" />
            </div>}
            <footer className="outcome-actions"><div><button className="secondary-button" onClick={persistDraft} type="button">Save draft</button>{saveMessage && <span aria-live="polite" className="save-message">{saveMessage}</span>}</div><div>{step > 0 && <button className="text-button" onClick={() => setStep((current) => current - 1)} type="button">Back</button>}<button className="primary-button" type="submit">{step === 2 ? 'Complete outcome draft' : 'Continue'}</button></div></footer>
          </form>
        </>}
      </section>
    </div>
  );
}
