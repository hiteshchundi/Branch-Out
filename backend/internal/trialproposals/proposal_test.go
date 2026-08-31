package trialproposals

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func validInput() Input {
	return Input{
		Outcome:     "Build a usable regional comparison flow with documented decisions.",
		Deliverable: "A tested comparison component and a short implementation note.",
		NonGoals:    "No authentication or production data access.",
		StartDate:   "2026-09-01", EndDate: "2026-09-15", WeeklyHours: 8,
		CheckInCadence: "Async update every two days", AccessLevel: "Limited repository access",
		Confidentiality: "Synthetic data during trial",
		IPOwnership:     "Open-source contribution under the project license",
		ExitPlan:        "Remove repository access and hand over all documented trial work.",
		TermsConfirmed:  true,
	}
}

func TestManagerSavesNormalizedDraftForAcceptedApplicant(t *testing.T) {
	store := &fakeStore{saved: Proposal{Status: "draft"}}
	manager := NewManager(store)
	manager.random = strings.NewReader(strings.Repeat("a", 16))
	input := validInput()
	input.Outcome = "  " + input.Outcome + "  "
	result, err := manager.SaveOwnDraft(context.Background(), 7, "opening-id", input)
	if err != nil || result.Status != "draft" {
		t.Fatalf("SaveOwnDraft() = %#v, %v", result, err)
	}
	if store.record.ID != "61616161-6161-4161-a161-616161616161" || store.record.ApplicantUserID != 7 || store.record.OpeningID != "opening-id" {
		t.Fatalf("record = %#v", store.record)
	}
	if store.record.Input.Outcome != strings.TrimSpace(input.Outcome) {
		t.Fatalf("outcome = %q", store.record.Input.Outcome)
	}
}

func TestTrialProposalValidationMatchesTheThreeStepForm(t *testing.T) {
	tests := []struct {
		field string
		edit  func(*Input)
	}{
		{"outcome", func(input *Input) { input.Outcome = "short" }},
		{"deliverable", func(input *Input) { input.Deliverable = "short" }},
		{"nonGoals", func(input *Input) { input.NonGoals = "short" }},
		{"startDate", func(input *Input) { input.StartDate = "tomorrow" }},
		{"endDate", func(input *Input) { input.EndDate = "2026-09-05" }},
		{"weeklyHours", func(input *Input) { input.WeeklyHours = 0 }},
		{"checkInCadence", func(input *Input) { input.CheckInCadence = "Whenever" }},
		{"accessLevel", func(input *Input) { input.AccessLevel = "Everything" }},
		{"confidentiality", func(input *Input) { input.Confidentiality = "Unknown" }},
		{"ipOwnership", func(input *Input) { input.IPOwnership = "Undefined" }},
		{"exitPlan", func(input *Input) { input.ExitPlan = "short" }},
		{"termsConfirmed", func(input *Input) { input.TermsConfirmed = false }},
	}
	manager := NewManager(&fakeStore{})
	for _, test := range tests {
		t.Run(test.field, func(t *testing.T) {
			input := validInput()
			test.edit(&input)
			_, err := manager.SaveOwnDraft(context.Background(), 7, "opening-id", input)
			var fieldError *FieldError
			if !errors.As(err, &fieldError) || fieldError.Field != test.field {
				t.Fatalf("error = %#v, want %s", err, test.field)
			}
		})
	}
}

func TestManagerLoadsOnlyCurrentApplicantsProposal(t *testing.T) {
	store := &fakeStore{got: Proposal{OpeningID: "opening-id", Status: "draft"}}
	manager := NewManager(store)
	result, err := manager.GetOwn(context.Background(), 7, " opening-id ")
	if err != nil || result.Status != "draft" || store.userID != 7 || store.openingID != "opening-id" {
		t.Fatalf("GetOwn() = %#v, %v; store %#v", result, err, store)
	}
}

type fakeStore struct {
	record     Record
	userID     int64
	openingID  string
	got, saved Proposal
	err        error
}

func (store *fakeStore) GetOwn(_ context.Context, userID int64, openingID string) (Proposal, error) {
	store.userID, store.openingID = userID, openingID
	return store.got, store.err
}

func (store *fakeStore) UpsertOwnDraft(_ context.Context, record Record) (Proposal, error) {
	store.record = record
	return store.saved, store.err
}
