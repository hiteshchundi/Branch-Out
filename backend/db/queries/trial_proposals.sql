-- name: GetOwnTrialProposal :one
SELECT
    proposal.id, proposal.application_id, proposal.opening_id,
    proposal.applicant_user_id, proposal.outcome, proposal.deliverable,
    proposal.non_goals, proposal.start_date, proposal.end_date,
    proposal.weekly_hours, proposal.check_in_cadence, proposal.access_level,
    proposal.confidentiality, proposal.ip_ownership, proposal.exit_plan,
    proposal.terms_confirmed, proposal.proposal_status,
    proposal.created_at, proposal.updated_at, proposal.sent_at, proposal.decided_at
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
    proposal_status, created_at, updated_at, sent_at, decided_at;

-- name: SendOwnTrialProposal :one
UPDATE trial_proposals AS proposal SET
    proposal_status = 'sent',
    sent_at = now(),
    updated_at = now()
FROM applications AS application
WHERE proposal.opening_id = sqlc.arg(opening_id)
  AND proposal.applicant_user_id = sqlc.arg(applicant_user_id)
  AND proposal.proposal_status = 'draft'
  AND application.id = proposal.application_id
  AND application.status = 'accepted'
RETURNING proposal.*;

-- name: GetTrialWorkspaceForParticipant :one
SELECT proposal.id
FROM trial_proposals AS proposal
JOIN project_openings AS opening ON opening.id = proposal.opening_id
WHERE proposal.id = sqlc.arg(proposal_id)
  AND proposal.proposal_status = 'accepted'
  AND (
      proposal.applicant_user_id = sqlc.arg(participant_user_id)
      OR opening.owner_user_id = sqlc.arg(participant_user_id)
  );

-- name: ListTrialCheckInsForParticipant :many
SELECT
    check_in.id, check_in.proposal_id, check_in.author_user_id,
    check_in.check_in_kind, check_in.update_text, check_in.evidence_url,
    check_in.created_at, profiles.display_name AS author_display_name,
    CASE
        WHEN check_in.author_user_id = proposal.applicant_user_id THEN 'applicant'
        ELSE 'owner'
    END AS author_role
FROM trial_check_ins AS check_in
JOIN trial_proposals AS proposal ON proposal.id = check_in.proposal_id
JOIN project_openings AS opening ON opening.id = proposal.opening_id
JOIN profiles ON profiles.user_id = check_in.author_user_id
WHERE check_in.proposal_id = sqlc.arg(proposal_id)
  AND proposal.proposal_status = 'accepted'
  AND (
      proposal.applicant_user_id = sqlc.arg(participant_user_id)
      OR opening.owner_user_id = sqlc.arg(participant_user_id)
  )
ORDER BY check_in.created_at ASC, check_in.id ASC;

-- name: CreateTrialCheckInForParticipant :one
WITH inserted AS (
    INSERT INTO trial_check_ins (
        id, proposal_id, author_user_id, check_in_kind, update_text, evidence_url
    )
    SELECT
        sqlc.arg(id), proposal.id, sqlc.arg(author_user_id),
        sqlc.arg(check_in_kind), sqlc.arg(update_text), sqlc.arg(evidence_url)
    FROM trial_proposals AS proposal
    JOIN project_openings AS opening ON opening.id = proposal.opening_id
    WHERE proposal.id = sqlc.arg(proposal_id)
      AND proposal.proposal_status = 'accepted'
      AND (
          proposal.applicant_user_id = sqlc.arg(author_user_id)
          OR opening.owner_user_id = sqlc.arg(author_user_id)
      )
    RETURNING *
)
SELECT
    inserted.id, inserted.proposal_id, inserted.author_user_id,
    inserted.check_in_kind, inserted.update_text, inserted.evidence_url,
    inserted.created_at, profiles.display_name AS author_display_name,
    CASE
        WHEN inserted.author_user_id = proposal.applicant_user_id THEN 'applicant'
        ELSE 'owner'
    END AS author_role
FROM inserted
JOIN trial_proposals AS proposal ON proposal.id = inserted.proposal_id
JOIN profiles ON profiles.user_id = inserted.author_user_id;

-- name: GetTrialOutcomeForParticipant :one
SELECT
    outcome.id, outcome.proposal_id, outcome.submitted_by_user_id,
    outcome.outcome_status, outcome.deliverable_status, outcome.work_summary,
    outcome.evidence_url, outcome.closeout_notes, outcome.review_status,
    outcome.submitted_at, outcome.decided_at,
    profiles.display_name AS submitted_by_display_name,
    CASE
        WHEN outcome.submitted_by_user_id = proposal.applicant_user_id THEN 'applicant'
        ELSE 'owner'
    END AS submitted_by_role,
    (
        outcome.review_status = 'pending'
        AND outcome.submitted_by_user_id <> sqlc.arg(participant_user_id)
    ) AS can_decide
FROM trial_outcomes AS outcome
JOIN trial_proposals AS proposal ON proposal.id = outcome.proposal_id
JOIN project_openings AS opening ON opening.id = proposal.opening_id
JOIN profiles ON profiles.user_id = outcome.submitted_by_user_id
WHERE outcome.proposal_id = sqlc.arg(proposal_id)
  AND proposal.proposal_status = 'accepted'
  AND (
      proposal.applicant_user_id = sqlc.arg(participant_user_id)
      OR opening.owner_user_id = sqlc.arg(participant_user_id)
  );

-- name: CreateTrialOutcomeForParticipant :one
WITH inserted AS (
    INSERT INTO trial_outcomes (
        id, proposal_id, submitted_by_user_id, outcome_status,
        deliverable_status, work_summary, evidence_url, closeout_notes
    )
    SELECT
        sqlc.arg(id), proposal.id, sqlc.arg(submitted_by_user_id),
        sqlc.arg(outcome_status), sqlc.arg(deliverable_status),
        sqlc.arg(work_summary), sqlc.arg(evidence_url), sqlc.arg(closeout_notes)
    FROM trial_proposals AS proposal
    JOIN project_openings AS opening ON opening.id = proposal.opening_id
    WHERE proposal.id = sqlc.arg(proposal_id)
      AND proposal.proposal_status = 'accepted'
      AND (
          proposal.applicant_user_id = sqlc.arg(submitted_by_user_id)
          OR opening.owner_user_id = sqlc.arg(submitted_by_user_id)
      )
    ON CONFLICT (proposal_id) DO NOTHING
    RETURNING *
)
SELECT
    inserted.id, inserted.proposal_id, inserted.submitted_by_user_id,
    inserted.outcome_status, inserted.deliverable_status, inserted.work_summary,
    inserted.evidence_url, inserted.closeout_notes, inserted.review_status,
    inserted.submitted_at, inserted.decided_at,
    profiles.display_name AS submitted_by_display_name,
    CASE
        WHEN inserted.submitted_by_user_id = proposal.applicant_user_id THEN 'applicant'
        ELSE 'owner'
    END AS submitted_by_role,
    false AS can_decide
FROM inserted
JOIN trial_proposals AS proposal ON proposal.id = inserted.proposal_id
JOIN profiles ON profiles.user_id = inserted.submitted_by_user_id;

-- name: DecideTrialOutcomeForParticipant :one
WITH decided AS (
    UPDATE trial_outcomes AS outcome SET
        review_status = sqlc.arg(decision),
        decided_by_user_id = sqlc.arg(participant_user_id),
        decided_at = now()
    FROM trial_proposals AS proposal
    JOIN project_openings AS opening ON opening.id = proposal.opening_id
    WHERE outcome.proposal_id = sqlc.arg(proposal_id)
      AND proposal.id = outcome.proposal_id
      AND proposal.proposal_status = 'accepted'
      AND outcome.review_status = 'pending'
      AND outcome.submitted_by_user_id <> sqlc.arg(participant_user_id)
      AND (
          proposal.applicant_user_id = sqlc.arg(participant_user_id)
          OR opening.owner_user_id = sqlc.arg(participant_user_id)
      )
      AND sqlc.arg(decision)::text IN ('confirmed', 'disputed')
    RETURNING outcome.*
)
SELECT
    decided.id, decided.proposal_id, decided.submitted_by_user_id,
    decided.outcome_status, decided.deliverable_status, decided.work_summary,
    decided.evidence_url, decided.closeout_notes, decided.review_status,
    decided.submitted_at, decided.decided_at,
    profiles.display_name AS submitted_by_display_name,
    CASE
        WHEN decided.submitted_by_user_id = proposal.applicant_user_id THEN 'applicant'
        ELSE 'owner'
    END AS submitted_by_role,
    false AS can_decide
FROM decided
JOIN trial_proposals AS proposal ON proposal.id = decided.proposal_id
JOIN profiles ON profiles.user_id = decided.submitted_by_user_id;

-- name: GetOwnedOpeningTrialProposalReviewScope :one
SELECT id
FROM project_openings
WHERE id = sqlc.arg(opening_id)
  AND owner_user_id = sqlc.arg(owner_user_id);

-- name: ListTrialProposalsForOwner :many
SELECT
    proposal.id, proposal.application_id, proposal.opening_id,
    proposal.applicant_user_id, proposal.outcome, proposal.deliverable,
    proposal.non_goals, proposal.start_date, proposal.end_date,
    proposal.weekly_hours, proposal.check_in_cadence, proposal.access_level,
    proposal.confidentiality, proposal.ip_ownership, proposal.exit_plan,
    proposal.terms_confirmed, proposal.proposal_status,
    proposal.created_at, proposal.updated_at, proposal.sent_at, proposal.decided_at,
    profiles.display_name AS applicant_display_name,
    profiles.primary_role AS applicant_primary_role,
    users.profile_url AS applicant_github_url
FROM trial_proposals AS proposal
JOIN project_openings AS opening ON opening.id = proposal.opening_id
JOIN profiles ON profiles.user_id = proposal.applicant_user_id
JOIN users ON users.id = proposal.applicant_user_id
WHERE proposal.opening_id = sqlc.arg(opening_id)
  AND opening.owner_user_id = sqlc.arg(owner_user_id)
  AND proposal.proposal_status IN ('sent', 'accepted', 'declined')
ORDER BY proposal.sent_at ASC, proposal.id ASC;

-- name: DecideTrialProposalForOwner :one
UPDATE trial_proposals AS proposal SET
    proposal_status = sqlc.arg(decision),
    decided_at = now(),
    updated_at = now()
FROM project_openings AS opening
WHERE proposal.id = sqlc.arg(proposal_id)
  AND proposal.opening_id = sqlc.arg(opening_id)
  AND proposal.proposal_status = 'sent'
  AND opening.id = proposal.opening_id
  AND opening.owner_user_id = sqlc.arg(owner_user_id)
  AND sqlc.arg(decision)::text IN ('accepted', 'declined')
RETURNING proposal.*;
