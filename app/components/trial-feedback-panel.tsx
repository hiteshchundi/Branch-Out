'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  acknowledgeTrialFeedback,
  createTrialFeedback,
  loadTrialFeedback,
  loadTrialTrustCandidate,
  trialFeedbackBehaviors,
  type TrialFeedback,
  type TrialFeedbackBehavior,
  type TrialFeedbackInput,
  type TrialTrustCandidate,
} from '../data/trial-proposals';

type FeedbackDraft = Omit<TrialFeedbackInput, 'collaborateAgain'> & { collaborateAgain: TrialFeedbackInput['collaborateAgain'] | '' };
type FeedbackField = keyof FeedbackDraft;
type FeedbackErrors = Partial<Record<FeedbackField, string>>;

const behaviorLabels: Record<TrialFeedbackBehavior, string> = {
  reliable_delivery: 'Reliable delivery',
  clear_communication: 'Clear communication',
  sound_scope_judgment: 'Sound scope judgment',
  constructive_feedback: 'Constructive feedback',
};

const emptyDraft: FeedbackDraft = {
  observedBehaviors: [], collaborationExample: '', collaborateAgain: '', reviewSummary: '',
};

export function validateTrialFeedback(draft: FeedbackDraft): FeedbackErrors {
  const errors: FeedbackErrors = {};
  if (draft.observedBehaviors.length < 2) errors.observedBehaviors = 'Choose at least two behaviors you directly observed.';
  const exampleLength = draft.collaborationExample.trim().length;
  if (exampleLength < 30 || exampleLength > 1000) errors.collaborationExample = 'Describe one observed example in 30 to 1000 characters.';
  if (!draft.collaborateAgain) errors.collaborateAgain = 'Choose whether you would collaborate again.';
  const summaryLength = draft.reviewSummary.trim().length;
  if (summaryLength < 30 || summaryLength > 1000) errors.reviewSummary = 'Write a private review in 30 to 1000 characters.';
  return errors;
}

export function TrialFeedbackPanel({ proposalId }: { proposalId: string }) {
  const [feedback, setFeedback] = useState<TrialFeedback[]>([]);
  const [draft, setDraft] = useState<FeedbackDraft>(emptyDraft);
  const [errors, setErrors] = useState<FeedbackErrors>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [submissionConfirmed, setSubmissionConfirmed] = useState(false);
  const [pendingAcknowledgement, setPendingAcknowledgement] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [candidate, setCandidate] = useState<TrialTrustCandidate | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([loadTrialFeedback(proposalId, controller.signal), loadTrialTrustCandidate(proposalId, controller.signal)])
      .then(([feedbackResult, candidateResult]) => { if (active) { setFeedback(feedbackResult); setCandidate(candidateResult); setStatus('ready'); } })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setStatus('error');
      });
    return () => { active = false; controller.abort(); };
  }, [proposalId]);

  const toggleBehavior = (behavior: TrialFeedbackBehavior) => {
    setDraft((current) => ({
      ...current,
      observedBehaviors: current.observedBehaviors.includes(behavior)
        ? current.observedBehaviors.filter((item) => item !== behavior)
        : [...current.observedBehaviors, behavior],
    }));
    setErrors((current) => ({ ...current, observedBehaviors: undefined }));
    setMessage('');
  };

  const updateText = (field: 'collaborationExample' | 'reviewSummary', value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage('');
  };

  const refreshCandidate = async () => {
    try {
      setCandidate(await loadTrialTrustCandidate(proposalId));
      return true;
    } catch {
      setCandidate(null);
      return false;
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateTrialFeedback(draft);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0 || !submissionConfirmed || !draft.collaborateAgain) return;
    setIsSaving(true);
    try {
      const created = await createTrialFeedback(proposalId, {
        observedBehaviors: draft.observedBehaviors,
        collaborationExample: draft.collaborationExample.trim(),
        collaborateAgain: draft.collaborateAgain,
        reviewSummary: draft.reviewSummary.trim(),
      });
      setFeedback((current) => [...current, created]);
      const candidateRefreshed = await refreshCandidate();
      setDraft(emptyDraft);
      setSubmissionConfirmed(false);
      setMessage(candidateRefreshed
        ? 'Your private, read-only feedback was submitted.'
        : 'Your private feedback was submitted, but the trust review could not be refreshed. Reopen this workspace to retry.');
    } catch {
      setMessage('The private feedback could not be submitted. You may already have a review for this trial.');
    } finally {
      setIsSaving(false);
    }
  };

  const acknowledge = async (feedbackId: string) => {
    if (pendingAcknowledgement !== feedbackId) { setPendingAcknowledgement(feedbackId); return; }
    setIsSaving(true);
    setMessage('');
    try {
      const updated = await acknowledgeTrialFeedback(proposalId, feedbackId);
      setFeedback((current) => current.map((item) => item.id === updated.id ? updated : item));
      const candidateRefreshed = await refreshCandidate();
      setPendingAcknowledgement(null);
      setMessage(candidateRefreshed
        ? 'You acknowledged receiving this private feedback. Its content was not approved or changed.'
        : 'Your acknowledgement was recorded, but the trust review could not be refreshed. Reopen this workspace to retry.');
    } catch {
      setMessage('The acknowledgement could not be recorded. Reopen this workspace to refresh it.');
    } finally {
      setIsSaving(false);
    }
  };

  const currentUserSubmitted = feedback.some((item) => item.authoredByCurrentUser);

  return (
    <section aria-label="Private post-trial feedback" className="trial-feedback-panel">
      <header><div><span className="eyebrow">Post-trial reflection</span><h5>Private participant feedback</h5></div><strong>{feedback.length} of 2 submitted</strong></header>
      <p className="trial-check-in-boundary">Each participant may submit one immutable review after the factual outcome is confirmed. Acknowledgement means received—not agreed with. Nothing here is public or scored.</p>
      {status === 'loading' && <p role="status">Loading private feedback…</p>}
      {status === 'error' && <p role="alert">Private feedback could not be loaded. Reopen this workspace to retry.</p>}
      {status === 'ready' && feedback.map((item) => (
        <article className="trial-feedback-record" key={item.id}>
          <header><div><strong>{item.author.displayName}</strong><span>{item.authorRole === 'owner' ? 'Opening owner' : 'Applicant'}</span></div><small>{item.acknowledgedAt ? 'Acknowledged' : item.authoredByCurrentUser ? 'Awaiting acknowledgement' : 'New feedback'}</small></header>
          <ul className="trial-feedback-behaviors">{item.input.observedBehaviors.map((behavior) => <li key={behavior}>{behaviorLabels[behavior]}</li>)}</ul>
          <dl><div><dt>Observed example</dt><dd>{item.input.collaborationExample}</dd></div><div><dt>Collaborate again</dt><dd>{item.input.collaborateAgain === 'yes' ? 'Yes' : item.input.collaborateAgain === 'maybe' ? 'Maybe, with different scope' : 'No'}</dd></div><div><dt>Private review</dt><dd>{item.input.reviewSummary}</dd></div></dl>
          {item.canAcknowledge && <div className="trial-feedback-acknowledgement"><button className="secondary-button" disabled={isSaving} onClick={() => acknowledge(item.id)} type="button">{pendingAcknowledgement === item.id ? 'Confirm acknowledgement' : 'Acknowledge receipt'}</button>{pendingAcknowledgement === item.id && <button className="text-button" disabled={isSaving} onClick={() => setPendingAcknowledgement(null)} type="button">Cancel</button>}</div>}
        </article>
      ))}
      {status === 'ready' && !currentUserSubmitted && (
        <form className="trial-feedback-form" noValidate onSubmit={submit}>
          <fieldset aria-describedby={errors.observedBehaviors ? 'trial-feedback-behaviors-error' : undefined} className="behavior-picker full-field"><legend>Behaviors you directly observed</legend><div>{trialFeedbackBehaviors.map((behavior) => <label className={draft.observedBehaviors.includes(behavior) ? 'selected' : ''} key={behavior}><input checked={draft.observedBehaviors.includes(behavior)} onChange={() => toggleBehavior(behavior)} type="checkbox" />{behaviorLabels[behavior]}</label>)}</div>{errors.observedBehaviors && <span className="field-error" id="trial-feedback-behaviors-error">{errors.observedBehaviors}</span>}</fieldset>
          <label className="full-field">One concrete example<textarea aria-describedby={errors.collaborationExample ? 'trial-feedback-example-error' : undefined} aria-invalid={Boolean(errors.collaborationExample)} onChange={(event) => updateText('collaborationExample', event.target.value)} rows={3} value={draft.collaborationExample} />{errors.collaborationExample && <span className="field-error" id="trial-feedback-example-error">{errors.collaborationExample}</span>}</label>
          <label>Would you collaborate again?<select aria-describedby={errors.collaborateAgain ? 'trial-feedback-again-error' : undefined} aria-invalid={Boolean(errors.collaborateAgain)} onChange={(event) => { setDraft((current) => ({ ...current, collaborateAgain: event.target.value as FeedbackDraft['collaborateAgain'] })); setErrors((current) => ({ ...current, collaborateAgain: undefined })); }} value={draft.collaborateAgain}><option value="">Choose answer</option><option value="yes">Yes</option><option value="maybe">Maybe, with different scope</option><option value="no">No</option></select>{errors.collaborateAgain && <span className="field-error" id="trial-feedback-again-error">{errors.collaborateAgain}</span>}</label>
          <label className="full-field">Private review summary<textarea aria-describedby={errors.reviewSummary ? 'trial-feedback-summary-error' : undefined} aria-invalid={Boolean(errors.reviewSummary)} onChange={(event) => updateText('reviewSummary', event.target.value)} rows={3} value={draft.reviewSummary} />{errors.reviewSummary && <span className="field-error" id="trial-feedback-summary-error">{errors.reviewSummary}</span>}</label>
          <label className="trial-outcome-confirmation full-field"><input checked={submissionConfirmed} onChange={(event) => setSubmissionConfirmed(event.target.checked)} type="checkbox" /><span>I reviewed this feedback, excluded secrets and personal data, and understand it becomes read-only when submitted.</span></label>
          <button className="secondary-button" disabled={!submissionConfirmed || isSaving} type="submit">{isSaving ? 'Submitting feedback…' : 'Submit private feedback'}</button>
        </form>
      )}
      {status === 'ready' && candidate && (
        <section aria-label="Private trust candidate" className={`trial-trust-candidate ${candidate.kind}`}>
          <span className="eyebrow">Transparent trust review</span>
          <h6>{candidate.title}</h6>
          <p>{candidate.explanation}</p>
          <div><strong>Why this appears</strong><ul>{candidate.factors.map((factor) => <li key={factor}>{factor}</li>)}</ul></div>
          <p className="trial-check-in-boundary">This candidate is private, trial-level, and rule-based. It is not a profile score or badge and cannot be published until moderation controls exist.</p>
        </section>
      )}
      {message && <p aria-live="polite" className="save-message">{message}</p>}
    </section>
  );
}
