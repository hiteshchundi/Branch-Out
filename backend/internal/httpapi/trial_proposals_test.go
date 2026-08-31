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
	operation string
	userID    int64
	openingID string
	input     trialproposals.Input
}

type fakeTrialProposalManager struct {
	calls  *trialProposalCalls
	result trialproposals.Proposal
	err    error
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
