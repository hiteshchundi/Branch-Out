package applications

import (
	"context"
	"errors"
	"fmt"
	"os"
	"testing"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/hiteshchundi/branch-out/backend/internal/openings"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresApplicationLifecycle(t *testing.T) {
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
	openingManager := openings.NewManager(openings.NewPostgresRepository(queries), profileService)
	manager := NewManager(NewPostgresStore(queries), profileService)

	identifier := time.Now().UnixNano()
	owner := createApplicationTestUser(t, ctx, authStore, profileService, identifier, "Opening Owner")
	applicant := createApplicationTestUser(t, ctx, authStore, profileService, identifier+1, "First Applicant")
	secondApplicant := createApplicationTestUser(t, ctx, authStore, profileService, identifier+2, "Second Applicant")
	t.Cleanup(func() {
		_, _ = pool.Exec(context.Background(), "DELETE FROM applications WHERE applicant_user_id = ANY($1)", []int64{applicant.ID, secondApplicant.ID})
		_, _ = pool.Exec(context.Background(), "DELETE FROM project_openings WHERE owner_user_id = $1", owner.ID)
		_, _ = pool.Exec(context.Background(), "DELETE FROM users WHERE id = ANY($1)", []int64{owner.ID, applicant.ID, secondApplicant.ID})
	})

	openingInput := openings.DraftInput{
		ProjectName: "Application lifecycle", Problem: "Test private application persistence against a published opening.",
		Role: "Backend engineer", Skills: []string{"Go", "PostgreSQL"}, Commitment: "6–8 hrs/week",
		Duration: "5–8 weeks", Timezone: "UTC to UTC+4", Compensation: "Fixed bounty",
		FirstMilestone:    "Build and test the first bounded application workflow endpoint.",
		OwnerContribution: "The opening, data model, and review criteria are already prepared.", Confidentiality: "Public",
	}
	opening, err := openingManager.CreateDraft(ctx, owner.ID, openingInput)
	if err != nil {
		t.Fatalf("CreateDraft() error = %v", err)
	}
	opening, err = openingManager.PublishDraft(ctx, owner.ID, opening.ID)
	if err != nil {
		t.Fatalf("PublishDraft() error = %v", err)
	}

	if _, err := manager.SaveDraft(ctx, owner.ID, opening.ID, validInput()); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("owner SaveDraft() error = %v, want ErrUnavailable", err)
	}
	draft, err := manager.SaveDraft(ctx, applicant.ID, opening.ID, validInput())
	if err != nil || draft.Status != "draft" || draft.SubmittedAt != nil {
		t.Fatalf("SaveDraft() = %#v, %v", draft, err)
	}
	loaded, err := manager.GetOwn(ctx, applicant.ID, opening.ID)
	if err != nil || loaded.ID != draft.ID {
		t.Fatalf("GetOwn() = %#v, %v", loaded, err)
	}
	updatedInput := validInput()
	updatedInput.Availability = "8 hours each week"
	updated, err := manager.SaveDraft(ctx, applicant.ID, opening.ID, updatedInput)
	if err != nil || updated.ID != draft.ID || updated.Input.Availability != updatedInput.Availability {
		t.Fatalf("updated SaveDraft() = %#v, %v", updated, err)
	}
	submitted, err := manager.Submit(ctx, applicant.ID, opening.ID)
	if err != nil || submitted.Status != "submitted" || submitted.SubmittedAt == nil {
		t.Fatalf("Submit() = %#v, %v", submitted, err)
	}
	if _, err := manager.SaveDraft(ctx, applicant.ID, opening.ID, validInput()); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("submitted SaveDraft() error = %v, want ErrUnavailable", err)
	}
	if _, err := manager.Submit(ctx, applicant.ID, opening.ID); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("repeated Submit() error = %v, want ErrUnavailable", err)
	}
	reviewed, err := manager.ListSubmittedForOwner(ctx, owner.ID, opening.ID)
	if err != nil || len(reviewed) != 1 || reviewed[0].ID != submitted.ID || reviewed[0].Applicant.DisplayName != "First Applicant" {
		t.Fatalf("ListSubmittedForOwner() = %#v, %v", reviewed, err)
	}
	if _, err := manager.ListSubmittedForOwner(ctx, applicant.ID, opening.ID); !errors.Is(err, ErrReviewNotFound) {
		t.Fatalf("non-owner review error = %v, want ErrReviewNotFound", err)
	}

	if _, err := manager.SaveDraft(ctx, secondApplicant.ID, opening.ID, validInput()); err != nil {
		t.Fatalf("second applicant SaveDraft() error = %v", err)
	}
	if _, err := openingManager.CloseOpening(ctx, owner.ID, opening.ID); err != nil {
		t.Fatalf("CloseOpening() error = %v", err)
	}
	if _, err := manager.Submit(ctx, secondApplicant.ID, opening.ID); !errors.Is(err, ErrUnavailable) {
		t.Fatalf("closed opening Submit() error = %v, want ErrUnavailable", err)
	}
	reviewed, err = manager.ListSubmittedForOwner(ctx, owner.ID, opening.ID)
	if err != nil || len(reviewed) != 1 {
		t.Fatalf("closed opening review = %#v, %v", reviewed, err)
	}
}

func createApplicationTestUser(
	t *testing.T,
	ctx context.Context,
	authStore *auth.PostgresStore,
	profileService *profile.Service,
	githubID int64,
	displayName string,
) auth.User {
	t.Helper()
	user, err := authStore.UpsertGitHubUser(ctx, auth.GitHubUser{
		ID: githubID, Login: fmt.Sprintf("application-user-%d", githubID), Name: &displayName,
		AvatarURL: "https://avatars.example/application", ProfileURL: "https://github.com/application-user",
	})
	if err != nil {
		t.Fatalf("create test user: %v", err)
	}
	_, err = profileService.Save(ctx, user.ID, profile.Input{
		DisplayName: displayName, PrimaryRole: "Software developer",
		Bio:      "I build dependable collaboration products with clear evidence and bounded delivery milestones.",
		Timezone: "Asia/Kolkata", WeeklyAvailability: "6–8 hrs/week", PreferredDuration: "5–8 weeks",
		WorkStyle: "Async-first", CommunicationCadence: "Three updates per week",
		Skills: []string{"Go", "PostgreSQL"}, EvidenceSummary: "Recent work is visible in public repositories and reviewed pull requests.",
	})
	if err != nil {
		t.Fatalf("create test profile: %v", err)
	}
	return user
}
