import { getAPIBaseURL } from './auth';
import type { SafetyReportTargetKind } from './safety-reports';

export type ModerationAppeal = {
  id: string; reportId: string; targetKind: SafetyReportTargetKind; targetId: string;
  reason: string; status: ModerationAppealStatus; appellantLogin: string;
  moderatorNotes: string | null; createdAt: string; decidedAt: string | null;
};

export const moderationAppealStatuses = ['pending', 'granted', 'denied'] as const;
export type ModerationAppealStatus = typeof moderationAppealStatuses[number];
export type ModerationAppealDecision = Exclude<ModerationAppealStatus, 'pending'>;

function isDateTime(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value));
}

function parseAppeal(value: unknown): ModerationAppeal {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid moderation appeal.');
  const appeal = value as Record<string, unknown>;
  if (typeof appeal.id !== 'string' || typeof appeal.reportId !== 'string'
    || !['trial_feedback', 'trust_candidate'].includes(appeal.targetKind as string)
    || typeof appeal.targetId !== 'string' || typeof appeal.reason !== 'string'
    || !moderationAppealStatuses.includes(appeal.status as ModerationAppealStatus)
    || typeof appeal.appellantLogin !== 'string'
    || (appeal.moderatorNotes !== null && typeof appeal.moderatorNotes !== 'string')
    || !isDateTime(appeal.createdAt)
    || (appeal.decidedAt !== null && !isDateTime(appeal.decidedAt))) throw new Error('The API returned an invalid moderation appeal.');
  return appeal as ModerationAppeal;
}

export async function createModerationAppeal(targetKind: SafetyReportTargetKind, targetId: string, reason: string) {
  const response = await fetch(`${getAPIBaseURL()}/v1/moderation-appeals`, {
    body: JSON.stringify({ targetKind, targetId, reason }), credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, method: 'POST',
  });
  if (!response.ok) throw new Error(response.status === 409 ? 'appeal_unavailable' : 'appeal_failed');
  const body = await response.json() as { data?: unknown };
  return parseAppeal(body.data);
}

export async function listModerationAppeals(signal?: AbortSignal) {
  const response = await fetch(`${getAPIBaseURL()}/v1/moderation/appeals`, { credentials: 'include', headers: { Accept: 'application/json' }, signal });
  if (!response.ok) throw new Error('appeal_list_failed');
  const body = await response.json() as { data?: unknown };
  if (!Array.isArray(body.data)) throw new Error('The API returned an invalid moderation appeal list.');
  return body.data.map(parseAppeal);
}

export async function decideModerationAppeal(appealId: string, decision: ModerationAppealDecision, moderatorNotes: string) {
  const response = await fetch(`${getAPIBaseURL()}/v1/moderation/appeals/${encodeURIComponent(appealId)}/decision`, {
    body: JSON.stringify({ decision, moderatorNotes }), credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, method: 'POST',
  });
  if (!response.ok) throw new Error(response.status === 409 ? 'appeal_decision_unavailable' : 'appeal_decision_failed');
  const body = await response.json() as { data?: unknown };
  return parseAppeal(body.data);
}
