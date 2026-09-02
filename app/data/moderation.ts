import { getAPIBaseURL } from './auth';
import { safetyReportCategories, type SafetyReportCategory, type SafetyReportTargetKind } from './safety-reports';

export const moderationStatuses = ['pending', 'upheld', 'dismissed'] as const;
export type ModerationStatus = typeof moderationStatuses[number];
export type ModerationDecision = Exclude<ModerationStatus, 'pending'>;

export type ModerationReport = {
  id: string;
  targetKind: SafetyReportTargetKind;
  targetId: string;
  category: SafetyReportCategory;
  details: string;
  targetSnapshot: Record<string, unknown>;
  status: ModerationStatus;
  reporter: { githubLogin: string };
  moderatorNotes: string | null;
  createdAt: string;
  decidedAt: string | null;
};

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function parseReport(value: unknown): ModerationReport {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid moderation report.');
  const report = value as Record<string, unknown>;
  const reporter = report.reporter;
  if (
    typeof report.id !== 'string'
    || !['trial_feedback', 'trust_candidate'].includes(report.targetKind as string)
    || typeof report.targetId !== 'string'
    || !safetyReportCategories.includes(report.category as SafetyReportCategory)
    || typeof report.details !== 'string'
    || !report.targetSnapshot
    || typeof report.targetSnapshot !== 'object'
    || Array.isArray(report.targetSnapshot)
    || !moderationStatuses.includes(report.status as ModerationStatus)
    || !reporter
    || typeof reporter !== 'object'
    || typeof (reporter as Record<string, unknown>).githubLogin !== 'string'
    || (report.moderatorNotes !== null && typeof report.moderatorNotes !== 'string')
    || !isDateTime(report.createdAt)
    || (report.decidedAt !== null && !isDateTime(report.decidedAt))
  ) throw new Error('The API returned an invalid moderation report.');
  return report as ModerationReport;
}

async function moderationError(response: Response) {
  if (response.status === 403) return new Error('moderator_access_forbidden');
  if (response.status === 409) return new Error('moderation_decision_unavailable');
  return new Error('moderation_request_failed');
}

export async function listModerationReports(signal?: AbortSignal) {
  const response = await fetch(`${getAPIBaseURL()}/v1/moderation/reports`, {
    credentials: 'include', headers: { Accept: 'application/json' }, signal,
  });
  if (!response.ok) throw await moderationError(response);
  const body = await response.json() as { data?: unknown };
  if (!Array.isArray(body.data)) throw new Error('The API returned an invalid moderation queue.');
  return body.data.map(parseReport);
}

export async function decideModerationReport(reportId: string, decision: ModerationDecision, moderatorNotes: string) {
  const response = await fetch(`${getAPIBaseURL()}/v1/moderation/reports/${encodeURIComponent(reportId)}/decision`, {
    body: JSON.stringify({ decision, moderatorNotes }),
    credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    method: 'POST',
  });
  if (!response.ok) throw await moderationError(response);
  const body = await response.json() as { data?: unknown };
  return parseReport(body.data);
}
