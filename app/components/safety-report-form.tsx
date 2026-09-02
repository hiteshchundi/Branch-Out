'use client';

import { FormEvent, useState } from 'react';
import { createSafetyReport, type SafetyReportCategory, type SafetyReportTargetKind } from '../data/safety-reports';

const categoryLabels: Record<SafetyReportCategory, string> = {
  harassment: 'Harassment or abuse', privacy: 'Private information', fraud: 'Fraud or misrepresentation',
  spam: 'Spam', other: 'Another safety concern',
};

export function SafetyReportForm({ targetKind, targetId, buttonLabel }: { targetKind: SafetyReportTargetKind; targetId: string; buttonLabel: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const [category, setCategory] = useState<SafetyReportCategory | ''>('');
  const [details, setDetails] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ category?: string; details?: string; confirmed?: string }>({});

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!category) nextErrors.category = 'Choose the closest safety category.';
    const detailLength = details.trim().length;
    if (detailLength < 30 || detailLength > 1000) nextErrors.details = 'Explain the concern in 30 to 1000 characters.';
    if (!confirmed) nextErrors.confirmed = 'Confirm that the report can be shared with moderators.';
    setErrors(nextErrors);
    setMessage('');
    if (Object.keys(nextErrors).length > 0 || !category) return;
    setIsSaving(true);
    try {
      await createSafetyReport({ targetKind, targetId, category, details: details.trim() });
      setSubmitted(true);
      setMessage('Safety report submitted for moderator review.');
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'report_unavailable'
        ? 'This item cannot be reported from this account, or you already reported it.'
        : 'The safety report could not be submitted. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  if (submitted) return <p className="safety-report-receipt" role="status">Safety report submitted for moderator review.</p>;
  if (!isOpen) return <button className="text-button safety-report-trigger" onClick={() => setIsOpen(true)} type="button">{buttonLabel}</button>;

  return (
    <form className="safety-report-form" noValidate onSubmit={submit}>
      <strong>Report a safety concern</strong>
      <p>A snapshot of this private item will be shared with authorized moderators. Submitting does not automatically remove content or penalize another member.</p>
      <label>Concern category<select aria-describedby={errors.category ? `safety-category-${targetId}` : undefined} aria-invalid={Boolean(errors.category)} onChange={(event) => { setCategory(event.target.value as SafetyReportCategory); setErrors((current) => ({ ...current, category: undefined })); }} value={category}><option value="">Choose category</option>{Object.entries(categoryLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{errors.category && <span className="field-error" id={`safety-category-${targetId}`}>{errors.category}</span>}</label>
      <label>What should moderators review?<textarea aria-describedby={errors.details ? `safety-details-${targetId}` : undefined} aria-invalid={Boolean(errors.details)} onChange={(event) => { setDetails(event.target.value); setErrors((current) => ({ ...current, details: undefined })); }} rows={3} value={details} />{errors.details && <span className="field-error" id={`safety-details-${targetId}`}>{errors.details}</span>}</label>
      <label className="trial-outcome-confirmation"><input checked={confirmed} onChange={(event) => { setConfirmed(event.target.checked); setErrors((current) => ({ ...current, confirmed: undefined })); }} type="checkbox" /><span>I understand this report and a private snapshot will be shared with authorized moderators for review.</span></label>
      {errors.confirmed && <span className="field-error">{errors.confirmed}</span>}
      <div><button className="secondary-button" disabled={isSaving} type="submit">{isSaving ? 'Submitting report…' : 'Submit safety report'}</button><button className="text-button" disabled={isSaving} onClick={() => { setIsOpen(false); setMessage(''); }} type="button">Cancel</button></div>
      {message && <p aria-live="polite" className="save-message">{message}</p>}
    </form>
  );
}
