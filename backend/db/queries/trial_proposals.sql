-- name: GetOwnTrialProposal :one
SELECT
    proposal.id, proposal.application_id, proposal.opening_id,
    proposal.applicant_user_id, proposal.outcome, proposal.deliverable,
    proposal.non_goals, proposal.start_date, proposal.end_date,
    proposal.weekly_hours, proposal.check_in_cadence, proposal.access_level,
    proposal.confidentiality, proposal.ip_ownership, proposal.exit_plan,
    proposal.terms_confirmed, proposal.proposal_status,
    proposal.created_at, proposal.updated_at
FROM trial_proposals AS proposal
JOIN applications AS application ON application.id = proposal.application_id
WHERE proposal.opening_id = sqlc.arg(opening_id)
  AND proposal.applicant_user_id = sqlc.arg(applicant_user_id)
  AND application.status = 'accepted';

-- name: UpsertOwnTrialProposalDraft :one
INSERT INTO trial_proposals (
    id, application_id, opening_id, applicant_user_id, outcome, deliverable,
    non_goals, start_date, end_date, weekly_hours, check_in_cadence,
    access_level, confidentiality, ip_ownership, exit_plan, terms_confirmed
)
SELECT
    sqlc.arg(id), application.id, application.opening_id,
    application.applicant_user_id, sqlc.arg(outcome), sqlc.arg(deliverable),
    sqlc.arg(non_goals), sqlc.arg(start_date), sqlc.arg(end_date),
    sqlc.arg(weekly_hours), sqlc.arg(check_in_cadence), sqlc.arg(access_level),
    sqlc.arg(confidentiality), sqlc.arg(ip_ownership), sqlc.arg(exit_plan),
    sqlc.arg(terms_confirmed)
FROM applications AS application
WHERE application.opening_id = sqlc.arg(opening_id)
  AND application.applicant_user_id = sqlc.arg(applicant_user_id)
  AND application.status = 'accepted'
ON CONFLICT (application_id) DO UPDATE SET
    outcome = EXCLUDED.outcome,
    deliverable = EXCLUDED.deliverable,
    non_goals = EXCLUDED.non_goals,
    start_date = EXCLUDED.start_date,
    end_date = EXCLUDED.end_date,
    weekly_hours = EXCLUDED.weekly_hours,
    check_in_cadence = EXCLUDED.check_in_cadence,
    access_level = EXCLUDED.access_level,
    confidentiality = EXCLUDED.confidentiality,
    ip_ownership = EXCLUDED.ip_ownership,
    exit_plan = EXCLUDED.exit_plan,
    terms_confirmed = EXCLUDED.terms_confirmed,
    updated_at = now()
WHERE trial_proposals.proposal_status = 'draft'
RETURNING
    id, application_id, opening_id, applicant_user_id, outcome, deliverable,
    non_goals, start_date, end_date, weekly_hours, check_in_cadence,
    access_level, confidentiality, ip_ownership, exit_plan, terms_confirmed,
    proposal_status, created_at, updated_at;
