import { getAPIBaseURL } from './auth';
import type { SafetyReportTargetKind } from './safety-reports';

export type ModerationAppeal = {
  id: string; reportId: string; targetKind: SafetyReportTargetKind; targetId: string;
  reason: string; status: 'pending'; appellantLogin: string; createdAt: string;
};

function parseAppeal(value: unknown): ModerationAppeal {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid moderation appeal.');
  const appeal = value as Record<string, unknown>;
  if (typeof appeal.id !== 'string' || typeof appeal.reportId !== 'string'
    || !['trial_feedback', 'trust_candidate'].includes(appeal.targetKind as string)
    || typeof appeal.targetId !== 'string' || typeof appeal.reason !== 'string'
    || appeal.status !== 'pending' || typeof appeal.appellantLogin !== 'string'
    || typeof appeal.createdAt !== 'string') throw new Error('The API returned an invalid moderation appeal.');
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
