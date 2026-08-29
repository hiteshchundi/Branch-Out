-- name: ListOpenings :many
SELECT
    id,
    title,
    summary,
    skills,
    role,
    compensation,
    commitment,
    commitment_band,
    duration,
    timezone,
    freshness,
    stage,
    desired_outcome,
    first_milestone,
    owner_contribution,
    owner_name,
    owner_signal,
    confidentiality
FROM project_openings
WHERE
    publication_status = 'published'
    AND (sqlc.arg(role)::text = '' OR role = sqlc.arg(role)::text)
    AND (sqlc.arg(compensation)::text = '' OR compensation = sqlc.arg(compensation)::text)
    AND (sqlc.arg(commitment)::text = '' OR commitment_band = sqlc.arg(commitment)::text)
    AND (
        trim(sqlc.arg(query)::text) = ''
        OR to_tsvector(
            'simple',
            concat_ws(
                ' ',
                title,
                summary,
                array_to_string(skills, ' '),
                role,
                compensation,
                commitment,
                duration,
                timezone,
                stage
            )
        ) @@ plainto_tsquery('simple', sqlc.arg(query)::text)
    )
ORDER BY display_order, id;

-- name: ListOwnedOpenings :many
SELECT
    id, title, summary, skills, role, compensation, commitment,
    commitment_band, duration, timezone, freshness, stage,
    desired_outcome, first_milestone, owner_contribution, owner_name,
    owner_signal, confidentiality, publication_status
FROM project_openings
WHERE owner_user_id = sqlc.arg(owner_user_id)
ORDER BY updated_at DESC, id;

-- name: CreateOwnedOpening :one
INSERT INTO project_openings (
    id, title, summary, skills, role, compensation, commitment,
    commitment_band, duration, timezone, freshness, stage,
    desired_outcome, first_milestone, owner_contribution, owner_name,
    owner_signal, confidentiality, display_order, owner_user_id,
    publication_status
) VALUES (
    sqlc.arg(id), sqlc.arg(title), sqlc.arg(summary), sqlc.arg(skills),
    sqlc.arg(role), sqlc.arg(compensation), sqlc.arg(commitment),
    sqlc.arg(commitment_band), sqlc.arg(duration), sqlc.arg(timezone),
    sqlc.arg(freshness), sqlc.arg(stage), sqlc.arg(desired_outcome),
    sqlc.arg(first_milestone), sqlc.arg(owner_contribution),
    sqlc.arg(owner_name), sqlc.arg(owner_signal), sqlc.arg(confidentiality),
    0, sqlc.arg(owner_user_id), 'draft'
)
RETURNING
    id, title, summary, skills, role, compensation, commitment,
    commitment_band, duration, timezone, freshness, stage,
    desired_outcome, first_milestone, owner_contribution, owner_name,
    owner_signal, confidentiality, publication_status;

-- name: UpdateOwnedDraft :one
UPDATE project_openings SET
    title = sqlc.arg(title),
    summary = sqlc.arg(summary),
    skills = sqlc.arg(skills),
    role = sqlc.arg(role),
    compensation = sqlc.arg(compensation),
    commitment = sqlc.arg(commitment),
    commitment_band = sqlc.arg(commitment_band),
    duration = sqlc.arg(duration),
    timezone = sqlc.arg(timezone),
    desired_outcome = sqlc.arg(desired_outcome),
    first_milestone = sqlc.arg(first_milestone),
    owner_contribution = sqlc.arg(owner_contribution),
    owner_name = sqlc.arg(owner_name),
    confidentiality = sqlc.arg(confidentiality),
    updated_at = now()
WHERE id = sqlc.arg(id)
  AND owner_user_id = sqlc.arg(owner_user_id)
  AND publication_status = 'draft'
RETURNING
    id, title, summary, skills, role, compensation, commitment,
    commitment_band, duration, timezone, freshness, stage,
    desired_outcome, first_milestone, owner_contribution, owner_name,
    owner_signal, confidentiality, publication_status;
