package auth

import (
	"context"
	"crypto/sha256"
	"errors"
	"os"
	"testing"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresStoreOAuthAndSessionLifecycle(t *testing.T) {
	databaseURL := os.Getenv("BRANCH_OUT_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BRANCH_OUT_TEST_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)
	if _, err := pool.Exec(ctx, "TRUNCATE sessions, oauth_attempts, users RESTART IDENTITY CASCADE"); err != nil {
		t.Fatalf("reset auth tables: %v", err)
	}

	store := NewPostgresStore(database.New(pool))
	stateHash := sha256.Sum256([]byte("state"))
	if err := store.CreateOAuthAttempt(ctx, stateHash[:], "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ", time.Now().Add(time.Minute)); err != nil {
		t.Fatalf("CreateOAuthAttempt() error = %v", err)
	}
	verifier, err := store.ConsumeOAuthAttempt(ctx, stateHash[:])
	if err != nil || verifier != "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ" {
		t.Fatalf("ConsumeOAuthAttempt() = %q, %v", verifier, err)
	}
	if _, err := store.ConsumeOAuthAttempt(ctx, stateHash[:]); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("replayed ConsumeOAuthAttempt() error = %v", err)
	}

	name := "Asha Rao"
	user, err := store.UpsertGitHubUser(ctx, GitHubUser{
		ID: 42, Login: "asha-rao", Name: &name,
		AvatarURL:  "https://avatars.githubusercontent.com/u/42",
		ProfileURL: "https://github.com/asha-rao",
	})
	if err != nil {
		t.Fatalf("UpsertGitHubUser() error = %v", err)
	}
	updatedName := "Asha R."
	updated, err := store.UpsertGitHubUser(ctx, GitHubUser{
		ID: 42, Login: "asha-rao", Name: &updatedName,
		AvatarURL:  "https://avatars.githubusercontent.com/u/42?v=2",
		ProfileURL: "https://github.com/asha-rao",
	})
	if err != nil || updated.ID != user.ID || updated.DisplayName == nil || *updated.DisplayName != updatedName {
		t.Fatalf("updated user = %#v, %v", updated, err)
	}

	tokenHash := sha256.Sum256([]byte("session-token"))
	if err := store.CreateSession(ctx, tokenHash[:], user.ID, time.Now().Add(time.Hour)); err != nil {
		t.Fatalf("CreateSession() error = %v", err)
	}
	current, err := store.GetSessionUser(ctx, tokenHash[:])
	if err != nil || current.ID != user.ID || current.GitHubLogin != "asha-rao" {
		t.Fatalf("GetSessionUser() = %#v, %v", current, err)
	}
	if err := store.DeleteSession(ctx, tokenHash[:]); err != nil {
		t.Fatalf("DeleteSession() error = %v", err)
	}
	if _, err := store.GetSessionUser(ctx, tokenHash[:]); !errors.Is(err, ErrInvalidSession) {
		t.Fatalf("GetSessionUser() after logout error = %v", err)
	}
}

func TestPostgresStoreRejectsExpiredRecords(t *testing.T) {
	databaseURL := os.Getenv("BRANCH_OUT_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BRANCH_OUT_TEST_DATABASE_URL is not set")
	}

	ctx := context.Background()
	pool, err := pgxpool.New(ctx, databaseURL)
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	defer pool.Close()
	store := NewPostgresStore(database.New(pool))

	stateHash := sha256.Sum256([]byte("expired-state"))
	if err := store.CreateOAuthAttempt(ctx, stateHash[:], "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQ", time.Now().Add(-time.Minute)); err != nil {
		t.Fatalf("CreateOAuthAttempt() error = %v", err)
	}
	if _, err := store.ConsumeOAuthAttempt(ctx, stateHash[:]); !errors.Is(err, ErrInvalidState) {
		t.Fatalf("expired OAuth attempt error = %v", err)
	}
}
