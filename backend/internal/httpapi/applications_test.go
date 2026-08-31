package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hiteshchundi/branch-out/backend/internal/applications"
	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

func TestApplicationRoutesRequireAuthentication(t *testing.T) {
	api := applicationTestAPI(fakeApplicationManager{}, fakeAuthenticator{currentErr: auth.ErrInvalidSession})
	for _, target := range []struct{ method, path string }{
		{http.MethodGet, "/v1/openings/opening-id/application"},
		{http.MethodPut, "/v1/openings/opening-id/application"},
		{http.MethodPost, "/v1/openings/opening-id/application/submit"},
	} {
		response := httptest.NewRecorder()
		api.ServeHTTP(response, httptest.NewRequest(target.method, target.path, bytes.NewBufferString("{}")))
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("%s %s = %d", target.method, target.path, response.Code)
		}
	}
}

func TestSaveGetAndSubmitApplicationForCurrentUser(t *testing.T) {
	calls := &applicationManagerCalls{}
	draft := applications.Application{ID: "application-id", OpeningID: "opening-id", Status: "draft", Input: validApplicationRequest()}
	manager := fakeApplicationManager{calls: calls, result: draft}
	api := applicationTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})

	body, _ := json.Marshal(validApplicationRequest())
	saveResponse := httptest.NewRecorder()
	api.ServeHTTP(saveResponse, authenticatedApplicationRequest(http.MethodPut, "/v1/openings/opening-id/application", bytes.NewReader(body)))
	if saveResponse.Code != http.StatusOK || calls.userID != 7 || calls.openingID != "opening-id" || calls.input.Message == "" {
		t.Fatalf("save = %d, calls %#v: %s", saveResponse.Code, calls, saveResponse.Body.String())
	}

	getResponse := httptest.NewRecorder()
	api.ServeHTTP(getResponse, authenticatedApplicationRequest(http.MethodGet, "/v1/openings/opening-id/application", nil))
	if getResponse.Code != http.StatusOK || calls.operation != "get" {
		t.Fatalf("get = %d, calls %#v", getResponse.Code, calls)
	}

	manager.result.Status = "submitted"
	api = applicationTestAPI(manager, fakeAuthenticator{user: auth.User{ID: 7}})
	submitResponse := httptest.NewRecorder()
	api.ServeHTTP(submitResponse, authenticatedApplicationRequest(http.MethodPost, "/v1/openings/opening-id/application/submit", nil))
	if submitResponse.Code != http.StatusOK || calls.operation != "submit" {
		t.Fatalf("submit = %d, calls %#v", submitResponse.Code, calls)
	}
}

func TestApplicationRejectsInvalidRequestAndMapsDomainErrors(t *testing.T) {
	for _, body := range []string{`{"unknown":true}`, `{} {}`} {
		api := applicationTestAPI(fakeApplicationManager{}, fakeAuthenticator{user: auth.User{ID: 7}})
		response := httptest.NewRecorder()
		api.ServeHTTP(response, authenticatedApplicationRequest(http.MethodPut, "/v1/openings/opening-id/application", bytes.NewBufferString(body)))
		if response.Code != http.StatusBadRequest {
			t.Fatalf("body %q returned %d", body, response.Code)
		}
	}

	tests := []struct {
		err    error
		status int
		code   string
	}{
		{&applications.FieldError{Field: "message", Message: "invalid"}, http.StatusBadRequest, "invalid_application"},
		{profile.ErrNotFound, http.StatusConflict, "profile_required"},
		{applications.ErrNotFound, http.StatusNotFound, "application_not_found"},
		{applications.ErrUnavailable, http.StatusConflict, "application_unavailable"},
	}
	for _, test := range tests {
		api := applicationTestAPI(fakeApplicationManager{err: test.err}, fakeAuthenticator{user: auth.User{ID: 7}})
		body, _ := json.Marshal(validApplicationRequest())
		response := httptest.NewRecorder()
		api.ServeHTTP(response, authenticatedApplicationRequest(http.MethodPut, "/v1/openings/opening-id/application", bytes.NewReader(body)))
		var envelope errorEnvelope
		_ = json.NewDecoder(response.Body).Decode(&envelope)
		if response.Code != test.status || envelope.Error.Code != test.code {
			t.Fatalf("error %v = %d, %#v", test.err, response.Code, envelope)
		}
	}
}

func validApplicationRequest() applications.Input {
	return applications.Input{
		Message:               "I have built public climate dashboards for regional teams.",
		WorkSampleURL:         "https://github.com/example/climate-dashboard",
		WorkSampleContext:     "I implemented the interactive comparison and tests.",
		Availability:          "7 hours each week, starting next Monday",
		AvailabilityConfirmed: true,
		ProposedContribution:  "I can audit the data flow and prototype the region selector.",
	}
}

func authenticatedApplicationRequest(method, target string, body io.Reader) *http.Request {
	var request *http.Request
	if body == nil {
		request = httptest.NewRequest(method, target, nil)
	} else {
		request = httptest.NewRequest(method, target, body)
	}
	request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session"})
	return request
}

func applicationTestAPI(manager fakeApplicationManager, authentication fakeAuthenticator) http.Handler {
	return New(nil, fakeOpeningManager{}, manager, readyChecker{}, authentication, fakeProfileManager{}, defaultOptions, testLogger())
}

type applicationManagerCalls struct {
	userID    int64
	openingID string
	operation string
	input     applications.Input
}

type fakeApplicationManager struct {
	calls  *applicationManagerCalls
	result applications.Application
	err    error
}

func (fake fakeApplicationManager) GetOwn(_ context.Context, userID int64, openingID string) (applications.Application, error) {
	if fake.calls != nil {
		fake.calls.userID, fake.calls.openingID, fake.calls.operation = userID, openingID, "get"
	}
	return fake.result, fake.err
}

func (fake fakeApplicationManager) SaveDraft(_ context.Context, userID int64, openingID string, input applications.Input) (applications.Application, error) {
	if fake.calls != nil {
		fake.calls.userID, fake.calls.openingID, fake.calls.operation, fake.calls.input = userID, openingID, "save", input
	}
	return fake.result, fake.err
}

func (fake fakeApplicationManager) Submit(_ context.Context, userID int64, openingID string) (applications.Application, error) {
	if fake.calls != nil {
		fake.calls.userID, fake.calls.openingID, fake.calls.operation = userID, openingID, "submit"
	}
	return fake.result, fake.err
}
