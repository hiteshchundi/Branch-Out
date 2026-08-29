-- name: DeleteExpiredOAuthAttempts :exec
DELETE FROM oauth_attempts WHERE expires_at <= now();

-- name: CreateOAuthAttempt :exec
INSERT INTO oauth_attempts (state_hash, code_verifier, expires_at)
VALUES (sqlc.arg(state_hash), sqlc.arg(code_verifier), sqlc.arg(expires_at));

-- name: ConsumeOAuthAttempt :one
DELETE FROM oauth_attempts
WHERE state_hash = sqlc.arg(state_hash) AND expires_at > now()
RETURNING code_verifier;

-- name: UpsertGitHubUser :one
INSERT INTO users (
    github_user_id,
    github_login,
    display_name,
    avatar_url,
    profile_url
) VALUES (
    sqlc.arg(github_user_id),
    sqlc.arg(github_login),
    sqlc.narg(display_name),
    sqlc.arg(avatar_url),
    sqlc.arg(profile_url)
)
ON CONFLICT (github_user_id) DO UPDATE SET
    github_login = EXCLUDED.github_login,
    display_name = EXCLUDED.display_name,
    avatar_url = EXCLUDED.avatar_url,
    profile_url = EXCLUDED.profile_url,
    updated_at = now()
RETURNING id, github_user_id, github_login, display_name, avatar_url, profile_url;

-- name: DeleteExpiredSessions :exec
DELETE FROM sessions WHERE expires_at <= now();

-- name: CreateSession :exec
INSERT INTO sessions (token_hash, user_id, expires_at)
VALUES (sqlc.arg(token_hash), sqlc.arg(user_id), sqlc.arg(expires_at));

-- name: GetSessionUser :one
SELECT
    users.id,
    users.github_user_id,
    users.github_login,
    users.display_name,
    users.avatar_url,
    users.profile_url
FROM sessions
JOIN users ON users.id = sessions.user_id
WHERE sessions.token_hash = sqlc.arg(token_hash)
  AND sessions.expires_at > now();

-- name: DeleteSession :exec
DELETE FROM sessions WHERE token_hash = sqlc.arg(token_hash);
