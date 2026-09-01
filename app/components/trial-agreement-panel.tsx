'use client';

import { FormEvent, useEffect, useRef, useState } from 'react';
import type { AuthenticatedUser } from '../data/auth';
import { loadOwnApplication } from '../data/applications';
import type { ProjectOpening } from '../data/projects';
import {
  loadOwnTrialProposal,
  saveOwnTrialProposal,
  sendOwnTrialProposal,
  type ManagedTrialProposal,
  type TrialProposalInput,
} from '../data/trial-proposals';
import { useAccessibleDialog } from './use-accessible-dialog';

export type TrialAgreementDraft = {
  outcome: string;
  deliverable: string;
  nonGoals: string;
  startDate: string;
  endDate: string;
  weeklyHours: string;
  checkInCadence: string;
  accessLevel: string;
  confidentiality: string;
  ipOwnership: string;
  exitPlan: string;
  termsConfirmed: boolean;
};

type DraftField = keyof TrialAgreementDraft;
type TrialErrors = Partial<Record<DraftField, string>>;
type AccountDraftStatus = 'local' | 'loading' | 'accepted' | 'preview' | 'error';

export function trialAgreementStorageKey(projectId: string) {
  return `branch-out-trial-agreement:${projectId}`;
}

function emptyTrialDraft(project: ProjectOpening): TrialAgreementDraft {
  return {
    outcome: project.firstMilestone,
    deliverable: '',
    nonGoals: '',
    startDate: '',
    endDate: '',
    weeklyHours: '',
    checkInCadence: '',
    accessLevel: '',
    confidentiality: '',
    ipOwnership: '',
    exitPlan: '',
    termsConfirmed: false,
  };
}

/** Restores only known field types so malformed device data cannot break the form. */
function loadTrialDraft(project: ProjectOpening): TrialAgreementDraft {
  const fallback = emptyTrialDraft(project);
  if (typeof window === 'undefined') return fallback;

  try {
    const parsed: unknown = JSON.parse(
      window.localStorage.getItem(trialAgreementStorageKey(project.id)) ?? '{}',
    );
    if (!parsed || typeof parsed !== 'object') return fallback;
    const stored = parsed as Partial<Record<DraftField, unknown>>;
    return {
      outcome: typeof stored.outcome === 'string' ? stored.outcome : fallback.outcome,
      deliverable: typeof stored.deliverable === 'string' ? stored.deliverable : '',
      nonGoals: typeof stored.nonGoals === 'string' ? stored.nonGoals : '',
      startDate: typeof stored.startDate === 'string' ? stored.startDate : '',
      endDate: typeof stored.endDate === 'string' ? stored.endDate : '',
      weeklyHours: typeof stored.weeklyHours === 'string' ? stored.weeklyHours : '',
      checkInCadence: typeof stored.checkInCadence === 'string' ? stored.checkInCadence : '',
      accessLevel: typeof stored.accessLevel === 'string' ? stored.accessLevel : '',
      confidentiality: typeof stored.confidentiality === 'string' ? stored.confidentiality : '',
      ipOwnership: typeof stored.ipOwnership === 'string' ? stored.ipOwnership : '',
      exitPlan: typeof stored.exitPlan === 'string' ? stored.exitPlan : '',
      termsConfirmed: stored.termsConfirmed === true,
    };
  } catch {
    return fallback;
  }
}

function dateDifferenceInDays(startDate: string, endDate: string) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

/** Validates only the visible step so people are never blocked by hidden fields. */
export function validateTrialStep(draft: TrialAgreementDraft, step: number): TrialErrors {
  const errors: TrialErrors = {};

  if (step === 0) {
    if (draft.outcome.trim().length < 20) errors.outcome = 'Describe the trial outcome in at least 20 characters.';
    else if (draft.outcome.length > 500) errors.outcome = 'Keep the trial outcome within 500 characters.';
    if (draft.deliverable.trim().length < 20) errors.deliverable = 'Define a reviewable deliverable in at least 20 characters.';
    else if (draft.deliverable.length > 500) errors.deliverable = 'Keep the deliverable within 500 characters.';
    if (draft.nonGoals.trim().length < 15) errors.nonGoals = 'Name what is outside scope in at least 15 characters.';
    else if (draft.nonGoals.length > 500) errors.nonGoals = 'Keep the non-goals within 500 characters.';
  }

  if (step === 1) {
    if (!draft.startDate) errors.startDate = 'Choose a start date.';
    if (!draft.endDate) errors.endDate = 'Choose an end date.';
    const difference = dateDifferenceInDays(draft.startDate, draft.endDate);
    if (draft.startDate && draft.endDate && (difference === null || difference <= 0)) {
      errors.endDate = 'The end date must be after the start date.';
    } else if (difference !== null && (difference < 13 || difference > 15)) {
      errors.endDate = 'Keep the trial between 13 and 15 calendar days.';
    }
    const hours = Number(draft.weeklyHours);
    if (!Number.isInteger(hours) || hours < 1 || hours > 40) {
      errors.weeklyHours = 'Enter whole weekly hours between 1 and 40.';
    }
    if (!draft.checkInCadence) errors.checkInCadence = 'Choose a check-in cadence.';
  }

  if (step === 2) {
    if (!draft.accessLevel) errors.accessLevel = 'Choose the minimum access needed.';
    if (!draft.confidentiality) errors.confidentiality = 'Choose how confidential information is handled.';
    if (!draft.ipOwnership) errors.ipOwnership = 'Choose an ownership expectation to discuss.';
    if (draft.exitPlan.trim().length < 20) errors.exitPlan = 'Describe a clean exit in at least 20 characters.';
    else if (draft.exitPlan.length > 500) errors.exitPlan = 'Keep the exit plan within 500 characters.';
    if (!draft.termsConfirmed) errors.termsConfirmed = 'Confirm that both people must review these terms.';
  }

  return errors;
}

function validateEntireDraft(draft: TrialAgreementDraft) {
  return [0, 1, 2].reduce<TrialErrors>(
    (allErrors, currentStep) => ({ ...allErrors, ...validateTrialStep(draft, currentStep) }),
    {},
  );
}

function toProposalInput(draft: TrialAgreementDraft): TrialProposalInput {
  return { ...draft, weeklyHours: Number(draft.weeklyHours) };
}

function fromProposalInput(input: TrialProposalInput): TrialAgreementDraft {
  return { ...input, weeklyHours: String(input.weeklyHours) };
}

function FieldError({ field, errors }: { field: DraftField; errors: TrialErrors }) {
  return errors[field]
    ? <span className="field-error" id={`trial-${field}-error`}>{errors[field]}</span>
    : null;
}

export function TrialAgreementPanel({
  authenticatedUser,
  onClose,
  project,
}: {
  authenticatedUser?: AuthenticatedUser | null;
  onClose: () => void;
  project: ProjectOpening;
}) {
  const [draft, setDraft] = useState<TrialAgreementDraft>(() => loadTrialDraft(project));
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<TrialErrors>({});
  const [saveMessage, setSaveMessage] = useState('');
  const [isComplete, setIsComplete] = useState(false);
  const [accountStatus, setAccountStatus] = useState<AccountDraftStatus>(authenticatedUser ? 'loading' : 'local');
  const [isSaving, setIsSaving] = useState(false);
  const [proposalStatus, setProposalStatus] = useState<ManagedTrialProposal['status']>('draft');
  const [sendConfirmed, setSendConfirmed] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useAccessibleDialog({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  useEffect(() => {
    if (!authenticatedUser) return;

    const controller = new AbortController();
    void loadOwnApplication(project.id, controller.signal)
      .then(async (application) => {
        if (!application || application.status !== 'accepted') {
          setAccountStatus('preview');
          return;
        }
        const proposal = await loadOwnTrialProposal(project.id, controller.signal);
        if (proposal) {
          setDraft(fromProposalInput(proposal.input));
          setProposalStatus(proposal.status);
          if (proposal.status !== 'draft') setIsComplete(true);
        }
        setAccountStatus('accepted');
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setAccountStatus('error');
      });
    return () => controller.abort();
  }, [authenticatedUser, project.id]);

  const updateDraft = <Field extends DraftField>(field: Field, value: TrialAgreementDraft[Field]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setErrors((current) => ({ ...current, [field]: undefined }));
    setSaveMessage('');
  };

  const persistLocalDraft = () => {
    try {
      window.localStorage.setItem(trialAgreementStorageKey(project.id), JSON.stringify(draft));
      setSaveMessage('Trial agreement draft saved on this device.');
      return true;
    } catch {
      setSaveMessage('This browser could not save the draft. Your entries remain open.');
      return false;
    }
  };

  const persistDraft = async () => {
    if (accountStatus !== 'accepted') return persistLocalDraft();
    if (proposalStatus !== 'draft') {
      setSaveMessage('Sent proposals are read-only. The owner must record the next decision.');
      return false;
    }

    const nextErrors = validateEntireDraft(draft);
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      const firstInvalidStep = [0, 1, 2].find((candidate) => Object.keys(validateTrialStep(draft, candidate)).length > 0);
      if (firstInvalidStep !== undefined) setStep(firstInvalidStep);
      setSaveMessage('Complete every section before saving this private account draft.');
      return false;
    }

    setIsSaving(true);
    setSaveMessage('');
    try {
      const proposal = await saveOwnTrialProposal(project.id, toProposalInput(draft));
      setDraft(fromProposalInput(proposal.input));
      setSaveMessage('Private trial proposal saved to your Branch-Out account.');
      return true;
    } catch {
      setSaveMessage('The private proposal could not be saved. Your entries remain open.');
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const handleSend = async () => {
    if (accountStatus !== 'accepted' || proposalStatus !== 'draft' || !sendConfirmed) return;
    setIsSending(true);
    setSaveMessage('');
    try {
      const proposal = await sendOwnTrialProposal(project.id);
      setProposalStatus(proposal.status);
      setSendConfirmed(false);
      setSaveMessage('Trial proposal sent privately to the opening owner.');
    } catch {
      setSaveMessage('The proposal could not be sent. It remains private and unsent.');
    } finally {
      setIsSending(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors = validateTrialStep(draft, step);
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    if (step < 2) {
      setStep((current) => current + 1);
      return;
    }
    if (await persistDraft()) setIsComplete(true);
  };

  const describedBy = (field: DraftField) => errors[field] ? `trial-${field}-error` : undefined;

  return (
    <div className="modal-backdrop trial-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="trial-title" aria-modal="true" className="trial-panel" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="dialog">
        <header className="trial-header">
          <div><span className="eyebrow">Two-week trial draft</span><h2 id="trial-title">Agree on the small bet before the big commitment.</h2></div>
          <button aria-label="Close trial agreement" className="icon-button" onClick={onClose} ref={closeButtonRef} type="button">×</button>
        </header>

        <div className="trial-project-context"><span>{project.stage}</span><strong>{project.title}</strong><small>{project.ownerName} · {project.commitment}</small></div>

        {accountStatus === 'loading' && <p aria-live="polite" className="save-message">Checking your application and private draft…</p>}
        {accountStatus === 'accepted' && proposalStatus === 'draft' && <p className="save-message">Your application was accepted. Save the complete proposal privately, then explicitly send it to the opening owner.</p>}
        {accountStatus === 'accepted' && proposalStatus === 'sent' && <p className="save-message">Your proposal is with the opening owner for review and can no longer be edited.</p>}
        {accountStatus === 'accepted' && proposalStatus === 'accepted' && <p className="save-message">Both people explicitly accepted this trial proposal. It remains a planning record, not a legal signature.</p>}
        {accountStatus === 'accepted' && proposalStatus === 'declined' && <p className="save-message">The opening owner declined this proposal. The decision is final for this proposal.</p>}
        {accountStatus === 'preview' && <p className="save-message">Account saving unlocks after your application is accepted. This preview stays only on this device.</p>}
        {accountStatus === 'error' && <p className="save-message">Your application could not be checked. This preview will stay only on this device.</p>}

        {isComplete ? (
          <div className="trial-complete">
            <div role="status">
              <span aria-hidden="true" className="complete-mark">✓</span>
              <span className="eyebrow">{proposalStatus === 'accepted' ? 'Mutually accepted proposal' : proposalStatus === 'declined' ? 'Proposal declined' : proposalStatus === 'sent' ? 'Sent for owner review' : 'Draft ready for mutual review'}</span>
              <h3>{proposalStatus === 'accepted' ? 'The small bet is mutually agreed.' : 'The trial boundaries are clear.'}</h3>
              <p>{proposalStatus === 'accepted' ? 'You approved these terms by sending them, and the opening owner explicitly accepted them.' : proposalStatus === 'declined' ? 'The opening owner declined these terms. This record cannot be edited or resubmitted.' : proposalStatus === 'sent' ? 'This proposal was sent privately to the opening owner and is awaiting an irreversible accept or decline decision.' : accountStatus === 'accepted' ? 'This proposal is saved privately to your Branch-Out account and has not been sent yet.' : 'This draft is saved only on this device. It has not been sent or accepted.'} It is not a legal agreement or electronic signature.</p>
            </div>
            <dl>
              <div><dt>Outcome</dt><dd>{draft.outcome}</dd></div>
              <div><dt>Dates</dt><dd>{draft.startDate} to {draft.endDate}</dd></div>
              <div><dt>Time</dt><dd>{draft.weeklyHours} hours/week · {draft.checkInCadence}</dd></div>
              <div><dt>Access</dt><dd>{draft.accessLevel}</dd></div>
              <div><dt>Exit plan</dt><dd>{draft.exitPlan}</dd></div>
            </dl>
            {accountStatus === 'accepted' && proposalStatus === 'draft' && (
              <div className="opening-lifecycle-confirmation">
                <label>
                  <input checked={sendConfirmed} onChange={(event) => setSendConfirmed(event.target.checked)} type="checkbox" />
                  <span>I reviewed every term and understand sending records my approval and makes this proposal read-only.</span>
                </label>
                <button className="primary-button" disabled={!sendConfirmed || isSending} onClick={handleSend} type="button">
                  {isSending ? 'Sending…' : 'Send to opening owner'}
                </button>
              </div>
            )}
            {saveMessage && <p aria-live="polite" className="save-message">{saveMessage}</p>}
            <button className="primary-button" onClick={onClose} type="button">Return to opening</button>
          </div>
        ) : (
          <>
            <ol aria-label={`Step ${step + 1} of 3`} className="trial-steps">
              {['Scope', 'Working terms', 'Safeguards'].map((label, index) => <li className={index === step ? 'active' : index < step ? 'complete' : ''} key={label}><span>{index + 1}</span>{label}</li>)}
            </ol>

            <form className="trial-form" noValidate onSubmit={handleSubmit}>
              {step === 0 && <div className="trial-form-grid">
                <div className="trial-form-intro full-field"><h3>What will count as a useful trial?</h3><p>Define one inspectable outcome and protect both people from scope creep.</p></div>
                <label className="full-field">Trial outcome<textarea aria-describedby={describedBy('outcome')} aria-invalid={Boolean(errors.outcome)} onChange={(e) => updateDraft('outcome', e.target.value)} rows={3} value={draft.outcome} /><FieldError errors={errors} field="outcome" /></label>
                <label className="full-field">Reviewable deliverable<textarea aria-describedby={describedBy('deliverable')} aria-invalid={Boolean(errors.deliverable)} onChange={(e) => updateDraft('deliverable', e.target.value)} placeholder="What concrete artifact, change, or research result will be reviewed?" rows={3} value={draft.deliverable} /><FieldError errors={errors} field="deliverable" /></label>
                <label className="full-field">Explicit non-goals<textarea aria-describedby={describedBy('nonGoals')} aria-invalid={Boolean(errors.nonGoals)} onChange={(e) => updateDraft('nonGoals', e.target.value)} placeholder="What will not be attempted during these two weeks?" rows={2} value={draft.nonGoals} /><FieldError errors={errors} field="nonGoals" /></label>
              </div>}

              {step === 1 && <div className="trial-form-grid">
                <div className="trial-form-intro full-field"><h3>Make the commitment measurable.</h3><p>The dates must span 13–15 calendar days, with realistic hours and check-ins.</p></div>
                <label>Start date<input aria-describedby={describedBy('startDate')} aria-invalid={Boolean(errors.startDate)} onChange={(e) => updateDraft('startDate', e.target.value)} type="date" value={draft.startDate} /><FieldError errors={errors} field="startDate" /></label>
                <label>End date<input aria-describedby={describedBy('endDate')} aria-invalid={Boolean(errors.endDate)} onChange={(e) => updateDraft('endDate', e.target.value)} type="date" value={draft.endDate} /><FieldError errors={errors} field="endDate" /></label>
                <label>Hours per week<input aria-describedby={describedBy('weeklyHours')} aria-invalid={Boolean(errors.weeklyHours)} inputMode="numeric" max="40" min="1" onChange={(e) => updateDraft('weeklyHours', e.target.value)} placeholder="6" type="number" value={draft.weeklyHours} /><FieldError errors={errors} field="weeklyHours" /></label>
                <label>Check-in cadence<select aria-describedby={describedBy('checkInCadence')} aria-invalid={Boolean(errors.checkInCadence)} onChange={(e) => updateDraft('checkInCadence', e.target.value)} value={draft.checkInCadence}><option value="">Choose cadence</option><option>Async update every two days</option><option>Twice-weekly live check-in</option><option>Weekly review plus async updates</option></select><FieldError errors={errors} field="checkInCadence" /></label>
              </div>}

              {step === 2 && <div className="trial-form-grid">
                <div className="trial-form-intro full-field"><h3>Limit access and make leaving safe.</h3><p>These are discussion prompts, not legal terms. Both people remain responsible for a written agreement.</p></div>
                <label>Minimum access<select aria-describedby={describedBy('accessLevel')} aria-invalid={Boolean(errors.accessLevel)} onChange={(e) => updateDraft('accessLevel', e.target.value)} value={draft.accessLevel}><option value="">Choose access</option><option>Sandbox or sample data only</option><option>Limited repository access</option><option>Time-limited production access</option></select><FieldError errors={errors} field="accessLevel" /></label>
                <label>Confidentiality<select aria-describedby={describedBy('confidentiality')} aria-invalid={Boolean(errors.confidentiality)} onChange={(e) => updateDraft('confidentiality', e.target.value)} value={draft.confidentiality}><option value="">Choose handling</option><option>Public work only</option><option>Private after written agreement</option><option>Synthetic data during trial</option></select><FieldError errors={errors} field="confidentiality" /></label>
                <label className="full-field">Ownership expectation<select aria-describedby={describedBy('ipOwnership')} aria-invalid={Boolean(errors.ipOwnership)} onChange={(e) => updateDraft('ipOwnership', e.target.value)} value={draft.ipOwnership}><option value="">Choose expectation to discuss</option><option>Contributor retains pre-existing work; project owns trial deliverable</option><option>Contributor licenses trial deliverable to the project</option><option>Open-source contribution under the project license</option><option>Custom written terms required before work starts</option></select><FieldError errors={errors} field="ipOwnership" /></label>
                <label className="full-field">Clean exit plan<textarea aria-describedby={describedBy('exitPlan')} aria-invalid={Boolean(errors.exitPlan)} onChange={(e) => updateDraft('exitPlan', e.target.value)} placeholder="Describe handoff, access removal, payment, and what happens if either person stops." rows={3} value={draft.exitPlan} /><FieldError errors={errors} field="exitPlan" /></label>
                <label className="trial-confirmation full-field"><input aria-describedby={describedBy('termsConfirmed')} aria-invalid={Boolean(errors.termsConfirmed)} checked={draft.termsConfirmed} onChange={(e) => updateDraft('termsConfirmed', e.target.checked)} type="checkbox" /><span>I understand both people must review and explicitly accept final terms outside this frontend preview.</span></label>
                <FieldError errors={errors} field="termsConfirmed" />
              </div>}

              <footer className="trial-actions">
                <div><button className="secondary-button" disabled={accountStatus === 'loading' || isSaving || proposalStatus !== 'draft'} onClick={() => void persistDraft()} type="button">{accountStatus === 'accepted' ? 'Save private proposal' : 'Save draft'}</button>{saveMessage && <span aria-live="polite" className="save-message">{saveMessage}</span>}</div>
                <div>{step > 0 && <button className="text-button" onClick={() => setStep((current) => current - 1)} type="button">Back</button>}<button className="primary-button" disabled={accountStatus === 'loading' || isSaving} type="submit">{isSaving ? 'Saving…' : step === 2 ? 'Complete trial draft' : 'Continue'}</button></div>
              </footer>
            </form>
          </>
        )}
      </section>
    </div>
  );
}
