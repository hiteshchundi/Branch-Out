package profile

import (
	"context"
	"errors"
	"os"
	"testing"

	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresStoreProfileLifecycle(t *testing.T) {
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
	const githubUserID int64 = 4_200_002
	if _, err := pool.Exec(ctx, "DELETE FROM users WHERE github_user_id = $1", githubUserID); err != nil {
		t.Fatalf("reset profile test user: %v", err)
	}
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE github_user_id = $1", githubUserID)
	})

	queries := database.New(pool)
	name := "Asha Rao"
	user, err := auth.NewPostgresStore(queries).UpsertGitHubUser(ctx, auth.GitHubUser{
		ID: githubUserID, Login: "asha-rao-profile-test", Name: &name,
		AvatarURL: "https://avatars.githubusercontent.com/u/42", ProfileURL: "https://github.com/asha-rao",
	})
	if err != nil {
		t.Fatalf("create user: %v", err)
	}
	store := NewPostgresStore(queries)
	if _, err := store.Get(ctx, user.ID); !errors.Is(err, ErrNotFound) {
		t.Fatalf("missing Get() error = %v", err)
	}

	created, err := store.Save(ctx, user.ID, validInput())
	if err != nil {
		t.Fatalf("Save() error = %v", err)
	}
	if created.UserID != user.ID || created.GitHubURL != "https://github.com/asha-rao" || len(created.Skills) != 3 {
		t.Fatalf("created profile = %#v", created)
	}

	updatedInput := validInput()
	updatedInput.DisplayName = "Asha R."
	updatedInput.PortfolioURL = nil
	updated, err := store.Save(ctx, user.ID, updatedInput)
	if err != nil {
		t.Fatalf("update Save() error = %v", err)
	}
	if updated.DisplayName != "Asha R." || updated.PortfolioURL != nil || !updated.CreatedAt.Equal(created.CreatedAt) || updated.UpdatedAt.Before(created.UpdatedAt) {
		t.Fatalf("updated profile = %#v", updated)
	}
	loaded, err := store.Get(ctx, user.ID)
	if err != nil || loaded.DisplayName != "Asha R." {
		t.Fatalf("Get() = %#v, %v", loaded, err)
	}
}
