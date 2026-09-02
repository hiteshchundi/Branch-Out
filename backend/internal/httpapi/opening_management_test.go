package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/openings"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

func TestOpeningManagementRequiresAuthentication(t *testing.T) {
	api := openingManagementTestAPI(fakeOpeningManager{}, fakeAuthenticator{currentErr: auth.ErrInvalidSession})
	for _, target := range []struct{ method, path string }{
		{http.MethodGet, "/v1/openings/mine"}, {http.MethodPost, "/v1/openings"}, {http.MethodPut, "/v1/openings/draft-id"},
		{http.MethodPost, "/v1/openings/draft-id/publish"}, {http.MethodPost, "/v1/openings/draft-id/close"},
	} {
		response := httptest.NewRecorder()
		api.ServeHTTP(response, httptest.NewRequest(target.method, target.path, bytes.NewBufferString("{}")))
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s = %d", target.method, target.path, response.Code)
		}
	}
}

func TestCreateOpeningDraftForCurrentUser(t *testing.T) {
	calls := &openingManagerCalls{}
	manager := fakeOpeningManager{calls: calls, result: openings.ManagedOpening{Opening: openings.Opening{ID: "draft-id"}, PublicationStatus: "draft"}}
	api := openingManagementTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})
	body, _ := json.Marshal(validOpeningDraftRequest())
	request := httptest.NewRequest(http.MethodPost, "/v1/openings", bytes.NewReader(body))
	request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session"})
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)
	if response.Code != http.StatusCreated || calls.userID != 7 || calls.input.ProjectName != "Climate mapper" {
		t.Fatalf("create = %d, calls %#v: %s", response.Code, calls, response.Body.String())
	}
}

func TestOpeningDraftRequiresProfileAndValidFields(t *testing.T) {
	tests := []struct {
		err    error
		status int
		code   string
	}{
		{profile.ErrNotFound, http.StatusConflict, "profile_required"},
		{&openings.DraftFieldError{Field: "problem", Message: "problem has an invalid length"}, http.StatusBadRequest, "invalid_opening"},
	}
	for _, test := range tests {
		api := openingManagementTestAPI(fakeOpeningManager{err: test.err}, fakeAuthenticator{user: auth.User{ID: 7}})
		body, _ := json.Marshal(validOpeningDraftRequest())
		request := httptest.NewRequest(http.MethodPost, "/v1/openings", bytes.NewReader(body))
		request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session"})
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)
		var envelope errorEnvelope
		_ = json.NewDecoder(response.Body).Decode(&envelope)
		if response.Code != test.status || envelope.Error.Code != test.code {
			t.Fatalf("error %v = %d, %#v", test.err, response.Code, envelope)
		}
	}
}

func TestOpeningDraftRejectsInvalidJSON(t *testing.T) {
	for _, body := range []string{
		`{"projectName":"Climate mapper","unknown":true}`,
		`{} {}`,
	} {
		api := openingManagementTestAPI(fakeOpeningManager{}, fakeAuthenticator{user: auth.User{ID: 7}})
		request := httptest.NewRequest(http.MethodPost, "/v1/openings", bytes.NewBufferString(body))
		request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session"})
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)
		if response.Code != http.StatusBadRequest {
			t.Fatalf("body %q returned %d, want 400", body, response.Code)
		}
	}
}

func TestUpdateOpeningDraftHidesUneditableDraft(t *testing.T) {
	api := openingManagementTestAPI(fakeOpeningManager{err: openings.ErrDraftNotFound}, fakeAuthenticator{user: auth.User{ID: 7}})
	body, _ := json.Marshal(validOpeningDraftRequest())
	request := httptest.NewRequest(http.MethodPut, "/v1/openings/someone-elses-draft", bytes.NewReader(body))
	request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session"})
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)
	var envelope errorEnvelope
	_ = json.NewDecoder(response.Body).Decode(&envelope)
	if response.Code != http.StatusNotFound || envelope.Error.Code != "opening_draft_not_found" {
		t.Fatalf("response = %d, %#v", response.Code, envelope)
	}
}

func TestListAndUpdateOwnedOpeningDrafts(t *testing.T) {
	calls := &openingManagerCalls{}
	managed := openings.ManagedOpening{Opening: openings.Opening{ID: "draft-id"}, PublicationStatus: "draft"}
	manager := fakeOpeningManager{calls: calls, result: managed, list: []openings.ManagedOpening{managed}}
	api := openingManagementTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})

	listRequest := httptest.NewRequest(http.MethodGet, "/v1/openings/mine", nil)
	listRequest.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session"})
	listResponse := httptest.NewRecorder()
	api.ServeHTTP(listResponse, listRequest)
	if listResponse.Code != http.StatusOK || calls.listUserID != 7 {
		t.Fatalf("list = %d, calls %#v", listResponse.Code, calls)
	}

	body, _ := json.Marshal(validOpeningDraftRequest())
	updateRequest := httptest.NewRequest(http.MethodPut, "/v1/openings/draft-id", bytes.NewReader(body))
	updateRequest.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session"})
	updateResponse := httptest.NewRecorder()
	api.ServeHTTP(updateResponse, updateRequest)
	if updateResponse.Code != http.StatusOK || calls.id != "draft-id" || calls.userID != 7 {
		t.Fatalf("update = %d, calls %#v", updateResponse.Code, calls)
	}
}

func TestPublishAndCloseOwnedOpening(t *testing.T) {
	calls := &openingManagerCalls{}
	manager := fakeOpeningManager{calls: calls, result: openings.ManagedOpening{PublicationStatus: "published"}}
	api := openingManagementTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})

	for _, test := range []struct {
		path       string
		transition string
	}{
		{path: "/v1/openings/draft-id/publish", transition: "publish"},
		{path: "/v1/openings/draft-id/close", transition: "close"},
	} {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodPost, test.path, nil)
		request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session"})
		api.ServeHTTP(response, request)
		if response.Code != http.StatusOK || calls.userID != 7 || calls.id != "draft-id" || calls.transition != test.transition {
			t.Fatalf("%s response = %d, calls %#v", test.transition, response.Code, calls)
		}
	}
}

func TestOpeningLifecycleHidesInvalidTransition(t *testing.T) {
	api := openingManagementTestAPI(fakeOpeningManager{err: openings.ErrTransitionNotFound}, fakeAuthenticator{user: auth.User{ID: 7}})
	request := httptest.NewRequest(http.MethodPost, "/v1/openings/not-owned/publish", nil)
	request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session"})
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)
	var envelope errorEnvelope
	_ = json.NewDecoder(response.Body).Decode(&envelope)
	if response.Code != http.StatusNotFound || envelope.Error.Code != "opening_transition_not_found" {
		t.Fatalf("response = %d, %#v", response.Code, envelope)
	}
}

func validOpeningDraftRequest() openings.DraftInput {
	return openings.DraftInput{
		ProjectName: "Climate mapper", Problem: "Help local teams understand climate risks with clear regional data.",
		Role: "Frontend engineer", Skills: []string{"TypeScript", "React"}, Commitment: "6–8 hrs/week",
		Duration: "5–8 weeks", Timezone: "UTC to UTC+4", Compensation: "Fixed bounty",
		FirstMilestone:    "Build the first interactive region comparison with test coverage.",
		OwnerContribution: "The API, research notes, and working wireframes are already complete.", Confidentiality: "Public",
	}
}

func openingManagementTestAPI(manager fakeOpeningManager, authentication fakeAuthenticator) http.Handler {
	return New(nil, manager, fakeApplicationManager{}, fakeTrialProposalManager{}, fakeSafetyManager{}, readyChecker{}, authentication, fakeProfileManager{}, defaultOptions, testLogger())
}

type openingManagerCalls struct {
	listUserID, userID int64
	id, transition     string
	input              openings.DraftInput
}
type fakeOpeningManager struct {
	calls  *openingManagerCalls
	list   []openings.ManagedOpening
	result openings.ManagedOpening
	err    error
}

func (fake fakeOpeningManager) ListOwned(_ context.Context, userID int64) ([]openings.ManagedOpening, error) {
	if fake.calls != nil {
		fake.calls.listUserID = userID
	}
	return fake.list, fake.err
}
func (fake fakeOpeningManager) CreateDraft(_ context.Context, userID int64, input openings.DraftInput) (openings.ManagedOpening, error) {
	if fake.calls != nil {
		fake.calls.userID, fake.calls.input = userID, input
	}
	return fake.result, fake.err
}
func (fake fakeOpeningManager) UpdateDraft(_ context.Context, userID int64, id string, input openings.DraftInput) (openings.ManagedOpening, error) {
	if fake.calls != nil {
		fake.calls.userID, fake.calls.id, fake.calls.input = userID, id, input
	}
	return fake.result, fake.err
}
func (fake fakeOpeningManager) PublishDraft(_ context.Context, userID int64, id string) (openings.ManagedOpening, error) {
	if fake.calls != nil {
		fake.calls.userID, fake.calls.id, fake.calls.transition = userID, id, "publish"
	}
	return fake.result, fake.err
}
func (fake fakeOpeningManager) CloseOpening(_ context.Context, userID int64, id string) (openings.ManagedOpening, error) {
	if fake.calls != nil {
		fake.calls.userID, fake.calls.id, fake.calls.transition = userID, id, "close"
	}
	return fake.result, fake.err
}
