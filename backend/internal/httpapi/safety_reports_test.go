package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/safety"
)

func safetyTestAPI(manager fakeSafetyManager) http.Handler {
	return New(nil, fakeOpeningManager{}, fakeApplicationManager{}, fakeTrialProposalManager{}, manager, readyChecker{}, fakeAuthenticator{user: auth.User{ID: 7}}, fakeProfileManager{}, defaultOptions, testLogger())
}

func TestMembersCreateSafetyReportsAndModeratorsReviewThem(t *testing.T) {
	calls := &safetyCalls{}
	report := safety.Report{ID: "report-id", TargetKind: "trial_feedback", TargetID: "feedback-id", Category: "privacy", Status: "pending"}
	api := safetyTestAPI(fakeSafetyManager{calls: calls, result: report, listed: []safety.Report{report}})

	create := httptest.NewRecorder()
	api.ServeHTTP(create, authenticatedApplicationRequest(http.MethodPost, "/v1/safety-reports", bytes.NewBufferString(`{"targetKind":"trial_feedback","targetId":"feedback-id","category":"privacy","details":"This feedback includes private client information that should be reviewed."}`)))
	if create.Code != http.StatusCreated || calls.operation != "create" || calls.input.Category != "privacy" {
		t.Fatalf("create = %d, calls %#v: %s", create.Code, calls, create.Body.String())
	}

	list := httptest.NewRecorder()
	api.ServeHTTP(list, authenticatedApplicationRequest(http.MethodGet, "/v1/moderation/reports", nil))
	if list.Code != http.StatusOK || calls.operation != "list" || !bytes.Contains(list.Body.Bytes(), []byte("report-id")) {
		t.Fatalf("list = %d, calls %#v: %s", list.Code, calls, list.Body.String())
	}

	decision := httptest.NewRecorder()
	api.ServeHTTP(decision, authenticatedApplicationRequest(http.MethodPost, "/v1/moderation/reports/report-id/decision", bytes.NewBufferString(`{"decision":"upheld","moderatorNotes":"Confirmed private information appears in the captured review snapshot."}`)))
	if decision.Code != http.StatusOK || calls.operation != "decide" || calls.reportID != "report-id" || calls.decision.Decision != "upheld" {
		t.Fatalf("decision = %d, calls %#v: %s", decision.Code, calls, decision.Body.String())
	}
}

func TestParticipantsSubmitAppealsAndModeratorsListThem(t *testing.T) {
	calls := &safetyCalls{}
	appeal := safety.Appeal{ID: "appeal-id", ReportID: "report-id", TargetKind: "trial_feedback", TargetID: "feedback-id", Reason: "The full trial context supports reconsidering this removal.", Status: "pending"}
	api := safetyTestAPI(fakeSafetyManager{calls: calls, appeals: []safety.Appeal{appeal}})
	create := httptest.NewRecorder()
	api.ServeHTTP(create, authenticatedApplicationRequest(http.MethodPost, "/v1/moderation-appeals", bytes.NewBufferString(`{"targetKind":"trial_feedback","targetId":"feedback-id","reason":"The full trial context supports reconsidering this removal."}`)))
	if create.Code != http.StatusCreated || calls.operation != "create-appeal" || calls.appeal.TargetID != "feedback-id" { t.Fatalf("create appeal = %d, %#v: %s", create.Code, calls, create.Body.String()) }
	list := httptest.NewRecorder()
	api.ServeHTTP(list, authenticatedApplicationRequest(http.MethodGet, "/v1/moderation/appeals", nil))
	if list.Code != http.StatusOK || calls.operation != "list-appeals" || !bytes.Contains(list.Body.Bytes(), []byte("appeal-id")) { t.Fatalf("list appeals = %d, %#v: %s", list.Code, calls, list.Body.String()) }
}

func TestSafetyRoutesMapAuthorizationAndLifecycleErrors(t *testing.T) {
	for _, test := range []struct {
		path   string
		method string
		body   string
		err    error
		status int
		code   string
	}{
		{"/v1/safety-reports", http.MethodPost, `{"targetKind":"trial_feedback","targetId":"feedback-id","category":"privacy","details":"This feedback includes private client information that should be reviewed."}`, safety.ErrReportUnavailable, http.StatusConflict, "safety_report_unavailable"},
		{"/v1/moderation/reports", http.MethodGet, "", safety.ErrModeratorForbidden, http.StatusForbidden, "moderator_access_forbidden"},
		{"/v1/moderation/reports/report-id/decision", http.MethodPost, `{"decision":"dismissed","moderatorNotes":"The captured content does not violate the current moderation policy."}`, safety.ErrDecisionUnavailable, http.StatusConflict, "moderation_decision_unavailable"},
		{"/v1/moderation-appeals", http.MethodPost, `{"targetKind":"trial_feedback","targetId":"feedback-id","reason":"The full trial context supports reconsidering this removal."}`, safety.ErrAppealUnavailable, http.StatusConflict, "moderation_appeal_unavailable"},
	} {
		api := safetyTestAPI(fakeSafetyManager{err: test.err})
		response := httptest.NewRecorder()
		api.ServeHTTP(response, authenticatedApplicationRequest(test.method, test.path, bytes.NewBufferString(test.body)))
		var envelope errorEnvelope
		_ = json.NewDecoder(response.Body).Decode(&envelope)
		if response.Code != test.status || envelope.Error.Code != test.code {
			t.Fatalf("%s = %d, %#v", test.path, response.Code, envelope)
		}
	}
}
