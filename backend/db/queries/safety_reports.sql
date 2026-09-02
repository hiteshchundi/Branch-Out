-- name: CreateTrialFeedbackSafetyReport :one
WITH report_target AS (
    SELECT
        feedback.id AS target_id,
        jsonb_build_object(
            'id', feedback.id,
            'proposalId', feedback.proposal_id,
            'authorUserId', feedback.author_user_id,
            'observedBehaviors', feedback.observed_behaviors,
            'collaborationExample', feedback.collaboration_example,
            'collaborateAgain', feedback.collaborate_again,
            'reviewSummary', feedback.review_summary,
            'submittedAt', feedback.submitted_at
        ) AS target_snapshot
    FROM trial_feedback AS feedback
    JOIN trial_proposals AS proposal ON proposal.id = feedback.proposal_id
    JOIN project_openings AS opening ON opening.id = proposal.opening_id
    WHERE feedback.id = sqlc.arg(target_id)
      AND feedback.author_user_id <> sqlc.arg(reporter_user_id)
      AND (
          proposal.applicant_user_id = sqlc.arg(reporter_user_id)
          OR opening.owner_user_id = sqlc.arg(reporter_user_id)
      )
), inserted AS (
    INSERT INTO safety_reports (
        id, reporter_user_id, target_kind, target_id, category, details, target_snapshot
    )
    SELECT
        sqlc.arg(id), sqlc.arg(reporter_user_id), 'trial_feedback',
        report_target.target_id, sqlc.arg(category), sqlc.arg(details), report_target.target_snapshot
    FROM report_target
    ON CONFLICT (reporter_user_id, target_kind, target_id) DO NOTHING
    RETURNING *
)
SELECT inserted.*, reporter.github_login AS reporter_github_login
FROM inserted
JOIN users AS reporter ON reporter.id = inserted.reporter_user_id;

-- name: CreateTrustCandidateSafetyReport :one
WITH report_target AS (
    SELECT
        proposal.id AS target_id,
        jsonb_build_object(
            'proposalId', proposal.id,
            'outcomeStatus', outcome.outcome_status,
            'deliverableStatus', outcome.deliverable_status,
            'reviewStatus', outcome.review_status,
            'feedback', COALESCE((
                SELECT jsonb_agg(jsonb_build_object(
                    'id', feedback.id,
                    'authorUserId', feedback.author_user_id,
                    'observedBehaviors', feedback.observed_behaviors,
                    'collaborateAgain', feedback.collaborate_again,
                    'reviewSummary', feedback.review_summary,
                    'acknowledgedAt', feedback.acknowledged_at
                ) ORDER BY feedback.submitted_at ASC, feedback.id ASC)
                FROM trial_feedback AS feedback
                WHERE feedback.proposal_id = proposal.id
            ), '[]'::jsonb)
        ) AS target_snapshot
    FROM trial_proposals AS proposal
    JOIN project_openings AS opening ON opening.id = proposal.opening_id
    JOIN trial_outcomes AS outcome ON outcome.proposal_id = proposal.id
    WHERE proposal.id = sqlc.arg(target_id)
      AND outcome.review_status = 'confirmed'
      AND (
          proposal.applicant_user_id = sqlc.arg(reporter_user_id)
          OR opening.owner_user_id = sqlc.arg(reporter_user_id)
      )
), inserted AS (
    INSERT INTO safety_reports (
        id, reporter_user_id, target_kind, target_id, category, details, target_snapshot
    )
    SELECT
        sqlc.arg(id), sqlc.arg(reporter_user_id), 'trust_candidate',
        report_target.target_id, sqlc.arg(category), sqlc.arg(details), report_target.target_snapshot
    FROM report_target
    ON CONFLICT (reporter_user_id, target_kind, target_id) DO NOTHING
    RETURNING *
)
SELECT inserted.*, reporter.github_login AS reporter_github_login
FROM inserted
JOIN users AS reporter ON reporter.id = inserted.reporter_user_id;

-- name: ListSafetyReportsForModerator :many
SELECT report.*, reporter.github_login AS reporter_github_login
FROM safety_reports AS report
JOIN users AS reporter ON reporter.id = report.reporter_user_id
WHERE EXISTS (
    SELECT 1 FROM users AS moderator
    WHERE moderator.id = sqlc.arg(moderator_user_id)
      AND moderator.account_role = 'moderator'
)
ORDER BY
    CASE WHEN report.report_status = 'pending' THEN 0 ELSE 1 END,
    report.created_at ASC,
    report.id ASC;

-- name: GetModeratorSafetyScope :one
SELECT id
FROM users
WHERE id = sqlc.arg(moderator_user_id)
  AND account_role = 'moderator';

-- name: DecideSafetyReportForModerator :one
WITH decided AS (
    UPDATE safety_reports AS report SET
        report_status = sqlc.arg(decision),
        reviewed_by_user_id = sqlc.arg(moderator_user_id),
        moderator_notes = sqlc.arg(moderator_notes),
        decided_at = now()
    WHERE report.id = sqlc.arg(report_id)
      AND report.report_status = 'pending'
      AND sqlc.arg(decision)::text IN ('upheld', 'dismissed')
      AND EXISTS (
          SELECT 1 FROM users AS moderator
          WHERE moderator.id = sqlc.arg(moderator_user_id)
            AND moderator.account_role = 'moderator'
      )
    RETURNING report.*
)
SELECT decided.*, reporter.github_login AS reporter_github_login
FROM decided
JOIN users AS reporter ON reporter.id = decided.reporter_user_id;
