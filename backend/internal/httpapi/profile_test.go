package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/profile"
)

func TestProfileRequiresAuthentication(t *testing.T) {
	api := authTestAPI(fakeAuthenticator{currentErr: auth.ErrInvalidSession}, defaultOptions)
	for _, method := range []string{http.MethodGet, http.MethodPut} {
		request := httptest.NewRequest(method, "/v1/profile", bytes.NewBufferString("{}"))
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("%s status = %d, want 401", method, response.Code)
		}
	}
}

func TestGetProfileReturnsCurrentUsersProfile(t *testing.T) {
	calls := &profileCalls{}
	manager := fakeProfileManager{calls: calls, profile: completeProfile()}
	api := profileTestAPI(manager)
	request := authenticatedProfileRequest(http.MethodGet, nil)
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)

	if response.Code != http.StatusOK || calls.getUserID != 7 {
		t.Fatalf("GET profile = %d, user ID %d", response.Code, calls.getUserID)
	}
	var body profileResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil || body.Data.GitHubURL != "https://github.com/asha-rao" {
		t.Fatalf("profile response = %#v, %v", body, err)
	}
}

func TestGetProfileReportsMissingProfile(t *testing.T) {
	api := profileTestAPI(fakeProfileManager{getErr: profile.ErrNotFound})
	response := httptest.NewRecorder()
	api.ServeHTTP(response, authenticatedProfileRequest(http.MethodGet, nil))
	if response.Code != http.StatusNotFound {
		t.Fatalf("status = %d, want 404", response.Code)
	}
}

func TestPutProfileValidatesAndSavesForCurrentUser(t *testing.T) {
	input := validProfileInput()
	body, _ := json.Marshal(input)
	calls := &profileCalls{}
	manager := fakeProfileManager{calls: calls, profile: completeProfile()}
	api := profileTestAPI(manager)
	response := httptest.NewRecorder()
	api.ServeHTTP(response, authenticatedProfileRequest(http.MethodPut, bytes.NewReader(body)))

	if response.Code != http.StatusOK || calls.saveUserID != 7 || calls.input.DisplayName != "Asha Rao" {
		t.Fatalf("PUT profile = %d, calls %#v: %s", response.Code, calls, response.Body.String())
	}
}

func TestPutProfileReturnsStructuredValidationError(t *testing.T) {
	manager := fakeProfileManager{saveErr: &profile.FieldError{Field: "bio", Message: "bio has an invalid length"}}
	api := profileTestAPI(manager)
	response := httptest.NewRecorder()
	api.ServeHTTP(response, authenticatedProfileRequest(http.MethodPut, bytes.NewBufferString(`{"displayName":"Asha"}`)))
	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", response.Code)
	}
	var body errorEnvelope
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil || body.Error.Code != "invalid_profile" || body.Error.Field != "bio" {
		t.Fatalf("error body = %#v, %v", body, err)
	}
}

func TestPutProfileRejectsUnknownOrMultipleJSONValues(t *testing.T) {
	for _, body := range []string{`{"unknown":true}`, `{} {}`} {
		api := profileTestAPI(fakeProfileManager{})
		response := httptest.NewRecorder()
		api.ServeHTTP(response, authenticatedProfileRequest(http.MethodPut, bytes.NewBufferString(body)))
		if response.Code != http.StatusBadRequest {
			t.Fatalf("body %q: status = %d, want 400", body, response.Code)
		}
	}
}

func profileTestAPI(manager fakeProfileManager) http.Handler {
	if manager.calls == nil {
		manager.calls = &profileCalls{}
	}
	return New(
		nil, fakeOpeningManager{}, fakeApplicationManager{}, fakeTrialProposalManager{}, readyChecker{}, fakeAuthenticator{user: auth.User{ID: 7}}, manager,
		defaultOptions, testLogger(),
	)
}

func authenticatedProfileRequest(method string, body io.Reader) *http.Request {
	var request *http.Request
	if body == nil {
		request = httptest.NewRequest(method, "/v1/profile", nil)
	} else {
		request = httptest.NewRequest(method, "/v1/profile", body)
	}
	request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "session-token"})
	return request
}

func validProfileInput() profile.Input {
	portfolio := "https://asha.example/work"
	return profile.Input{
		DisplayName: "Asha Rao", PrimaryRole: "Software developer",
		Bio:      "I build accessible data products and enjoy small teams with clear ownership.",
		Timezone: "UTC+5:30", WeeklyAvailability: "6–8 hrs/week", PreferredDuration: "5–8 weeks",
		WorkStyle: "Async-first", CommunicationCadence: "Three updates per week",
		Skills: []string{"TypeScript", "React"}, PortfolioURL: &portfolio,
		EvidenceSummary: "The linked work shows interfaces and tests I personally delivered.",
	}
}

func completeProfile() profile.Profile {
	input := validProfileInput()
	return profile.Profile{
		UserID: 7, DisplayName: input.DisplayName, PrimaryRole: input.PrimaryRole, Bio: input.Bio,
		Timezone: input.Timezone, WeeklyAvailability: input.WeeklyAvailability,
		PreferredDuration: input.PreferredDuration, WorkStyle: input.WorkStyle,
		CommunicationCadence: input.CommunicationCadence, Skills: input.Skills,
		GitHubURL: "https://github.com/asha-rao", PortfolioURL: input.PortfolioURL,
		EvidenceSummary: input.EvidenceSummary, CreatedAt: time.Now(), UpdatedAt: time.Now(),
	}
}

type profileCalls struct {
	getUserID, saveUserID int64
	input                 profile.Input
}
type fakeProfileManager struct {
	calls           *profileCalls
	profile         profile.Profile
	getErr, saveErr error
}

func (fake fakeProfileManager) Get(_ context.Context, userID int64) (profile.Profile, error) {
	if fake.calls != nil {
		fake.calls.getUserID = userID
	}
	return fake.profile, fake.getErr
}
func (fake fakeProfileManager) Save(_ context.Context, userID int64, input profile.Input) (profile.Profile, error) {
	if fake.calls != nil {
		fake.calls.saveUserID, fake.calls.input = userID, input
	}
	return fake.profile, fake.saveErr
}

func testLogger() *slog.Logger { return slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)) }
