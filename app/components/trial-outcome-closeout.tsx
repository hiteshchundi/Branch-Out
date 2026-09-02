'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  createTrialOutcome,
  decideTrialOutcome,
  loadTrialOutcome,
  TrialProposalAPIError,
  type TrialOutcome,
  type TrialOutcomeInput,
} from '../data/trial-proposals';
import { TrialFeedbackPanel } from './trial-feedback-panel';

type OutcomeDraft = Omit<TrialOutcomeInput, 'outcomeStatus' | 'deliverableStatus'> & {
  outcomeStatus: TrialOutcomeInput['outcomeStatus'] | '';
  deliverableStatus: TrialOutcomeInput['deliverableStatus'] | '';
};
type OutcomeField = keyof OutcomeDraft;
type OutcomeErrors = Partial<Record<OutcomeField, string>>;

const emptyDraft: OutcomeDraft = {
  outcomeStatus: '', deliverableStatus: '', workSummary: '', evidenceUrl: '', closeoutNotes: '',
};

export function validateTrialOutcome(draft: OutcomeDraft): OutcomeErrors {
  const errors: OutcomeErrors = {};
  if (!draft.outcomeStatus) errors.outcomeStatus = 'Choose how the trial ended.';
  if (!draft.deliverableStatus) errors.deliverableStatus = 'Choose whether the deliverable was met.';
  const summaryLength = draft.workSummary.trim().length;
  if (summaryLength < 30 || summaryLength > 1000) errors.workSummary = 'Describe the outcome in 30 to 1000 characters.';
  const closeoutLength = draft.closeoutNotes.trim().length;
  if (closeoutLength < 20 || closeoutLength > 1000) errors.closeoutNotes = 'Describe the handoff or remaining work in 20 to 1000 characters.';
  if (draft.evidenceUrl.trim()) {
    try {
      const url = new URL(draft.evidenceUrl.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported protocol');
    } catch {
      errors.evidenceUrl = 'Use a complete http or https evidence link.';
    }
  }
  return errors;
}

const outcomeLabels: Record<TrialOutcomeInput['outcomeStatus'], string> = {
  completed: 'Completed', partially_completed: 'Partially completed', stopped_early: 'Stopped early',
};
const deliverableLabels: Record<TrialOutcomeInput['deliverableStatus'], string> = {
  met: 'Met', partially_met: 'Partially met', not_met: 'Not met',
};

export function TrialOutcomeCloseout({ proposalId }: { proposalId: string }) {
  const [outcome, setOutcome] = useState<TrialOutcome | null>(null);
  const [draft, setDraft] = useState<OutcomeDraft>(emptyDraft);
  const [errors, setErrors] = useState<OutcomeErrors>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [submitConfirmed, setSubmitConfirmed] = useState(false);
  const [pendingDecision, setPendingDecision] = useState<'confirmed' | 'disputed' | null>(null);
  const [decisionConfirmed, setDecisionConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    loadTrialOutcome(proposalId, controller.signal)
      .then((result) => {
        if (!active) return;
        setOutcome(result);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setStatus('error');
      });
    return () => { active = false; controller.abort(); };
  }, [proposalId]);

  const updateDraft = (field: OutcomeField, value: string) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage('');
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateTrialOutcome(draft);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0 || !submitConfirmed || !draft.outcomeStatus || !draft.deliverableStatus) return;
    const input: TrialOutcomeInput = {
      outcomeStatus: draft.outcomeStatus, deliverableStatus: draft.deliverableStatus,
      workSummary: draft.workSummary.trim(), evidenceUrl: draft.evidenceUrl.trim(),
      closeoutNotes: draft.closeoutNotes.trim(),
    };
    setIsSaving(true);
    try {
      setOutcome(await createTrialOutcome(proposalId, input));
      setMessage('Private outcome submitted for counterpart review.');
    } catch (error) {
      setMessage(error instanceof TrialProposalAPIError && error.status === 409
        ? 'A trial outcome already exists. Reopen this panel to load it.'
        : 'The private outcome could not be submitted. Review it and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const decide = async () => {
    if (!pendingDecision || !decisionConfirmed) return;
    setIsSaving(true);
    setMessage('');
    try {
      setOutcome(await decideTrialOutcome(proposalId, pendingDecision));
      setPendingDecision(null);
      setDecisionConfirmed(false);
      setMessage(`The outcome was ${pendingDecision === 'confirmed' ? 'confirmed' : 'marked disputed'} permanently.`);
    } catch {
      setMessage('The outcome decision could not be recorded. Reopen this panel to refresh its state.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-label="Private trial closeout" className="trial-outcome-closeout">
      <header><div><span className="eyebrow">Mutual closeout</span><h5>Trial outcome</h5></div>{outcome && <strong className={`trial-outcome-status ${outcome.reviewStatus}`}>{outcome.reviewStatus === 'pending' ? 'Awaiting review' : outcome.reviewStatus === 'confirmed' ? 'Mutually confirmed' : 'Disputed'}</strong>}</header>
      <p className="trial-check-in-boundary">This private factual record requires review by the other participant. It does not publish feedback or create a trust signal.</p>
      {status === 'loading' && <p role="status">Loading trial outcome…</p>}
      {status === 'error' && <p role="alert">The private trial outcome could not be loaded. Reopen this panel to retry.</p>}
      {status === 'ready' && !outcome && (
        <form className="trial-outcome-form" noValidate onSubmit={submit}>
          <label>Trial result<select aria-describedby={errors.outcomeStatus ? 'trial-outcome-status-error' : undefined} aria-invalid={Boolean(errors.outcomeStatus)} onChange={(event) => updateDraft('outcomeStatus', event.target.value)} value={draft.outcomeStatus}><option value="">Choose result</option><option value="completed">Completed</option><option value="partially_completed">Partially completed</option><option value="stopped_early">Stopped early</option></select>{errors.outcomeStatus && <span className="field-error" id="trial-outcome-status-error">{errors.outcomeStatus}</span>}</label>
          <label>Deliverable<select aria-describedby={errors.deliverableStatus ? 'trial-deliverable-status-error' : undefined} aria-invalid={Boolean(errors.deliverableStatus)} onChange={(event) => updateDraft('deliverableStatus', event.target.value)} value={draft.deliverableStatus}><option value="">Choose result</option><option value="met">Met</option><option value="partially_met">Partially met</option><option value="not_met">Not met</option></select>{errors.deliverableStatus && <span className="field-error" id="trial-deliverable-status-error">{errors.deliverableStatus}</span>}</label>
          <label className="full-field">What was delivered?<textarea aria-describedby={errors.workSummary ? 'trial-work-summary-error' : undefined} aria-invalid={Boolean(errors.workSummary)} onChange={(event) => updateDraft('workSummary', event.target.value)} rows={3} value={draft.workSummary} />{errors.workSummary && <span className="field-error" id="trial-work-summary-error">{errors.workSummary}</span>}</label>
          <label className="full-field">Evidence link <span className="optional-label">Optional</span><input aria-describedby={errors.evidenceUrl ? 'trial-outcome-evidence-error' : undefined} aria-invalid={Boolean(errors.evidenceUrl)} inputMode="url" onChange={(event) => updateDraft('evidenceUrl', event.target.value)} placeholder="https://github.com/..." type="url" value={draft.evidenceUrl} />{errors.evidenceUrl && <span className="field-error" id="trial-outcome-evidence-error">{errors.evidenceUrl}</span>}</label>
          <label className="full-field">Handoff and remaining work<textarea aria-describedby={errors.closeoutNotes ? 'trial-closeout-notes-error' : undefined} aria-invalid={Boolean(errors.closeoutNotes)} onChange={(event) => updateDraft('closeoutNotes', event.target.value)} rows={3} value={draft.closeoutNotes} />{errors.closeoutNotes && <span className="field-error" id="trial-closeout-notes-error">{errors.closeoutNotes}</span>}</label>
          <label className="trial-outcome-confirmation full-field"><input checked={submitConfirmed} onChange={(event) => setSubmitConfirmed(event.target.checked)} type="checkbox" /><span>I reviewed this factual closeout and understand submitting makes it read-only for counterpart review.</span></label>
          <button className="secondary-button" disabled={!submitConfirmed || isSaving} type="submit">{isSaving ? 'Submitting outcome…' : 'Submit private outcome'}</button>
        </form>
      )}
      {status === 'ready' && outcome && (
        <div className="trial-outcome-record">
          <p>Submitted by <strong>{outcome.submittedBy.displayName}</strong> · {outcome.submittedByRole === 'owner' ? 'Opening owner' : 'Applicant'}</p>
          <dl><div><dt>Trial</dt><dd>{outcomeLabels[outcome.input.outcomeStatus]}</dd></div><div><dt>Deliverable</dt><dd>{deliverableLabels[outcome.input.deliverableStatus]}</dd></div><div><dt>Delivered</dt><dd>{outcome.input.workSummary}</dd></div><div><dt>Handoff</dt><dd>{outcome.input.closeoutNotes}</dd></div></dl>
          {outcome.input.evidenceUrl && <a href={outcome.input.evidenceUrl} rel="noreferrer" target="_blank">View outcome evidence</a>}
          {outcome.reviewStatus === 'pending' && outcome.submittedByCurrentUser && <p role="status">Waiting for the other participant to confirm or dispute this read-only outcome.</p>}
          {outcome.reviewStatus === 'pending' && outcome.canDecide && (
            <div className="trial-outcome-decision">
              <div><button className="secondary-button" disabled={isSaving} onClick={() => { setPendingDecision('confirmed'); setDecisionConfirmed(false); }} type="button">Confirm outcome</button><button className="text-button danger-button" disabled={isSaving} onClick={() => { setPendingDecision('disputed'); setDecisionConfirmed(false); }} type="button">Dispute outcome</button></div>
              {pendingDecision && <div className="owner-application-decision-confirmation"><label><input checked={decisionConfirmed} onChange={(event) => setDecisionConfirmed(event.target.checked)} type="checkbox" /><span>I reviewed this closeout and understand my {pendingDecision === 'confirmed' ? 'confirmation' : 'dispute'} is permanent.</span></label><div><button className="primary-button" disabled={!decisionConfirmed || isSaving} onClick={decide} type="button">{isSaving ? 'Recording decision…' : `Confirm ${pendingDecision === 'confirmed' ? 'outcome' : 'dispute'}`}</button><button className="text-button" disabled={isSaving} onClick={() => setPendingDecision(null)} type="button">Cancel</button></div></div>}
            </div>
          )}
          {outcome.reviewStatus === 'confirmed' && <p role="status">Both participants confirmed this private factual outcome. No trust signal has been published.</p>}
          {outcome.reviewStatus === 'disputed' && <p role="status">The participants did not agree on this closeout. It remains private and cannot support a trust signal.</p>}
        </div>
      )}
      {message && <p aria-live="polite" className="save-message">{message}</p>}
      {outcome?.reviewStatus === 'confirmed' && <TrialFeedbackPanel proposalId={proposalId} />}
    </section>
  );
}
