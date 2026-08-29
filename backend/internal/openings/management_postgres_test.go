package openings

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresOwnerDraftLifecycle(t *testing.T) {
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

	queries := database.New(pool)
	authStore := auth.NewPostgresStore(queries)
	profileService := profile.NewService(profile.NewPostgresStore(queries))
	repository := NewPostgresRepository(queries)
	manager := NewManager(repository, profileService)
	manager.random = bytes.NewReader(make([]byte, 32))

	identifier := time.Now().UnixNano()
	firstUser := createDraftTestUser(t, ctx, authStore, profileService, identifier, "First Owner")
	secondUser := createDraftTestUser(t, ctx, authStore, profileService, identifier+1, "Second Owner")
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM project_openings WHERE owner_user_id = ANY($1)", []int64{firstUser.ID, secondUser.ID})
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = ANY($1)", []int64{firstUser.ID, secondUser.ID})
	})

	input := validDraftInput()
	created, err := manager.CreateDraft(ctx, firstUser.ID, input)
	if err != nil {
		t.Fatalf("CreateDraft() error = %v", err)
	}
	if created.PublicationStatus != "draft" {
		t.Errorf("publication status = %q, want draft", created.PublicationStatus)
	}

	owned, err := manager.ListOwned(ctx, firstUser.ID)
	if err != nil {
		t.Fatalf("ListOwned() error = %v", err)
	}
	if len(owned) != 1 || owned[0].ID != created.ID {
		t.Fatalf("owned openings = %#v, want the created draft", owned)
	}

	public, err := repository.List(ctx, Filters{})
	if err != nil {
		t.Fatalf("List() error = %v", err)
	}
	for _, opening := range public {
		if opening.ID == created.ID {
			t.Fatal("owner draft leaked into public discovery")
		}
	}

	input.ProjectName = "Updated collaboration workspace"
	updated, err := manager.UpdateDraft(ctx, firstUser.ID, created.ID, input)
	if err != nil {
		t.Fatalf("UpdateDraft() error = %v", err)
	}
	if updated.Title != "Frontend engineer for Updated collaboration workspace" {
		t.Errorf("updated title = %q", updated.Title)
	}

	_, err = manager.UpdateDraft(ctx, secondUser.ID, created.ID, input)
	if !errors.Is(err, ErrDraftNotFound) {
		t.Fatalf("other owner's UpdateDraft() error = %v, want ErrDraftNotFound", err)
	}
}

func createDraftTestUser(
	t *testing.T,
	ctx context.Context,
	authStore *auth.PostgresStore,
	profileService *profile.Service,
	githubID int64,
	displayName string,
) auth.User {
	t.Helper()
	user, err := authStore.UpsertGitHubUser(ctx, auth.GitHubUser{
		ID: githubID, Login: fmt.Sprintf("draft-owner-%d", githubID), Name: &displayName,
		AvatarURL: "https://avatars.example/owner", ProfileURL: "https://github.com/draft-owner",
	})
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	_, err = profileService.Save(ctx, user.ID, profile.Input{
		DisplayName: displayName, PrimaryRole: "Software developer",
		Bio:      "I build dependable collaboration products with small, evidence-backed delivery milestones.",
		Timezone: "Asia/Kolkata", WeeklyAvailability: "6–8 hrs/week", PreferredDuration: "5–8 weeks",
		WorkStyle: "Async-first", CommunicationCadence: "Three updates per week",
		Skills: []string{"Go", "PostgreSQL"}, EvidenceSummary: "Recent backend work is visible in public repositories and reviewed pull requests.",
	})
	if err != nil {
		t.Fatalf("create test profile: %v", err)
	}
	return user
}
