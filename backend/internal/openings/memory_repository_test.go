package openings

import (
	"context"
	"testing"
	"time"
)

func TestMemoryRepositoryList(t *testing.T) {
	repository := NewMemoryRepository(Seed())

	tests := []struct {
		name    string
		filters Filters
		wantIDs []string
	}{
		{name: "all", wantIDs: []string{"climate-data-explorer", "accessible-finance", "research-assistant", "open-source-onboarding", "developer-portfolio"}},
		{name: "text uses every term", filters: Filters{Query: "React climate"}, wantIDs: []string{"climate-data-explorer"}},
		{name: "structured filters combine", filters: Filters{Role: RoleDesign, Compensation: CompensationPaid, Commitment: CommitmentUnderSix}, wantIDs: []string{"accessible-finance"}},
		{name: "conflicting filters", filters: Filters{Query: "Python", Role: RoleDesign}, wantIDs: []string{}},
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

func TestMemoryRepositoryHonorsCancelledContext(t *testing.T) {
	repository := NewMemoryRepository(Seed())
	ctx, cancel := context.WithCancel(context.Background())
	cancel()

	if _, err := repository.List(ctx, Filters{}); err != context.Canceled {
		t.Fatalf("List() error = %v, want context.Canceled", err)
	}
}

func TestMemoryRepositoryExcludesExpiredOpenings(t *testing.T) {
	now := time.Now()
	expiredAt := now.Add(-time.Minute)
	activeAt := now.Add(time.Hour)
	seed := Seed()[:2]
	seed[0].ExpiresAt = &expiredAt
	seed[1].ExpiresAt = &activeAt

	got, err := NewMemoryRepository(seed).List(context.Background(), Filters{})
	if err != nil || len(got) != 1 || got[0].ID != seed[1].ID {
		t.Fatalf("List() = %#v, %v; want only active opening", got, err)
	}
}
