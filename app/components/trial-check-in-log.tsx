'use client';

import { FormEvent, useEffect, useState } from 'react';
import {
  addTrialCheckIn,
  listTrialCheckIns,
  TrialProposalAPIError,
  type TrialCheckIn,
  type TrialCheckInInput,
} from '../data/trial-proposals';

const emptyInput: TrialCheckInInput = { kind: 'progress', update: '', evidenceUrl: '' };

export function validateTrialCheckIn(input: TrialCheckInInput) {
  const errors: Partial<Record<keyof TrialCheckInInput, string>> = {};
  const updateLength = input.update.trim().length;
  if (updateLength < 20 || updateLength > 1000) errors.update = 'Write an update containing 20 to 1000 characters.';
  if (input.evidenceUrl.trim()) {
    try {
      const url = new URL(input.evidenceUrl.trim());
      if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported protocol');
    } catch {
      errors.evidenceUrl = 'Use a complete http or https evidence link.';
    }
  }
  return errors;
}

const kindLabels: Record<TrialCheckIn['kind'], string> = {
  progress: 'Progress', blocker: 'Blocker', milestone: 'Milestone',
};

export function TrialCheckInLog({ proposalId }: { proposalId: string }) {
  const [checkIns, setCheckIns] = useState<TrialCheckIn[]>([]);
  const [input, setInput] = useState<TrialCheckInInput>(emptyInput);
  const [errors, setErrors] = useState<Partial<Record<keyof TrialCheckInInput, string>>>({});
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    listTrialCheckIns(proposalId, controller.signal)
      .then((results) => {
        if (!active) return;
        setCheckIns(results);
        setStatus('ready');
      })
      .catch((error: unknown) => {
        if (!active || (error instanceof DOMException && error.name === 'AbortError')) return;
        setStatus('error');
      });
    return () => { active = false; controller.abort(); };
  }, [proposalId]);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextInput = { ...input, update: input.update.trim(), evidenceUrl: input.evidenceUrl.trim() };
    const nextErrors = validateTrialCheckIn(nextInput);
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0) return;
    setIsSaving(true);
    try {
      const created = await addTrialCheckIn(proposalId, nextInput);
      setCheckIns((current) => [...current, created]);
      setInput(emptyInput);
      setMessage('Check-in added to the private execution log.');
    } catch (error) {
      setMessage(error instanceof TrialProposalAPIError && error.status === 401
        ? 'Your session expired. Log in again before adding a check-in.'
        : 'The check-in could not be added. Review it and try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section aria-label="Private trial execution log" className="trial-check-in-log">
      <header><div><span className="eyebrow">Shared execution log</span><h5>Trial check-ins</h5></div><strong>{checkIns.length}</strong></header>
      <p className="trial-check-in-boundary">Visible only to the applicant and opening owner. Entries are timestamped and cannot be edited or removed.</p>
      {status === 'loading' && <p role="status">Loading trial check-ins…</p>}
      {status === 'error' && <p role="alert">The private execution log could not be loaded. Reopen this panel to retry.</p>}
      {status === 'ready' && checkIns.length === 0 && <p>No check-ins yet. Add the first concrete progress update, blocker, or milestone.</p>}
      {status === 'ready' && checkIns.length > 0 && (
        <ol className="trial-check-in-list">
          {checkIns.map((checkIn) => (
            <li key={checkIn.id}>
              <header><div><strong>{checkIn.author.displayName}</strong><span>{checkIn.authorRole === 'owner' ? 'Opening owner' : 'Applicant'}</span></div><time dateTime={checkIn.createdAt}>{new Date(checkIn.createdAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' })} UTC</time></header>
              <span className={`trial-check-in-kind ${checkIn.kind}`}>{kindLabels[checkIn.kind]}</span>
              <p>{checkIn.update}</p>
              {checkIn.evidenceUrl && <a href={checkIn.evidenceUrl} rel="noreferrer" target="_blank">View evidence</a>}
            </li>
          ))}
        </ol>
      )}
      {status === 'ready' && (
        <form className="trial-check-in-form" noValidate onSubmit={submit}>
          <label>Check-in type<select onChange={(event) => setInput((current) => ({ ...current, kind: event.target.value as TrialCheckInInput['kind'] }))} value={input.kind}><option value="progress">Progress</option><option value="blocker">Blocker</option><option value="milestone">Milestone</option></select></label>
          <label className="full-field">Update<textarea aria-describedby={errors.update ? 'trial-check-in-update-error' : undefined} aria-invalid={Boolean(errors.update)} onChange={(event) => { setInput((current) => ({ ...current, update: event.target.value })); setErrors((current) => ({ ...current, update: undefined })); }} placeholder="Describe what changed, what is blocked, or what was reviewed." rows={3} value={input.update} />{errors.update && <span className="field-error" id="trial-check-in-update-error">{errors.update}</span>}</label>
          <label className="full-field">Evidence link <span className="optional-label">Optional</span><input aria-describedby={errors.evidenceUrl ? 'trial-check-in-evidence-error' : undefined} aria-invalid={Boolean(errors.evidenceUrl)} inputMode="url" onChange={(event) => { setInput((current) => ({ ...current, evidenceUrl: event.target.value })); setErrors((current) => ({ ...current, evidenceUrl: undefined })); }} placeholder="https://github.com/..." type="url" value={input.evidenceUrl} />{errors.evidenceUrl && <span className="field-error" id="trial-check-in-evidence-error">{errors.evidenceUrl}</span>}</label>
          <button className="secondary-button" disabled={isSaving} type="submit">{isSaving ? 'Adding check-in…' : 'Add private check-in'}</button>
          {message && <p aria-live="polite" className="save-message">{message}</p>}
        </form>
      )}
    </section>
  );
}
