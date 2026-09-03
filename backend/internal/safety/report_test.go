package safety

import (
	"context"
	"errors"
	"strings"
	"testing"
)

type fakeStore struct {
	record      Record
	moderatorID int64
	reportID    string
	decision    DecisionInput
	result      Report
	listed      []Report
	appealRecord AppealRecord
	appeals     []Appeal
	err         error
}
func (store *fakeStore) CreateAppeal(_ context.Context, record AppealRecord) (Appeal, error) { store.appealRecord = record; if len(store.appeals) > 0 { return store.appeals[0], store.err }; return Appeal{}, store.err }
func (store *fakeStore) ListAppealsForModerator(_ context.Context, userID int64) ([]Appeal, error) { store.moderatorID = userID; return store.appeals, store.err }

func (store *fakeStore) Create(_ context.Context, record Record) (Report, error) {
	store.record = record
	return store.result, store.err
}
func (store *fakeStore) ListForModerator(_ context.Context, userID int64) ([]Report, error) {
	store.moderatorID = userID
	return store.listed, store.err
}
func (store *fakeStore) Decide(_ context.Context, userID int64, reportID string, input DecisionInput) (Report, error) {
	store.moderatorID, store.reportID, store.decision = userID, reportID, input
	return store.result, store.err
}

func validInput() Input {
	return Input{TargetKind: "trial_feedback", TargetID: "feedback-id", Category: "privacy", Details: "This feedback includes private client information that should be reviewed."}
}

func TestManagerCreatesNormalizedSafetyReport(t *testing.T) {
	store := &fakeStore{result: Report{ID: "report-id"}}
	manager := NewManager(store)
	manager.random = strings.NewReader(strings.Repeat("e", 16))
	input := validInput()
	input.Details = "  " + input.Details + "  "
	result, err := manager.Create(context.Background(), 7, input)
	if err != nil || result.ID != "report-id" || store.record.ID != "65656565-6565-4565-a565-656565656565" || store.record.ReporterUserID != 7 || store.record.Input.Details != strings.TrimSpace(input.Details) {
		t.Fatalf("Create() = %#v, %v; record %#v", result, err, store.record)
	}
}

func TestManagerValidatesReportsAndDecisions(t *testing.T) {
	manager := NewManager(&fakeStore{})
	for _, test := range []struct {
		field string
		edit  func(*Input)
	}{
		{"targetKind", func(input *Input) { input.TargetKind = "profile" }},
		{"targetId", func(input *Input) { input.TargetID = "" }},
		{"category", func(input *Input) { input.Category = "dislike" }},
		{"details", func(input *Input) { input.Details = "short" }},
	} {
		input := validInput()
		test.edit(&input)
		_, err := manager.Create(context.Background(), 7, input)
		var fieldError *FieldError
		if !errors.As(err, &fieldError) || fieldError.Field != test.field {
			t.Fatalf("error = %v, want %s", err, test.field)
		}
	}
	if _, err := manager.Decide(context.Background(), 8, "report-id", DecisionInput{Decision: "edited", ModeratorNotes: strings.Repeat("x", 30)}); !errors.Is(err, ErrDecisionUnavailable) {
		t.Fatalf("invalid decision error = %v", err)
	}
	if _, err := manager.Decide(context.Background(), 8, "report-id", DecisionInput{Decision: "upheld", ModeratorNotes: "short"}); err == nil {
		t.Fatal("short notes accepted")
	}
}

func TestManagerListsAndDecidesForModerator(t *testing.T) {
	store := &fakeStore{listed: []Report{{ID: "report-id"}}, result: Report{ID: "report-id", Status: "upheld"}}
	manager := NewManager(store)
	if results, err := manager.ListForModerator(context.Background(), 8); err != nil || len(results) != 1 || store.moderatorID != 8 {
		t.Fatalf("ListForModerator() = %#v, %v", results, err)
	}
	result, err := manager.Decide(context.Background(), 8, " report-id ", DecisionInput{Decision: " upheld ", ModeratorNotes: " Confirmed a policy concern in the captured snapshot. "})
	if err != nil || result.Status != "upheld" || store.reportID != "report-id" || store.decision.ModeratorNotes != "Confirmed a policy concern in the captured snapshot." {
		t.Fatalf("Decide() = %#v, %v; store %#v", result, err, store)
	}
}

func TestManagerCreatesBoundedModerationAppeal(t *testing.T) {
	store := &fakeStore{appeals: []Appeal{{ID: "appeal-id", Status: "pending"}}}
	manager := NewManager(store); manager.random = strings.NewReader(strings.Repeat("f", 16))
	result, err := manager.CreateAppeal(context.Background(), 7, AppealInput{TargetKind: "trial_feedback", TargetID: " feedback-id ", Reason: " The moderator should reconsider this removal using the complete trial context. "})
	if err != nil || result.ID != "appeal-id" || store.appealRecord.ID != "66666666-6666-4666-a666-666666666666" || store.appealRecord.TargetID != "feedback-id" {
		t.Fatalf("CreateAppeal() = %#v, %v; record %#v", result, err, store.appealRecord)
	}
	if _, err := manager.CreateAppeal(context.Background(), 7, AppealInput{TargetKind: "trial_feedback", TargetID: "feedback-id", Reason: "short"}); err == nil { t.Fatal("short appeal accepted") }
	if appeals, err := manager.ListAppealsForModerator(context.Background(), 8); err != nil || len(appeals) != 1 || store.moderatorID != 8 { t.Fatalf("ListAppealsForModerator() = %#v, %v", appeals, err) }
}
