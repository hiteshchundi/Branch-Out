package auth

import (
	"context"
	"errors"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/jackc/pgx/v5"
)

type PostgresStore struct {
	queries *database.Queries
}

func NewPostgresStore(queries *database.Queries) *PostgresStore {
	return &PostgresStore{queries: queries}
}

func (store *PostgresStore) CreateOAuthAttempt(ctx context.Context, stateHash []byte, verifier string, expiresAt time.Time) error {
	if err := store.queries.DeleteExpiredOAuthAttempts(ctx); err != nil {
		return err
	}
	return store.queries.CreateOAuthAttempt(ctx, database.CreateOAuthAttemptParams{
		StateHash: stateHash, CodeVerifier: verifier, ExpiresAt: expiresAt,
	})
}

func (store *PostgresStore) ConsumeOAuthAttempt(ctx context.Context, stateHash []byte) (string, error) {
	verifier, err := store.queries.ConsumeOAuthAttempt(ctx, stateHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return "", ErrInvalidState
	}
	return verifier, err
}

func (store *PostgresStore) UpsertGitHubUser(ctx context.Context, githubUser GitHubUser) (User, error) {
	row, err := store.queries.UpsertGitHubUser(ctx, database.UpsertGitHubUserParams{
		GithubUserID: githubUser.ID,
		GithubLogin:  githubUser.Login,
		DisplayName:  githubUser.Name,
		AvatarUrl:    githubUser.AvatarURL,
		ProfileUrl:   githubUser.ProfileURL,
	})
	if err != nil {
		return User{}, err
	}
	return User{
		ID: row.ID, GitHubUserID: row.GithubUserID, GitHubLogin: row.GithubLogin,
		DisplayName: row.DisplayName, AvatarURL: row.AvatarUrl, ProfileURL: row.ProfileUrl,
	}, nil
}

func (store *PostgresStore) CreateSession(ctx context.Context, tokenHash []byte, userID int64, expiresAt time.Time) error {
	if err := store.queries.DeleteExpiredSessions(ctx); err != nil {
		return err
	}
	return store.queries.CreateSession(ctx, database.CreateSessionParams{
		TokenHash: tokenHash, UserID: userID, ExpiresAt: expiresAt,
	})
}

func (store *PostgresStore) GetSessionUser(ctx context.Context, tokenHash []byte) (User, error) {
	row, err := store.queries.GetSessionUser(ctx, tokenHash)
	if errors.Is(err, pgx.ErrNoRows) {
		return User{}, ErrInvalidSession
	}
	if err != nil {
		return User{}, err
	}
	return User{
		ID: row.ID, GitHubUserID: row.GithubUserID, GitHubLogin: row.GithubLogin,
		DisplayName: row.DisplayName, AvatarURL: row.AvatarUrl, ProfileURL: row.ProfileUrl,
	}, nil
}

func (store *PostgresStore) DeleteSession(ctx context.Context, tokenHash []byte) error {
	return store.queries.DeleteSession(ctx, tokenHash)
}
