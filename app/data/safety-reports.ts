import { getAPIBaseURL } from './auth';

export const safetyReportCategories = ['harassment', 'privacy', 'fraud', 'spam', 'other'] as const;
export type SafetyReportCategory = typeof safetyReportCategories[number];
export type SafetyReportTargetKind = 'trial_feedback' | 'trust_candidate';

export type SafetyReportInput = {
  targetKind: SafetyReportTargetKind;
  targetId: string;
  category: SafetyReportCategory;
  details: string;
};

export type SafetyReportReceipt = {
  id: string;
  targetKind: SafetyReportTargetKind;
  targetId: string;
  category: SafetyReportCategory;
  status: 'pending';
  createdAt: string;
};

function parseReceipt(value: unknown): SafetyReportReceipt {
  if (!value || typeof value !== 'object') throw new Error('The API returned an invalid safety report.');
  const report = value as Record<string, unknown>;
  if (
    typeof report.id !== 'string'
    || !['trial_feedback', 'trust_candidate'].includes(report.targetKind as string)
    || typeof report.targetId !== 'string'
    || !safetyReportCategories.includes(report.category as SafetyReportCategory)
    || report.status !== 'pending'
    || typeof report.createdAt !== 'string'
  ) throw new Error('The API returned an invalid safety report.');
  return report as SafetyReportReceipt;
}

export async function createSafetyReport(input: SafetyReportInput) {
  const response = await fetch(`${getAPIBaseURL()}/v1/safety-reports`, {
    body: JSON.stringify(input), credentials: 'include',
    headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, method: 'POST',
  });
  if (!response.ok) throw new Error(response.status === 409 ? 'report_unavailable' : 'report_failed');
  const body = await response.json() as { data?: unknown };
  return parseReceipt(body.data);
}
