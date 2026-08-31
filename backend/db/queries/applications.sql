-- name: GetOwnApplication :one
SELECT
    id, opening_id, applicant_user_id, message, work_sample_url,
    work_sample_context, availability, availability_confirmed,
    proposed_contribution, status, submitted_at, created_at, updated_at, decided_at, withdrawn_at
FROM applications
WHERE opening_id = sqlc.arg(opening_id)
  AND applicant_user_id = sqlc.arg(applicant_user_id);

-- name: UpsertApplicationDraft :one
INSERT INTO applications (
    id, opening_id, applicant_user_id, message, work_sample_url,
    work_sample_context, availability, availability_confirmed,
    proposed_contribution, status
)
SELECT
    sqlc.arg(id), opening.id, sqlc.arg(applicant_user_id), sqlc.arg(message),
    sqlc.arg(work_sample_url), sqlc.arg(work_sample_context),
    sqlc.arg(availability), sqlc.arg(availability_confirmed),
    sqlc.arg(proposed_contribution), 'draft'
FROM project_openings AS opening
WHERE opening.id = sqlc.arg(opening_id)
  AND opening.publication_status = 'published'
  AND opening.owner_user_id IS DISTINCT FROM sqlc.arg(applicant_user_id)
ON CONFLICT (opening_id, applicant_user_id) DO UPDATE SET
    message = EXCLUDED.message,
    work_sample_url = EXCLUDED.work_sample_url,
    work_sample_context = EXCLUDED.work_sample_context,
    availability = EXCLUDED.availability,
    availability_confirmed = EXCLUDED.availability_confirmed,
    proposed_contribution = EXCLUDED.proposed_contribution,
    updated_at = now()
WHERE applications.status = 'draft'
RETURNING
    id, opening_id, applicant_user_id, message, work_sample_url,
    work_sample_context, availability, availability_confirmed,
    proposed_contribution, status, submitted_at, created_at, updated_at, decided_at, withdrawn_at;

-- name: SubmitOwnApplication :one
UPDATE applications AS application SET
    status = 'submitted',
    submitted_at = now(),
    updated_at = now()
FROM project_openings AS opening
WHERE application.opening_id = sqlc.arg(opening_id)
  AND application.applicant_user_id = sqlc.arg(applicant_user_id)
  AND application.status = 'draft'
  AND opening.id = application.opening_id
  AND opening.publication_status = 'published'
  AND opening.owner_user_id IS DISTINCT FROM application.applicant_user_id
RETURNING
    application.id, application.opening_id, application.applicant_user_id,
    application.message, application.work_sample_url,
    application.work_sample_context, application.availability,
    application.availability_confirmed, application.proposed_contribution,
    application.status, application.submitted_at, application.created_at,
    application.updated_at, application.decided_at, application.withdrawn_at;

-- name: GetOwnedOpeningApplicationReviewScope :one
SELECT id
FROM project_openings
WHERE id = sqlc.arg(opening_id)
  AND owner_user_id = sqlc.arg(owner_user_id);

-- name: ListReviewableApplicationsForOwner :many
SELECT
    application.id, application.opening_id, application.applicant_user_id,
    application.message, application.work_sample_url,
    application.work_sample_context, application.availability,
    application.availability_confirmed, application.proposed_contribution,
    application.status, application.submitted_at, application.created_at,
    application.updated_at, application.decided_at, application.withdrawn_at,
    profiles.display_name AS applicant_display_name,
    profiles.primary_role AS applicant_primary_role,
    profiles.skills AS applicant_skills,
    users.profile_url AS applicant_github_url,
    profiles.portfolio_url AS applicant_portfolio_url,
    profiles.evidence_summary AS applicant_evidence_summary
FROM applications AS application
JOIN project_openings AS opening ON opening.id = application.opening_id
JOIN profiles ON profiles.user_id = application.applicant_user_id
JOIN users ON users.id = application.applicant_user_id
WHERE application.opening_id = sqlc.arg(opening_id)
  AND opening.owner_user_id = sqlc.arg(owner_user_id)
  AND application.status IN ('submitted', 'accepted', 'declined', 'withdrawn')
ORDER BY application.submitted_at ASC, application.id ASC;

-- name: DecideApplicationForOwner :one
UPDATE applications AS application SET
    status = sqlc.arg(decision),
    decided_at = now(),
    updated_at = now()
FROM project_openings AS opening
WHERE application.id = sqlc.arg(application_id)
  AND application.opening_id = sqlc.arg(opening_id)
  AND application.status = 'submitted'
  AND opening.id = application.opening_id
  AND opening.owner_user_id = sqlc.arg(owner_user_id)
  AND sqlc.arg(decision)::text IN ('accepted', 'declined')
RETURNING
    application.id, application.opening_id, application.applicant_user_id,
    application.message, application.work_sample_url,
    application.work_sample_context, application.availability,
    application.availability_confirmed, application.proposed_contribution,
    application.status, application.submitted_at, application.created_at,
    application.updated_at, application.decided_at, application.withdrawn_at;

-- name: WithdrawOwnApplication :one
UPDATE applications SET
    status = 'withdrawn',
    withdrawn_at = now(),
    updated_at = now()
WHERE opening_id = sqlc.arg(opening_id)
  AND applicant_user_id = sqlc.arg(applicant_user_id)
  AND status = 'submitted'
RETURNING
    id, opening_id, applicant_user_id, message, work_sample_url,
    work_sample_context, availability, availability_confirmed,
    proposed_contribution, status, submitted_at, created_at, updated_at,
    decided_at, withdrawn_at;
