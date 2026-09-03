'use client';

import { FormEvent, useState } from 'react';
import { createModerationAppeal } from '../data/moderation-appeals';
import type { SafetyReportTargetKind } from '../data/safety-reports';

export function ModerationAppealForm({ targetKind, targetId }: { targetKind: SafetyReportTargetKind; targetId: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (reason.trim().length < 30 || reason.trim().length > 1000 || !confirmed) return;
    setSaving(true); setMessage('');
    try {
      await createModerationAppeal(targetKind, targetId, reason.trim());
      setSubmitted(true); setMessage('Appeal submitted for moderator review. The removal remains active while it is pending.');
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'appeal_unavailable'
        ? 'This removal cannot be appealed from this account, or an appeal already exists.'
        : 'The appeal could not be submitted. Try again.');
    } finally { setSaving(false); }
  };

  if (submitted) return <p className="moderation-appeal-message" role="status">{message}</p>;
  if (!isOpen) return <button className="text-button moderation-appeal-trigger" onClick={() => setIsOpen(true)} type="button">Appeal this removal</button>;
  return (
    <form className="moderation-appeal-form" onSubmit={submit}>
      <strong>Request another moderation review</strong>
      <label>Why should this removal be reconsidered?<textarea maxLength={1000} minLength={30} onChange={(event) => setReason(event.target.value)} required rows={3} value={reason} /><small>30–1000 characters. Do not include secrets or personal information.</small></label>
      <label className="confirmation-row"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /> I understand the removal stays active while this appeal is pending.</label>
      <div><button className="secondary-button" disabled={saving || reason.trim().length < 30 || !confirmed} type="submit">{saving ? 'Submitting appeal…' : 'Submit appeal'}</button><button className="text-button" disabled={saving} onClick={() => setIsOpen(false)} type="button">Cancel</button></div>
      {message && <p className="save-message" role="status">{message}</p>}
    </form>
  );
}
