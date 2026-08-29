package openings

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

func validDraftInput() DraftInput {
	return DraftInput{
		ProjectName: "Climate mapper",
		Problem:     "Help local teams understand climate risks with clear regional data.",
		Role:        "Frontend engineer", Skills: []string{"TypeScript", "React"},
		Commitment: "6–8 hrs/week", Duration: "5–8 weeks", Timezone: "UTC to UTC+4",
		Compensation:      "Fixed bounty",
		FirstMilestone:    "Build the first interactive region comparison with test coverage.",
		OwnerContribution: "The API, research notes, and working wireframes are already complete.",
		Confidentiality:   "Public",
	}
}

func TestManagerCreatesOwnerOnlyDraftFromProfile(t *testing.T) {
	store := &fakeDraftStore{created: ManagedOpening{PublicationStatus: "draft"}}
	manager := NewManager(store, fakeOwnerProfile{profile: profile.Profile{DisplayName: "Asha Rao"}})
	manager.random = strings.NewReader(strings.Repeat("a", 16))

	result, err := manager.CreateDraft(context.Background(), 7, validDraftInput())
	if err != nil || result.PublicationStatus != "draft" {
		t.Fatalf("CreateDraft() = %#v, %v", result, err)
	}
	if store.record.OwnerUserID != 7 || store.record.OwnerName != "Asha Rao" || store.record.Role != RoleEngineering || store.record.Title != "Frontend engineer for Climate mapper" {
		t.Fatalf("created record = %#v", store.record)
	}
	if store.record.ID != "61616161-6161-4161-a161-616161616161" || store.record.Freshness != "Draft · not published" {
		t.Fatalf("generated draft identity = %q, %q", store.record.ID, store.record.Freshness)
	}
}

func TestManagerRequiresProfileAndValidInput(t *testing.T) {
	manager := NewManager(&fakeDraftStore{}, fakeOwnerProfile{err: profile.ErrNotFound})
	_, err := manager.CreateDraft(context.Background(), 7, validDraftInput())
	if !errors.Is(err, profile.ErrNotFound) {
		t.Fatalf("missing profile error = %v", err)
	}

	input := validDraftInput()
	input.Skills = []string{"React", "react"}
	manager = NewManager(&fakeDraftStore{}, fakeOwnerProfile{profile: profile.Profile{DisplayName: "Asha"}})
	_, err = manager.CreateDraft(context.Background(), 7, input)
	var fieldError *DraftFieldError
	if !errors.As(err, &fieldError) || fieldError.Field != "skills" {
		t.Fatalf("invalid input error = %#v", err)
	}
}

func TestDraftInputValidation(t *testing.T) {
	tests := []struct {
		name  string
		field string
		edit  func(*DraftInput)
	}{
		{name: "project name", field: "projectName", edit: func(input *DraftInput) { input.ProjectName = "x" }},
		{name: "problem", field: "problem", edit: func(input *DraftInput) { input.Problem = "too short" }},
		{name: "role", field: "role", edit: func(input *DraftInput) { input.Role = "Founder" }},
		{name: "skills required", field: "skills", edit: func(input *DraftInput) { input.Skills = nil }},
		{name: "skills unique", field: "skills", edit: func(input *DraftInput) { input.Skills = []string{"React", "react"} }},
		{name: "commitment", field: "commitment", edit: func(input *DraftInput) { input.Commitment = "Whenever" }},
		{name: "duration", field: "duration", edit: func(input *DraftInput) { input.Duration = "Forever" }},
		{name: "timezone", field: "timezone", edit: func(input *DraftInput) { input.Timezone = "x" }},
		{name: "compensation", field: "compensation", edit: func(input *DraftInput) { input.Compensation = "Exposure" }},
		{name: "milestone", field: "firstMilestone", edit: func(input *DraftInput) { input.FirstMilestone = "too short" }},
		{name: "owner contribution", field: "ownerContribution", edit: func(input *DraftInput) { input.OwnerContribution = "too short" }},
		{name: "confidentiality", field: "confidentiality", edit: func(input *DraftInput) { input.Confidentiality = "Secret" }},
	}
	manager := NewManager(&fakeDraftStore{}, fakeOwnerProfile{profile: profile.Profile{DisplayName: "Asha"}})
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := validDraftInput()
			test.edit(&input)
			_, err := manager.CreateDraft(context.Background(), 7, input)
			var fieldError *DraftFieldError
			if !errors.As(err, &fieldError) || fieldError.Field != test.field {
				t.Fatalf("error = %#v, want %s field error", err, test.field)
			}
		})
	}
}

func TestManagerUpdatesDraftForCurrentOwner(t *testing.T) {
	store := &fakeDraftStore{updated: ManagedOpening{PublicationStatus: "draft"}}
	manager := NewManager(store, fakeOwnerProfile{profile: profile.Profile{DisplayName: "Asha Rao"}})
	_, err := manager.UpdateDraft(context.Background(), 7, "draft-id", validDraftInput())
	if err != nil || store.id != "draft-id" || store.record.OwnerUserID != 7 {
		t.Fatalf("UpdateDraft() id %q, record %#v, error %v", store.id, store.record, err)
	}
}

type fakeOwnerProfile struct {
	profile profile.Profile
	err     error
}

func (fake fakeOwnerProfile) Get(context.Context, int64) (profile.Profile, error) {
	return fake.profile, fake.err
}

type fakeDraftStore struct {
	record           draftRecord
	id               string
	created, updated ManagedOpening
}

func (store *fakeDraftStore) ListOwned(context.Context, int64) ([]ManagedOpening, error) {
	return nil, nil
}
func (store *fakeDraftStore) CreateDraft(_ context.Context, record draftRecord) (ManagedOpening, error) {
	store.record = record
	return store.created, nil
}
func (store *fakeDraftStore) UpdateDraft(_ context.Context, id string, record draftRecord) (ManagedOpening, error) {
	store.id, store.record = id, record
	return store.updated, nil
}
