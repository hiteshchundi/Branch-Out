package openings

import (
	"context"
	"os"
	"testing"

	"github.com/hiteshchundi/branch-out/backend/internal/database"
	"github.com/jackc/pgx/v5/pgxpool"
)

func TestPostgresRepositoryList(t *testing.T) {
	databaseURL := os.Getenv("BRANCH_OUT_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BRANCH_OUT_TEST_DATABASE_URL is not set")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	t.Cleanup(pool.Close)

	repository := NewPostgresRepository(database.New(pool))
	tests := []struct {
		name    string
		filters Filters
		wantIDs []string
	}{
		{
			name: "all",
			wantIDs: []string{
				"climate-data-explorer", "accessible-finance", "research-assistant",
				"open-source-onboarding", "developer-portfolio",
			},
		},
		{
			name:    "text uses every term",
			filters: Filters{Query: "React climate"},
			wantIDs: []string{"climate-data-explorer"},
		},
		{
			name:    "structured filters combine",
			filters: Filters{Role: RoleDesign, Compensation: CompensationPaid, Commitment: CommitmentUnderSix},
			wantIDs: []string{"accessible-finance"},
		},
		{
			name:    "conflicting filters",
			filters: Filters{Query: "Python", Role: RoleDesign},
			wantIDs: []string{},
		},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			got, err := repository.List(context.Background(), test.filters)
			if err != nil {
				t.Fatalf("List() error = %v", err)
			}
			if len(got) != len(test.wantIDs) {
				t.Fatalf("List() returned %d openings, want %d", len(got), len(test.wantIDs))
			}
			for index, wantID := range test.wantIDs {
				if got[index].ID != wantID {
					t.Errorf("List()[%d].ID = %q, want %q", index, got[index].ID, wantID)
				}
			}
		})
	}
}

func TestPostgresRepositoryHonorsCancelledContext(t *testing.T) {
	databaseURL := os.Getenv("BRANCH_OUT_TEST_DATABASE_URL")
	if databaseURL == "" {
		t.Skip("BRANCH_OUT_TEST_DATABASE_URL is not set")
	}

	pool, err := pgxpool.New(context.Background(), databaseURL)
	if err != nil {
		t.Fatalf("connect to PostgreSQL: %v", err)
	}
	defer pool.Close()

	ctx, cancel := context.WithCancel(context.Background())
	cancel()
	_, err = NewPostgresRepository(database.New(pool)).List(ctx, Filters{})
	if err != context.Canceled {
		t.Fatalf("List() error = %v, want context.Canceled", err)
	}
}
