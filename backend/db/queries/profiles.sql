-- name: GetProfile :one
SELECT
    profiles.user_id,
    profiles.display_name,
    profiles.primary_role,
    profiles.bio,
    profiles.timezone,
    profiles.weekly_availability,
    profiles.preferred_duration,
    profiles.work_style,
    profiles.communication_cadence,
    profiles.skills,
    profiles.portfolio_url,
    profiles.evidence_summary,
    users.profile_url AS github_url,
    profiles.created_at,
    profiles.updated_at
FROM profiles
JOIN users ON users.id = profiles.user_id
WHERE profiles.user_id = sqlc.arg(user_id);

-- name: UpsertProfile :one
INSERT INTO profiles (
    user_id,
    display_name,
    primary_role,
    bio,
    timezone,
    weekly_availability,
    preferred_duration,
    work_style,
    communication_cadence,
    skills,
    portfolio_url,
    evidence_summary
) VALUES (
    sqlc.arg(user_id),
    sqlc.arg(display_name),
    sqlc.arg(primary_role),
    sqlc.arg(bio),
    sqlc.arg(timezone),
    sqlc.arg(weekly_availability),
    sqlc.arg(preferred_duration),
    sqlc.arg(work_style),
    sqlc.arg(communication_cadence),
    sqlc.arg(skills),
    sqlc.narg(portfolio_url),
    sqlc.arg(evidence_summary)
)
ON CONFLICT (user_id) DO UPDATE SET
    display_name = EXCLUDED.display_name,
    primary_role = EXCLUDED.primary_role,
    bio = EXCLUDED.bio,
    timezone = EXCLUDED.timezone,
    weekly_availability = EXCLUDED.weekly_availability,
    preferred_duration = EXCLUDED.preferred_duration,
    work_style = EXCLUDED.work_style,
    communication_cadence = EXCLUDED.communication_cadence,
    skills = EXCLUDED.skills,
    portfolio_url = EXCLUDED.portfolio_url,
    evidence_summary = EXCLUDED.evidence_summary,
    updated_at = now()
RETURNING
    user_id,
    display_name,
    primary_role,
    bio,
    timezone,
    weekly_availability,
    preferred_duration,
    work_style,
    communication_cadence,
    skills,
    portfolio_url,
    evidence_summary,
    (SELECT profile_url FROM users WHERE id = profiles.user_id) AS github_url,
    created_at,
    updated_at;
