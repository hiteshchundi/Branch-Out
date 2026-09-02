'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  decideModerationReport,
  listModerationReports,
  moderationStatuses,
  type ModerationDecision,
  type ModerationReport,
  type ModerationStatus,
} from '../data/moderation';
import { useAccessibleDialog } from './use-accessible-dialog';

const statusLabels: Record<ModerationStatus, string> = { pending: 'Pending review', upheld: 'Upheld', dismissed: 'Dismissed' };
const targetLabels = { trial_feedback: 'Private participant feedback', trust_candidate: 'Private trust candidate' };

function readableLabel(key: string) {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, (letter) => letter.toUpperCase());
}

function snapshotValue(value: unknown): string {
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (value === null || value === undefined) return 'Not provided';
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === 'object' && item !== null
      ? Object.entries(item as Record<string, unknown>).map(([key, entry]) => `${readableLabel(key)}: ${snapshotValue(entry)}`).join('; ')
      : snapshotValue(item)).join(' · ');
  }
  return Object.entries(value as Record<string, unknown>).map(([key, entry]) => `${readableLabel(key)}: ${snapshotValue(entry)}`).join(' · ');
}

function CapturedSnapshot({ snapshot }: { snapshot: Record<string, unknown> }) {
  return (
    <dl className="moderation-snapshot">
      {Object.entries(snapshot).map(([key, value]) => (
        <div key={key}><dt>{readableLabel(key)}</dt><dd>{snapshotValue(value)}</dd></div>
      ))}
    </dl>
  );
}

export function ModerationQueuePanel({ onClose }: { onClose: () => void }) {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [filter, setFilter] = useState<ModerationStatus>('pending');
  const [activeReportId, setActiveReportId] = useState<string | null>(null);
  const [decision, setDecision] = useState<ModerationDecision | ''>('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [retry, setRetry] = useState(0);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  useAccessibleDialog({ dialogRef, initialFocusRef: closeButtonRef, onClose });

  const visibleReports = useMemo(() => reports.filter((report) => report.status === filter), [filter, reports]);

  useEffect(() => {
    const controller = new AbortController();
    listModerationReports(controller.signal)
      .then((result) => { setReports(result); setStatus('ready'); })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === 'AbortError') return;
        setStatus('error');
      });
    return () => controller.abort();
  }, [retry]);

  const beginDecision = (report: ModerationReport) => {
    setActiveReportId(report.id);
    setDecision('');
    setNotes('');
    setConfirmed(false);
    setMessage('');
  };

  const saveDecision = async (report: ModerationReport) => {
    const normalizedNotes = notes.trim();
    if (!decision || normalizedNotes.length < 20 || normalizedNotes.length > 1000 || !confirmed) return;
    setIsSaving(true);
    setMessage('');
    try {
      const updated = await decideModerationReport(report.id, decision, normalizedNotes);
      setReports((current) => current.map((item) => item.id === updated.id ? updated : item));
      setActiveReportId(null);
      setMessage(`Report ${decision}. The decision is permanent.`);
    } catch (error) {
      setMessage(error instanceof Error && error.message === 'moderation_decision_unavailable'
        ? 'This report was already decided. Refresh the queue to see its current status.'
        : 'The moderation decision could not be recorded. Try again.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section aria-labelledby="moderation-title" aria-modal="true" className="moderation-panel" onMouseDown={(event) => event.stopPropagation()} ref={dialogRef} role="dialog">
        <header className="moderation-header">
          <div><span className="eyebrow">Authorized moderator workspace</span><h2 id="moderation-title">Safety report queue</h2><p>Review the reporter&apos;s explanation against the captured private evidence.</p></div>
          <button aria-label="Close moderation queue" className="icon-button" onClick={onClose} ref={closeButtonRef} type="button">×</button>
        </header>

        <div aria-label="Filter reports by status" className="moderation-filters" role="group">
          {moderationStatuses.map((reportStatus) => (
            <button aria-pressed={filter === reportStatus} key={reportStatus} onClick={() => setFilter(reportStatus)} type="button">
              {statusLabels[reportStatus]} <span>{reports.filter((report) => report.status === reportStatus).length}</span>
            </button>
          ))}
        </div>

        {message && <p className="moderation-message" role="status">{message}</p>}
        {status === 'loading' && <p className="moderation-state" role="status">Loading private reports…</p>}
        {status === 'error' && <div className="moderation-state"><p>The moderation queue could not be loaded.</p><button className="secondary-button" onClick={() => { setStatus('loading'); setRetry((current) => current + 1); }} type="button">Retry</button></div>}
        {status === 'ready' && visibleReports.length === 0 && <p className="moderation-state">No {statusLabels[filter].toLowerCase()} reports.</p>}

        <div className="moderation-list">
          {status === 'ready' && visibleReports.map((report) => (
            <article className="moderation-report" key={report.id}>
              <div className="moderation-report-heading">
                <div><span className={`moderation-status moderation-status-${report.status}`}>{statusLabels[report.status]}</span><h3>{targetLabels[report.targetKind]}</h3></div>
                <time dateTime={report.createdAt}>{new Date(report.createdAt).toLocaleString()}</time>
              </div>
              <dl className="moderation-report-facts">
                <div><dt>Category</dt><dd>{readableLabel(report.category)}</dd></div>
                <div><dt>Reporter</dt><dd>@{report.reporter.githubLogin}</dd></div>
                <div><dt>Target ID</dt><dd>{report.targetId}</dd></div>
              </dl>
              <section className="moderation-reason"><h4>Reporter explanation</h4><p>{report.details}</p></section>
              <details><summary>Review captured evidence</summary><CapturedSnapshot snapshot={report.targetSnapshot} /></details>

              {report.status === 'pending' && activeReportId !== report.id && <button className="primary-button" onClick={() => beginDecision(report)} type="button">Record decision</button>}
              {report.status !== 'pending' && <section className="moderation-decision"><h4>Moderator decision notes</h4><p>{report.moderatorNotes}</p>{report.decidedAt && <time dateTime={report.decidedAt}>Decided {new Date(report.decidedAt).toLocaleString()}</time>}</section>}

              {activeReportId === report.id && (
                <form className="moderation-decision-form" onSubmit={(event) => { event.preventDefault(); void saveDecision(report); }}>
                  <fieldset><legend>Permanent decision</legend><label><input checked={decision === 'upheld'} name={`decision-${report.id}`} onChange={() => setDecision('upheld')} type="radio" /> Uphold report</label><label><input checked={decision === 'dismissed'} name={`decision-${report.id}`} onChange={() => setDecision('dismissed')} type="radio" /> Dismiss report</label></fieldset>
                  <label>Moderator notes<textarea aria-describedby={`notes-help-${report.id}`} maxLength={1000} minLength={20} onChange={(event) => setNotes(event.target.value)} required rows={4} value={notes} /><small id={`notes-help-${report.id}`}>20–1000 characters. Explain the evidence and policy finding.</small></label>
                  <label className="confirmation-row"><input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" /> I understand this uphold or dismissal is permanent.</label>
                  <div><button className="primary-button" disabled={!decision || notes.trim().length < 20 || !confirmed || isSaving} type="submit">{isSaving ? 'Recording decision…' : 'Record permanent decision'}</button><button className="text-button" disabled={isSaving} onClick={() => setActiveReportId(null)} type="button">Cancel</button></div>
                </form>
              )}
            </article>
          ))}
        </div>
        <p className="moderation-boundary">This workspace records policy findings only. It does not remove content, sanction an account, publish a trust signal, or manage appeals.</p>
      </section>
    </div>
  );
}
