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
    (sqlc.arg(role)::text = '' OR role = sqlc.arg(role)::text)
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
