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

func TestManagerScopesSendAndOwnerDecisionTransitions(t *testing.T) {
	store := &fakeStore{
		sent:    Proposal{Status: "sent"},
		listed:  []OwnerProposal{{Proposal: Proposal{ID: "proposal-id", Status: "sent"}}},
		decided: Proposal{Status: "accepted"},
	}
	manager := NewManager(store)
	if proposal, err := manager.SendOwn(context.Background(), 7, " opening-id "); err != nil || proposal.Status != "sent" || store.userID != 7 {
		t.Fatalf("SendOwn() = %#v, %v; store %#v", proposal, err, store)
	}
	if proposals, err := manager.ListForOwner(context.Background(), 8, " opening-id "); err != nil || len(proposals) != 1 || store.userID != 8 {
		t.Fatalf("ListForOwner() = %#v, %v; store %#v", proposals, err, store)
	}
	if proposal, err := manager.Decide(context.Background(), 8, " opening-id ", " proposal-id ", "accepted"); err != nil || proposal.Status != "accepted" || store.proposalID != "proposal-id" {
		t.Fatalf("Decide() = %#v, %v; store %#v", proposal, err, store)
	}
	if _, err := manager.Decide(context.Background(), 8, "opening-id", "proposal-id", "counter"); !errors.Is(err, ErrDecisionUnavailable) {
		t.Fatalf("invalid Decide() error = %v", err)
	}
}

func TestManagerCreatesNormalizedParticipantCheckIn(t *testing.T) {
	store := &fakeStore{createdCheckIn: CheckIn{ID: "check-in-id", Kind: "progress"}}
	manager := NewManager(store)
	manager.random = strings.NewReader(strings.Repeat("b", 16))
	result, err := manager.AddCheckIn(context.Background(), 7, " proposal-id ", CheckInInput{
		Kind: " progress ", Update: "  Completed the API boundary and added focused tests.  ",
		EvidenceURL: " https://github.com/example/repo/pull/12 ",
	})
	if err != nil || result.ID != "check-in-id" {
		t.Fatalf("AddCheckIn() = %#v, %v", result, err)
	}
	if store.checkInRecord.ID != "62626262-6262-4262-a262-626262626262" || store.checkInRecord.ProposalID != "proposal-id" || store.checkInRecord.AuthorUserID != 7 {
		t.Fatalf("record = %#v", store.checkInRecord)
	}
	if store.checkInRecord.Input.Update != "Completed the API boundary and added focused tests." {
		t.Fatalf("update = %q", store.checkInRecord.Input.Update)
	}
}

func TestManagerValidatesCheckInsBeforePersistence(t *testing.T) {
	manager := NewManager(&fakeStore{})
	for _, test := range []struct {
		name  string
		input CheckInInput
		field string
	}{
		{"kind", CheckInInput{Kind: "note", Update: "A long enough execution update for validation."}, "kind"},
		{"update", CheckInInput{Kind: "progress", Update: "too short"}, "update"},
		{"evidence", CheckInInput{Kind: "blocker", Update: "Blocked by an unavailable test dependency today.", EvidenceURL: "javascript:alert(1)"}, "evidenceUrl"},
	} {
		t.Run(test.name, func(t *testing.T) {
			_, err := manager.AddCheckIn(context.Background(), 7, "proposal-id", test.input)
			var fieldError *FieldError
			if !errors.As(err, &fieldError) || fieldError.Field != test.field {
				t.Fatalf("error = %#v, want %s", err, test.field)
			}
		})
	}
}

func TestManagerListsOnlyParticipantWorkspace(t *testing.T) {
	store := &fakeStore{checkIns: []CheckIn{{ID: "check-in-id"}}}
	manager := NewManager(store)
	results, err := manager.ListCheckIns(context.Background(), 8, " proposal-id ")
	if err != nil || len(results) != 1 || store.userID != 8 || store.proposalID != "proposal-id" {
		t.Fatalf("ListCheckIns() = %#v, %v; store %#v", results, err, store)
	}
}

func validOutcomeInput() OutcomeInput {
	return OutcomeInput{
		OutcomeStatus: "completed", DeliverableStatus: "met",
		WorkSummary:   "Delivered the agreed comparison flow with focused tests and review notes.",
		EvidenceURL:   "https://github.com/example/repo/pull/14",
		CloseoutNotes: "Repository access can be removed after the documented handoff is acknowledged.",
	}
}

func TestManagerCreatesNormalizedTrialOutcome(t *testing.T) {
	store := &fakeStore{createdOutcome: Outcome{ID: "outcome-id", ReviewStatus: "pending"}}
	manager := NewManager(store)
	manager.random = strings.NewReader(strings.Repeat("c", 16))
	input := validOutcomeInput()
	input.WorkSummary = "  " + input.WorkSummary + "  "
	result, err := manager.CreateOutcome(context.Background(), 7, " proposal-id ", input)
	if err != nil || result.ID != "outcome-id" {
		t.Fatalf("CreateOutcome() = %#v, %v", result, err)
	}
	if store.outcomeRecord.ID != "63636363-6363-4363-a363-636363636363" || store.outcomeRecord.ProposalID != "proposal-id" || store.outcomeRecord.SubmittedByUserID != 7 {
		t.Fatalf("record = %#v", store.outcomeRecord)
	}
	if store.outcomeRecord.Input.WorkSummary != strings.TrimSpace(input.WorkSummary) {
		t.Fatalf("summary = %q", store.outcomeRecord.Input.WorkSummary)
	}
}

func TestManagerValidatesTrialOutcome(t *testing.T) {
	manager := NewManager(&fakeStore{})
	for _, test := range []struct {
		field string
		edit  func(*OutcomeInput)
	}{
		{"outcomeStatus", func(input *OutcomeInput) { input.OutcomeStatus = "unknown" }},
		{"deliverableStatus", func(input *OutcomeInput) { input.DeliverableStatus = "almost" }},
		{"workSummary", func(input *OutcomeInput) { input.WorkSummary = "short" }},
		{"evidenceUrl", func(input *OutcomeInput) { input.EvidenceURL = "javascript:alert(1)" }},
		{"closeoutNotes", func(input *OutcomeInput) { input.CloseoutNotes = "short" }},
	} {
		t.Run(test.field, func(t *testing.T) {
			input := validOutcomeInput()
			test.edit(&input)
			_, err := manager.CreateOutcome(context.Background(), 7, "proposal-id", input)
			var fieldError *FieldError
			if !errors.As(err, &fieldError) || fieldError.Field != test.field {
				t.Fatalf("error = %#v, want %s", err, test.field)
			}
		})
	}
}

func TestManagerLoadsAndDecidesTrialOutcome(t *testing.T) {
	store := &fakeStore{outcome: Outcome{ID: "outcome-id"}, decidedOutcome: Outcome{ID: "outcome-id", ReviewStatus: "confirmed"}}
	manager := NewManager(store)
	if result, err := manager.GetOutcome(context.Background(), 7, " proposal-id "); err != nil || result.ID != "outcome-id" || store.userID != 7 {
		t.Fatalf("GetOutcome() = %#v, %v", result, err)
	}
	if result, err := manager.DecideOutcome(context.Background(), 8, " proposal-id ", "confirmed"); err != nil || result.ReviewStatus != "confirmed" || store.decision != "confirmed" {
		t.Fatalf("DecideOutcome() = %#v, %v", result, err)
	}
	if _, err := manager.DecideOutcome(context.Background(), 8, "proposal-id", "edited"); !errors.Is(err, ErrOutcomeDecisionUnavailable) {
		t.Fatalf("invalid DecideOutcome() error = %v", err)
	}
}

func validFeedbackInput() FeedbackInput {
	return FeedbackInput{
		ObservedBehaviors:    []string{"reliable_delivery", "clear_communication"},
		CollaborationExample: "They surfaced a blocker early and delivered the revised milestone on time.",
		CollaborateAgain:     "yes",
		ReviewSummary:        "A dependable collaborator who communicated tradeoffs clearly during the trial.",
	}
}

func TestManagerCreatesAndAcknowledgesPrivateFeedback(t *testing.T) {
	store := &fakeStore{
		createdFeedback:      Feedback{ID: "feedback-id", Input: validFeedbackInput()},
		acknowledgedFeedback: Feedback{ID: "feedback-id"},
	}
	manager := NewManager(store)
	manager.random = strings.NewReader(strings.Repeat("d", 16))
	input := validFeedbackInput()
	input.ReviewSummary = "  " + input.ReviewSummary + "  "

	result, err := manager.CreateFeedback(context.Background(), 7, " proposal-id ", input)
	if err != nil || result.ID != "feedback-id" || store.feedbackRecord.ProposalID != "proposal-id" || store.feedbackRecord.AuthorUserID != 7 {
		t.Fatalf("CreateFeedback() = %#v, %v; record %#v", result, err, store.feedbackRecord)
	}
	if store.feedbackRecord.Input.ReviewSummary != strings.TrimSpace(input.ReviewSummary) {
		t.Fatalf("review summary = %q", store.feedbackRecord.Input.ReviewSummary)
	}
	if _, err := manager.AcknowledgeFeedback(context.Background(), 8, " proposal-id ", " feedback-id "); err != nil || store.feedbackID != "feedback-id" {
		t.Fatalf("AcknowledgeFeedback() error = %v; feedbackID = %q", err, store.feedbackID)
	}
	if _, err := manager.ListFeedback(context.Background(), 8, " proposal-id "); err != nil || store.proposalID != "proposal-id" {
		t.Fatalf("ListFeedback() error = %v; proposalID = %q", err, store.proposalID)
	}
}

func TestManagerRejectsInvalidPrivateFeedback(t *testing.T) {
	manager := NewManager(&fakeStore{})
	for _, test := range []struct {
		field string
		edit  func(*FeedbackInput)
	}{
		{"observedBehaviors", func(input *FeedbackInput) { input.ObservedBehaviors = []string{"reliable_delivery"} }},
		{"observedBehaviors", func(input *FeedbackInput) {
			input.ObservedBehaviors = []string{"reliable_delivery", "reliable_delivery"}
		}},
		{"collaborationExample", func(input *FeedbackInput) { input.CollaborationExample = "short" }},
		{"collaborateAgain", func(input *FeedbackInput) { input.CollaborateAgain = "always" }},
		{"reviewSummary", func(input *FeedbackInput) { input.ReviewSummary = "short" }},
	} {
		input := validFeedbackInput()
		test.edit(&input)
		_, err := manager.CreateFeedback(context.Background(), 7, "proposal-id", input)
		var fieldError *FieldError
		if !errors.As(err, &fieldError) || fieldError.Field != test.field {
			t.Fatalf("CreateFeedback() error = %v, want field %q", err, test.field)
		}
	}
}

type fakeStore struct {
	record                    Record
	userID                    int64
	openingID                 string
	proposalID                string
	decision                  string
	got, saved, sent, decided Proposal
	listed                    []OwnerProposal
	checkIns                  []CheckIn
	createdCheckIn            CheckIn
	checkInRecord             CheckInRecord
	outcome                   Outcome
	createdOutcome            Outcome
	decidedOutcome            Outcome
	outcomeRecord             OutcomeRecord
	feedback                  []Feedback
	createdFeedback           Feedback
	acknowledgedFeedback      Feedback
	feedbackRecord            FeedbackRecord
	feedbackID                string
	err                       error
}

func (store *fakeStore) GetOwn(_ context.Context, userID int64, openingID string) (Proposal, error) {
	store.userID, store.openingID = userID, openingID
	return store.got, store.err
}

func (store *fakeStore) UpsertOwnDraft(_ context.Context, record Record) (Proposal, error) {
	store.record = record
	return store.saved, store.err
}

func (store *fakeStore) SendOwn(_ context.Context, userID int64, openingID string) (Proposal, error) {
	store.userID, store.openingID = userID, openingID
	return store.sent, store.err
}

func (store *fakeStore) ListForOwner(_ context.Context, userID int64, openingID string) ([]OwnerProposal, error) {
	store.userID, store.openingID = userID, openingID
	return store.listed, store.err
}

func (store *fakeStore) Decide(_ context.Context, userID int64, openingID, proposalID, decision string) (Proposal, error) {
	store.userID, store.openingID, store.proposalID, store.decision = userID, openingID, proposalID, decision
	return store.decided, store.err
}

func (store *fakeStore) ListCheckIns(_ context.Context, userID int64, proposalID string) ([]CheckIn, error) {
	store.userID, store.proposalID = userID, proposalID
	return store.checkIns, store.err
}

func (store *fakeStore) CreateCheckIn(_ context.Context, record CheckInRecord) (CheckIn, error) {
	store.checkInRecord = record
	return store.createdCheckIn, store.err
}

func (store *fakeStore) GetOutcome(_ context.Context, userID int64, proposalID string) (Outcome, error) {
	store.userID, store.proposalID = userID, proposalID
	return store.outcome, store.err
}

func (store *fakeStore) CreateOutcome(_ context.Context, record OutcomeRecord) (Outcome, error) {
	store.outcomeRecord = record
	return store.createdOutcome, store.err
}

func (store *fakeStore) DecideOutcome(_ context.Context, userID int64, proposalID, decision string) (Outcome, error) {
	store.userID, store.proposalID, store.decision = userID, proposalID, decision
	return store.decidedOutcome, store.err
}

func (store *fakeStore) ListFeedback(_ context.Context, userID int64, proposalID string) ([]Feedback, error) {
	store.userID, store.proposalID = userID, proposalID
	return store.feedback, store.err
}

func (store *fakeStore) CreateFeedback(_ context.Context, record FeedbackRecord) (Feedback, error) {
	store.feedbackRecord = record
	return store.createdFeedback, store.err
}

func (store *fakeStore) AcknowledgeFeedback(_ context.Context, userID int64, proposalID, feedbackID string) (Feedback, error) {
	store.userID, store.proposalID, store.feedbackID = userID, proposalID, feedbackID
	return store.acknowledgedFeedback, store.err
}
