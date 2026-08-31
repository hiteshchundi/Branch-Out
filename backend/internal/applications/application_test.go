package applications

import (
	"context"
	"errors"
	"strings"
	"testing"

	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

func validInput() Input {
	return Input{
		Message:               "I have built accessible climate tools for regional planning teams.",
		WorkSampleURL:         "https://github.com/example/climate-dashboard",
		WorkSampleContext:     "I implemented the interactive comparison and its tests.",
		Availability:          "7 hours each week, starting next Monday",
		AvailabilityConfirmed: true,
		ProposedContribution:  "I can audit the data flow and prototype the region selector.",
	}
}

func TestManagerSavesNormalizedDraftForProfiledApplicant(t *testing.T) {
	store := &fakeStore{saved: Application{Status: "draft"}}
	manager := NewManager(store, fakeProfileLookup{profile: profile.Profile{DisplayName: "Asha"}})
	manager.random = strings.NewReader(strings.Repeat("a", 16))
	input := validInput()
	input.Message = "  " + input.Message + "  "

	result, err := manager.SaveDraft(context.Background(), 7, "opening-id", input)
	if err != nil || result.Status != "draft" {
		t.Fatalf("SaveDraft() = %#v, %v", result, err)
	}
	if store.record.ID != "61616161-6161-4161-a161-616161616161" || store.record.ApplicantUserID != 7 || store.record.OpeningID != "opening-id" {
		t.Fatalf("saved record = %#v", store.record)
	}
	if store.record.Input.Message != strings.TrimSpace(input.Message) {
		t.Fatalf("message was not normalized: %q", store.record.Input.Message)
	}
}

func TestManagerRequiresProfileBeforeSaving(t *testing.T) {
	manager := NewManager(&fakeStore{}, fakeProfileLookup{err: profile.ErrNotFound})
	_, err := manager.SaveDraft(context.Background(), 7, "opening-id", validInput())
	if !errors.Is(err, profile.ErrNotFound) {
		t.Fatalf("SaveDraft() error = %v", err)
	}
}

func TestApplicationInputValidation(t *testing.T) {
	tests := []struct {
		name, field string
		edit        func(*Input)
	}{
		{name: "message", field: "message", edit: func(input *Input) { input.Message = "too short" }},
		{name: "sample URL", field: "workSampleUrl", edit: func(input *Input) { input.WorkSampleURL = "javascript:alert(1)" }},
		{name: "sample context", field: "workSampleContext", edit: func(input *Input) { input.WorkSampleContext = "too short" }},
		{name: "availability", field: "availability", edit: func(input *Input) { input.Availability = "x" }},
		{name: "confirmation", field: "availabilityConfirmed", edit: func(input *Input) { input.AvailabilityConfirmed = false }},
		{name: "contribution", field: "proposedContribution", edit: func(input *Input) { input.ProposedContribution = "too short" }},
	}
	manager := NewManager(&fakeStore{}, fakeProfileLookup{profile: profile.Profile{DisplayName: "Asha"}})
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			input := validInput()
			test.edit(&input)
			_, err := manager.SaveDraft(context.Background(), 7, "opening-id", input)
			var fieldError *FieldError
			if !errors.As(err, &fieldError) || fieldError.Field != test.field {
				t.Fatalf("error = %#v, want %s", err, test.field)
			}
		})
	}
}

func TestManagerGetsAndSubmitsOnlyCurrentUsersApplication(t *testing.T) {
	store := &fakeStore{
		got:       Application{OpeningID: "opening-id", Status: "draft"},
		submitted: Application{OpeningID: "opening-id", Status: "submitted"},
	}
	manager := NewManager(store, fakeProfileLookup{})
	got, err := manager.GetOwn(context.Background(), 7, "opening-id")
	if err != nil || got.Status != "draft" || store.userID != 7 {
		t.Fatalf("GetOwn() = %#v, %v; store %#v", got, err, store)
	}
	submitted, err := manager.Submit(context.Background(), 7, "opening-id")
	if err != nil || submitted.Status != "submitted" || store.userID != 7 {
		t.Fatalf("Submit() = %#v, %v; store %#v", submitted, err, store)
	}
}

func TestManagerListsSubmittedApplicationsForOpeningOwner(t *testing.T) {
	store := &fakeStore{reviewed: []OwnerApplication{{Application: Application{OpeningID: "opening-id", Status: "submitted"}}}}
	manager := NewManager(store, fakeProfileLookup{})
	results, err := manager.ListSubmittedForOwner(context.Background(), 11, " opening-id ")
	if err != nil || len(results) != 1 || results[0].Status != "submitted" {
		t.Fatalf("ListSubmittedForOwner() = %#v, %v", results, err)
	}
	if store.userID != 11 || store.openingID != "opening-id" {
		t.Fatalf("store scope = %d, %q", store.userID, store.openingID)
	}
	if _, err := manager.ListSubmittedForOwner(context.Background(), 11, " "); !errors.Is(err, ErrReviewNotFound) {
		t.Fatalf("blank opening error = %v", err)
	}
}

type fakeProfileLookup struct {
	profile profile.Profile
	err     error
}

func (fake fakeProfileLookup) Get(context.Context, int64) (profile.Profile, error) {
	return fake.profile, fake.err
}

type fakeStore struct {
	record                Record
	userID                int64
	openingID             string
	got, saved, submitted Application
	reviewed              []OwnerApplication
	err                   error
}

func (store *fakeStore) GetOwn(_ context.Context, userID int64, openingID string) (Application, error) {
	store.userID, store.openingID = userID, openingID
	return store.got, store.err
}

func (store *fakeStore) UpsertDraft(_ context.Context, record Record) (Application, error) {
	store.record = record
	return store.saved, store.err
}

func (store *fakeStore) Submit(_ context.Context, userID int64, openingID string) (Application, error) {
	store.userID, store.openingID = userID, openingID
	return store.submitted, store.err
}

func (store *fakeStore) ListSubmittedForOwner(_ context.Context, userID int64, openingID string) ([]OwnerApplication, error) {
	store.userID, store.openingID = userID, openingID
	return store.reviewed, store.err
}
