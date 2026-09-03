-- name: CreateTrialFeedbackModerationAppeal :one
WITH eligible_report AS (
    SELECT report.id
    FROM safety_reports AS report
    JOIN trial_feedback AS feedback ON feedback.id = report.target_id
    WHERE report.target_kind = 'trial_feedback'
      AND report.report_status = 'upheld'
      AND report.target_id = sqlc.arg(target_id)
      AND feedback.author_user_id = sqlc.arg(appellant_user_id)
      AND report.reporter_user_id <> sqlc.arg(appellant_user_id)
    ORDER BY report.decided_at ASC, report.id ASC
    LIMIT 1
), inserted AS (
    INSERT INTO moderation_appeals (id, report_id, appellant_user_id, reason)
    SELECT sqlc.arg(id), eligible_report.id, sqlc.arg(appellant_user_id), sqlc.arg(reason)
    FROM eligible_report
    ON CONFLICT (report_id) DO NOTHING
    RETURNING *
)
SELECT inserted.*, report.target_kind, report.target_id, appellant.github_login AS appellant_github_login
FROM inserted
JOIN safety_reports AS report ON report.id = inserted.report_id
JOIN users AS appellant ON appellant.id = inserted.appellant_user_id;

-- name: CreateTrustCandidateModerationAppeal :one
WITH eligible_report AS (
    SELECT report.id
    FROM safety_reports AS report
    JOIN trial_proposals AS proposal ON proposal.id = report.target_id
    JOIN project_openings AS opening ON opening.id = proposal.opening_id
    WHERE report.target_kind = 'trust_candidate'
      AND report.report_status = 'upheld'
      AND report.target_id = sqlc.arg(target_id)
      AND report.reporter_user_id <> sqlc.arg(appellant_user_id)
      AND (
          proposal.applicant_user_id = sqlc.arg(appellant_user_id)
          OR opening.owner_user_id = sqlc.arg(appellant_user_id)
      )
    ORDER BY report.decided_at ASC, report.id ASC
    LIMIT 1
), inserted AS (
    INSERT INTO moderation_appeals (id, report_id, appellant_user_id, reason)
    SELECT sqlc.arg(id), eligible_report.id, sqlc.arg(appellant_user_id), sqlc.arg(reason)
    FROM eligible_report
    ON CONFLICT (report_id) DO NOTHING
    RETURNING *
)
SELECT inserted.*, report.target_kind, report.target_id, appellant.github_login AS appellant_github_login
FROM inserted
JOIN safety_reports AS report ON report.id = inserted.report_id
JOIN users AS appellant ON appellant.id = inserted.appellant_user_id;

-- name: ListModerationAppealsForModerator :many
SELECT appeal.*, report.target_kind, report.target_id, appellant.github_login AS appellant_github_login
FROM moderation_appeals AS appeal
JOIN safety_reports AS report ON report.id = appeal.report_id
JOIN users AS appellant ON appellant.id = appeal.appellant_user_id
WHERE EXISTS (
    SELECT 1 FROM users AS moderator
    WHERE moderator.id = sqlc.arg(moderator_user_id)
      AND moderator.account_role = 'moderator'
)
ORDER BY appeal.created_at ASC, appeal.id ASC;
