package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/trialproposals"
)

func TestTrialProposalRoutesRequireAuthentication(t *testing.T) {
	api := trialProposalTestAPI(fakeTrialProposalManager{}, fakeAuthenticator{currentErr: auth.ErrInvalidSession})
	for _, method := range []string{http.MethodGet, http.MethodPut} {
		response := httptest.NewRecorder()
		api.ServeHTTP(response, httptest.NewRequest(method, "/v1/openings/opening-id/trial-proposal", bytes.NewBufferString("{}")))
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("%s = %d", method, response.Code)
		}
	}
	for _, path := range []string{
		"/v1/trial-proposals/proposal-id/check-ins",
		"/v1/trial-proposals/proposal-id/outcome",
		"/v1/trial-proposals/proposal-id/outcome/decision",
	} {
		response := httptest.NewRecorder()
		api.ServeHTTP(response, httptest.NewRequest(http.MethodPost, path, bytes.NewBufferString("{}")))
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("POST %s = %d", path, response.Code)
		}
	}
}

func TestTrialProposalSendOwnerReviewAndDecision(t *testing.T) {
	calls := &trialProposalCalls{}
	proposal := trialproposals.Proposal{ID: "proposal-id", OpeningID: "opening-id", Status: "sent", Input: validTrialProposalRequest()}
	ownerProposal := trialproposals.OwnerProposal{Proposal: proposal, Applicant: trialproposals.Applicant{DisplayName: "Asha Rao"}}
	manager := fakeTrialProposalManager{calls: calls, result: proposal, listResult: []trialproposals.OwnerProposal{ownerProposal}}
	api := trialProposalTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})

	send := httptest.NewRecorder()
	api.ServeHTTP(send, authenticatedApplicationRequest(http.MethodPost, "/v1/openings/opening-id/trial-proposal/send", nil))
	if send.Code != http.StatusOK || calls.operation != "send" || calls.userID != 7 {
		t.Fatalf("send = %d, calls %#v: %s", send.Code, calls, send.Body.String())
	}

	list := httptest.NewRecorder()
	api.ServeHTTP(list, authenticatedApplicationRequest(http.MethodGet, "/v1/openings/opening-id/trial-proposals", nil))
	if list.Code != http.StatusOK || calls.operation != "list" || !bytes.Contains(list.Body.Bytes(), []byte("Asha Rao")) {
		t.Fatalf("list = %d, calls %#v: %s", list.Code, calls, list.Body.String())
	}

	decisionBody := bytes.NewBufferString(`{"decision":"accepted"}`)
	decision := httptest.NewRecorder()
	api.ServeHTTP(decision, authenticatedApplicationRequest(http.MethodPost, "/v1/openings/opening-id/trial-proposals/proposal-id/decision", decisionBody))
	if decision.Code != http.StatusOK || calls.operation != "decide" || calls.proposalID != "proposal-id" || calls.decision != "accepted" {
		t.Fatalf("decision = %d, calls %#v: %s", decision.Code, calls, decision.Body.String())
	}
}

func TestAcceptedApplicantSavesAndLoadsPrivateTrialProposal(t *testing.T) {
	calls := &trialProposalCalls{}
	proposal := trialproposals.Proposal{ID: "proposal-id", OpeningID: "opening-id", Status: "draft", Input: validTrialProposalRequest()}
	manager := fakeTrialProposalManager{calls: calls, result: proposal}
	api := trialProposalTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})
	body, _ := json.Marshal(validTrialProposalRequest())

	save := httptest.NewRecorder()
	api.ServeHTTP(save, authenticatedApplicationRequest(http.MethodPut, "/v1/openings/opening-id/trial-proposal", bytes.NewReader(body)))
	if save.Code != http.StatusOK || calls.operation != "save" || calls.userID != 7 || calls.input.Outcome == "" {
		t.Fatalf("save = %d, calls %#v: %s", save.Code, calls, save.Body.String())
	}

	load := httptest.NewRecorder()
	api.ServeHTTP(load, authenticatedApplicationRequest(http.MethodGet, "/v1/openings/opening-id/trial-proposal", nil))
	if load.Code != http.StatusOK || calls.operation != "get" {
		t.Fatalf("load = %d, calls %#v", load.Code, calls)
	}
}

func TestTrialParticipantsListAndAddCheckIns(t *testing.T) {
	calls := &trialProposalCalls{}
	checkIn := trialproposals.CheckIn{ID: "check-in-id", ProposalID: "proposal-id", Kind: "progress", Update: "Completed the API boundary and added focused tests."}
	manager := fakeTrialProposalManager{calls: calls, checkInResult: checkIn, checkInList: []trialproposals.CheckIn{checkIn}}
	api := trialProposalTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})

	list := httptest.NewRecorder()
	api.ServeHTTP(list, authenticatedApplicationRequest(http.MethodGet, "/v1/trial-proposals/proposal-id/check-ins", nil))
	if list.Code != http.StatusOK || calls.operation != "list-check-ins" || !bytes.Contains(list.Body.Bytes(), []byte("check-in-id")) {
		t.Fatalf("list = %d, calls %#v: %s", list.Code, calls, list.Body.String())
	}

	add := httptest.NewRecorder()
	body := bytes.NewBufferString(`{"kind":"progress","update":"Completed the API boundary and added focused tests.","evidenceUrl":""}`)
	api.ServeHTTP(add, authenticatedApplicationRequest(http.MethodPost, "/v1/trial-proposals/proposal-id/check-ins", body))
	if add.Code != http.StatusCreated || calls.operation != "add-check-in" || calls.checkInInput.Kind != "progress" {
		t.Fatalf("add = %d, calls %#v: %s", add.Code, calls, add.Body.String())
	}
}

func TestTrialParticipantsSubmitAndReviewOutcome(t *testing.T) {
	calls := &trialProposalCalls{}
	outcome := trialproposals.Outcome{
		ID: "outcome-id", ProposalID: "proposal-id", ReviewStatus: "pending",
		Input: trialproposals.OutcomeInput{
			OutcomeStatus: "completed", DeliverableStatus: "met",
			WorkSummary: "Delivered the agreed comparison flow with focused tests and review notes.",
			EvidenceURL: "", CloseoutNotes: "Repository access can be removed after the documented handoff.",
		},
	}
	manager := fakeTrialProposalManager{calls: calls, outcomeResult: outcome}
	api := trialProposalTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})

	load := httptest.NewRecorder()
	api.ServeHTTP(load, authenticatedApplicationRequest(http.MethodGet, "/v1/trial-proposals/proposal-id/outcome", nil))
	if load.Code != http.StatusOK || calls.operation != "get-outcome" {
		t.Fatalf("load = %d, calls %#v: %s", load.Code, calls, load.Body.String())
	}

	body, _ := json.Marshal(outcome.Input)
	create := httptest.NewRecorder()
	api.ServeHTTP(create, authenticatedApplicationRequest(http.MethodPost, "/v1/trial-proposals/proposal-id/outcome", bytes.NewReader(body)))
	if create.Code != http.StatusCreated || calls.operation != "create-outcome" || calls.outcomeInput.OutcomeStatus != "completed" {
		t.Fatalf("create = %d, calls %#v: %s", create.Code, calls, create.Body.String())
	}

	decision := httptest.NewRecorder()
	api.ServeHTTP(decision, authenticatedApplicationRequest(http.MethodPost, "/v1/trial-proposals/proposal-id/outcome/decision", bytes.NewBufferString(`{"decision":"confirmed"}`)))
	if decision.Code != http.StatusOK || calls.operation != "decide-outcome" || calls.decision != "confirmed" {
		t.Fatalf("decision = %d, calls %#v: %s", decision.Code, calls, decision.Body.String())
	}
}

func TestTrialParticipantsSubmitAndAcknowledgePrivateFeedback(t *testing.T) {
	calls := &trialProposalCalls{}
	input := trialproposals.FeedbackInput{
		ObservedBehaviors:    []string{"reliable_delivery", "clear_communication"},
		CollaborationExample: "They surfaced a blocker early and delivered the revised milestone on time.",
		CollaborateAgain:     "yes",
		ReviewSummary:        "A dependable collaborator who communicated tradeoffs clearly during the trial.",
	}
	feedback := trialproposals.Feedback{ID: "feedback-id", ProposalID: "proposal-id", Input: input}
	manager := fakeTrialProposalManager{calls: calls, feedbackResult: feedback, feedbackList: []trialproposals.Feedback{feedback}}
	api := trialProposalTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})

	list := httptest.NewRecorder()
	api.ServeHTTP(list, authenticatedApplicationRequest(http.MethodGet, "/v1/trial-proposals/proposal-id/feedback", nil))
	if list.Code != http.StatusOK || calls.operation != "list-feedback" || !bytes.Contains(list.Body.Bytes(), []byte("feedback-id")) {
		t.Fatalf("list feedback = %d, calls %#v: %s", list.Code, calls, list.Body.String())
	}

	body, _ := json.Marshal(input)
	create := httptest.NewRecorder()
	api.ServeHTTP(create, authenticatedApplicationRequest(http.MethodPost, "/v1/trial-proposals/proposal-id/feedback", bytes.NewReader(body)))
	if create.Code != http.StatusCreated || calls.operation != "create-feedback" || len(calls.feedbackInput.ObservedBehaviors) != 2 {
		t.Fatalf("create feedback = %d, calls %#v: %s", create.Code, calls, create.Body.String())
	}

	acknowledge := httptest.NewRecorder()
	api.ServeHTTP(acknowledge, authenticatedApplicationRequest(http.MethodPost, "/v1/trial-proposals/proposal-id/feedback/feedback-id/acknowledge", nil))
	if acknowledge.Code != http.StatusOK || calls.operation != "acknowledge-feedback" || calls.feedbackID != "feedback-id" {
		t.Fatalf("acknowledge feedback = %d, calls %#v: %s", acknowledge.Code, calls, acknowledge.Body.String())
	}
}

func TestTrialOutcomeMapsLifecycleErrors(t *testing.T) {
	for _, test := range []struct {
		method string
		path   string
		body   string
		err    error
		status int
		code   string
	}{
		{http.MethodGet, "/v1/trial-proposals/proposal-id/outcome", "", trialproposals.ErrOutcomeNotFound, http.StatusNotFound, "trial_outcome_not_found"},
		{http.MethodPost, "/v1/trial-proposals/proposal-id/outcome", `{"outcomeStatus":"completed","deliverableStatus":"met","workSummary":"A complete and sufficiently detailed outcome summary.","evidenceUrl":"","closeoutNotes":"A complete handoff was recorded."}`, trialproposals.ErrOutcomeUnavailable, http.StatusConflict, "trial_outcome_unavailable"},
		{http.MethodPost, "/v1/trial-proposals/proposal-id/outcome/decision", `{"decision":"confirmed"}`, trialproposals.ErrOutcomeDecisionUnavailable, http.StatusConflict, "trial_outcome_decision_unavailable"},
	} {
		api := trialProposalTestAPI(fakeTrialProposalManager{err: test.err}, fakeAuthenticator{user: auth.User{ID: 7}})
		response := httptest.NewRecorder()
		api.ServeHTTP(response, authenticatedApplicationRequest(test.method, test.path, bytes.NewBufferString(test.body)))
		var envelope errorEnvelope
		_ = json.NewDecoder(response.Body).Decode(&envelope)
		if response.Code != test.status || envelope.Error.Code != test.code {
			t.Fatalf("%s %s = %d, %#v", test.method, test.path, response.Code, envelope)
		}
	}
}

func TestTrialProposalRejectsInvalidBodyAndMapsDomainErrors(t *testing.T) {
	for _, body := range []string{`{"unknown":true}`, `{} {}`} {
		api := trialProposalTestAPI(fakeTrialProposalManager{}, fakeAuthenticator{user: auth.User{ID: 7}})
		response := httptest.NewRecorder()
		api.ServeHTTP(response, authenticatedApplicationRequest(http.MethodPut, "/v1/openings/opening-id/trial-proposal", bytes.NewBufferString(body)))
		if response.Code != http.StatusBadRequest {
			t.Fatalf("body %q = %d", body, response.Code)
		}
	}

	for _, test := range []struct {
		err    error
		status int
		code   string
	}{
		{&trialproposals.FieldError{Field: "outcome", Message: "invalid"}, http.StatusBadRequest, "invalid_trial_proposal"},
		{trialproposals.ErrNotFound, http.StatusNotFound, "trial_proposal_not_found"},
		{trialproposals.ErrUnavailable, http.StatusConflict, "trial_proposal_unavailable"},
		{trialproposals.ErrSendUnavailable, http.StatusConflict, "trial_proposal_send_unavailable"},
		{trialproposals.ErrReviewNotFound, http.StatusNotFound, "trial_proposal_review_not_found"},
		{trialproposals.ErrDecisionUnavailable, http.StatusConflict, "trial_proposal_decision_unavailable"},
		{trialproposals.ErrWorkspaceNotFound, http.StatusNotFound, "trial_workspace_not_found"},
	} {
		api := trialProposalTestAPI(fakeTrialProposalManager{err: test.err}, fakeAuthenticator{user: auth.User{ID: 7}})
		body, _ := json.Marshal(validTrialProposalRequest())
		response := httptest.NewRecorder()
		api.ServeHTTP(response, authenticatedApplicationRequest(http.MethodPut, "/v1/openings/opening-id/trial-proposal", bytes.NewReader(body)))
		var envelope errorEnvelope
		_ = json.NewDecoder(response.Body).Decode(&envelope)
		if response.Code != test.status || envelope.Error.Code != test.code {
			t.Fatalf("error %v = %d, %#v", test.err, response.Code, envelope)
		}
	}
}

func validTrialProposalRequest() trialproposals.Input {
	return trialproposals.Input{
		Outcome:     "Build a usable regional comparison flow with documented decisions.",
		Deliverable: "A tested comparison component and a short implementation note.",
		NonGoals:    "No authentication or production data access.",
		StartDate:   "2026-09-01", EndDate: "2026-09-15", WeeklyHours: 8,
		CheckInCadence: "Async update every two days", AccessLevel: "Limited repository access",
		Confidentiality: "Synthetic data during trial",
		IPOwnership:     "Open-source contribution under the project license",
		ExitPlan:        "Remove repository access and hand over all documented trial work.", TermsConfirmed: true,
	}
}

func trialProposalTestAPI(manager fakeTrialProposalManager, authentication fakeAuthenticator) http.Handler {
	return New(nil, fakeOpeningManager{}, fakeApplicationManager{}, manager, readyChecker{}, authentication, fakeProfileManager{}, defaultOptions, testLogger())
}

type trialProposalCalls struct {
	operation     string
	userID        int64
	openingID     string
	input         trialproposals.Input
	proposalID    string
	decision      string
	checkInInput  trialproposals.CheckInInput
	outcomeInput  trialproposals.OutcomeInput
	feedbackInput trialproposals.FeedbackInput
	feedbackID    string
}

type fakeTrialProposalManager struct {
	calls          *trialProposalCalls
	result         trialproposals.Proposal
	listResult     []trialproposals.OwnerProposal
	checkInResult  trialproposals.CheckIn
	checkInList    []trialproposals.CheckIn
	outcomeResult  trialproposals.Outcome
	feedbackResult trialproposals.Feedback
	feedbackList   []trialproposals.Feedback
	err            error
}

func (fake fakeTrialProposalManager) GetOwn(_ context.Context, userID int64, openingID string) (trialproposals.Proposal, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.openingID = "get", userID, openingID
	}
	return fake.result, fake.err
}

func (fake fakeTrialProposalManager) SaveOwnDraft(_ context.Context, userID int64, openingID string, input trialproposals.Input) (trialproposals.Proposal, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.openingID, fake.calls.input = "save", userID, openingID, input
	}
	return fake.result, fake.err
}

func (fake fakeTrialProposalManager) SendOwn(_ context.Context, userID int64, openingID string) (trialproposals.Proposal, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.openingID = "send", userID, openingID
	}
	return fake.result, fake.err
}

func (fake fakeTrialProposalManager) ListForOwner(_ context.Context, userID int64, openingID string) ([]trialproposals.OwnerProposal, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.openingID = "list", userID, openingID
	}
	return fake.listResult, fake.err
}

func (fake fakeTrialProposalManager) Decide(_ context.Context, userID int64, openingID, proposalID, decision string) (trialproposals.Proposal, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.openingID = "decide", userID, openingID
		fake.calls.proposalID, fake.calls.decision = proposalID, decision
	}
	return fake.result, fake.err
}

func (fake fakeTrialProposalManager) ListCheckIns(_ context.Context, userID int64, proposalID string) ([]trialproposals.CheckIn, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.proposalID = "list-check-ins", userID, proposalID
	}
	return fake.checkInList, fake.err
}

func (fake fakeTrialProposalManager) AddCheckIn(_ context.Context, userID int64, proposalID string, input trialproposals.CheckInInput) (trialproposals.CheckIn, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.proposalID, fake.calls.checkInInput = "add-check-in", userID, proposalID, input
	}
	return fake.checkInResult, fake.err
}

func (fake fakeTrialProposalManager) GetOutcome(_ context.Context, userID int64, proposalID string) (trialproposals.Outcome, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.proposalID = "get-outcome", userID, proposalID
	}
	return fake.outcomeResult, fake.err
}

func (fake fakeTrialProposalManager) CreateOutcome(_ context.Context, userID int64, proposalID string, input trialproposals.OutcomeInput) (trialproposals.Outcome, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.proposalID, fake.calls.outcomeInput = "create-outcome", userID, proposalID, input
	}
	return fake.outcomeResult, fake.err
}

func (fake fakeTrialProposalManager) DecideOutcome(_ context.Context, userID int64, proposalID, decision string) (trialproposals.Outcome, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.proposalID, fake.calls.decision = "decide-outcome", userID, proposalID, decision
	}
	return fake.outcomeResult, fake.err
}

func (fake fakeTrialProposalManager) ListFeedback(_ context.Context, userID int64, proposalID string) ([]trialproposals.Feedback, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.proposalID = "list-feedback", userID, proposalID
	}
	return fake.feedbackList, fake.err
}

func (fake fakeTrialProposalManager) CreateFeedback(_ context.Context, userID int64, proposalID string, input trialproposals.FeedbackInput) (trialproposals.Feedback, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.proposalID, fake.calls.feedbackInput = "create-feedback", userID, proposalID, input
	}
	return fake.feedbackResult, fake.err
}

func (fake fakeTrialProposalManager) AcknowledgeFeedback(_ context.Context, userID int64, proposalID, feedbackID string) (trialproposals.Feedback, error) {
	if fake.calls != nil {
		fake.calls.operation, fake.calls.userID, fake.calls.proposalID, fake.calls.feedbackID = "acknowledge-feedback", userID, proposalID, feedbackID
	}
	return fake.feedbackResult, fake.err
}
