package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
	"time"

	"github.com/hiteshchundi/branch-out/backend/internal/auth"
	"github.com/hiteshchundi/branch-out/backend/internal/openings"
)

func TestGitHubAuthStartRedirectsWithProtectedStateCookie(t *testing.T) {
	calls := &authCalls{}
	authenticator := fakeAuthenticator{
		calls: calls,
		start: auth.StartResult{AuthorizationURL: "https://github.test/authorize", State: "random-state"},
	}
	api := authTestAPI(authenticator, Options{AllowedOrigin: allowedOrigin, FrontendURL: "https://branch-out.test/", CookieSecure: true})
	response := httptest.NewRecorder()
	api.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/auth/github/start", nil))

	if response.Code != http.StatusSeeOther || response.Header().Get("Location") != "https://github.test/authorize" {
		t.Fatalf("start response = %d, %q", response.Code, response.Header().Get("Location"))
	}
	cookie := findCookie(t, response.Result().Cookies(), oauthStateCookieName)
	if cookie.Value != "random-state" || !cookie.HttpOnly || !cookie.Secure || cookie.SameSite != http.SameSiteLaxMode || cookie.Path != "/v1/auth/github/callback" {
		t.Fatalf("OAuth state cookie = %#v", cookie)
	}
	if calls.startCount != 1 || response.Header().Get("Cache-Control") != "no-store" {
		t.Fatal("authentication start was not called exactly once with no-store caching")
	}
}

func TestGitHubAuthStartReportsMissingConfiguration(t *testing.T) {
	api := authTestAPI(fakeAuthenticator{startErr: auth.ErrNotConfigured}, defaultOptions)
	response := httptest.NewRecorder()
	api.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/auth/github/start", nil))
	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", response.Code)
	}
}

func TestGitHubAuthCallbackCreatesSessionAndRedirects(t *testing.T) {
	calls := &authCalls{}
	expiresAt := time.Now().Add(30 * 24 * time.Hour)
	authenticator := fakeAuthenticator{
		calls: calls,
		session: auth.Session{
			Token: "raw-session-token", ExpiresAt: expiresAt,
			User: auth.User{ID: 1, GitHubUserID: 42, GitHubLogin: "asha-rao"},
		},
	}
	api := authTestAPI(authenticator, defaultOptions)
	request := httptest.NewRequest(http.MethodGet, "/v1/auth/github/callback?state=random-state&code=temporary-code", nil)
	request.AddCookie(&http.Cookie{Name: oauthStateCookieName, Value: "random-state"})
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)

	if response.Code != http.StatusSeeOther {
		t.Fatalf("status = %d, want 303", response.Code)
	}
	destination, err := url.Parse(response.Header().Get("Location"))
	if err != nil || destination.Query().Get("auth") != "success" {
		t.Fatalf("redirect location = %q", response.Header().Get("Location"))
	}
	if calls.state != "random-state" || calls.code != "temporary-code" {
		t.Fatalf("Finish() received state %q and code %q", calls.state, calls.code)
	}
	sessionCookie := findCookie(t, response.Result().Cookies(), sessionCookieName)
	if sessionCookie.Value != "raw-session-token" || !sessionCookie.HttpOnly || sessionCookie.SameSite != http.SameSiteLaxMode || sessionCookie.Path != "/" {
		t.Fatalf("session cookie = %#v", sessionCookie)
	}
	stateCookie := findCookie(t, response.Result().Cookies(), oauthStateCookieName)
	if stateCookie.MaxAge >= 0 {
		t.Fatalf("OAuth state cookie was not expired: %#v", stateCookie)
	}
}

func TestGitHubAuthCallbackRejectsMismatchedStateBeforeExchange(t *testing.T) {
	calls := &authCalls{}
	api := authTestAPI(fakeAuthenticator{calls: calls}, defaultOptions)
	request := httptest.NewRequest(http.MethodGet, "/v1/auth/github/callback?state=query-state&code=code", nil)
	request.AddCookie(&http.Cookie{Name: oauthStateCookieName, Value: "cookie-state"})
	response := httptest.NewRecorder()
	api.ServeHTTP(response, request)

	if response.Code != http.StatusSeeOther || calls.finishCount != 0 {
		t.Fatalf("mismatched state response = %d, finish calls = %d", response.Code, calls.finishCount)
	}
	destination, _ := url.Parse(response.Header().Get("Location"))
	if destination.Query().Get("auth") != "invalid_state" {
		t.Fatalf("redirect location = %q", response.Header().Get("Location"))
	}
}

func TestCurrentSessionAndLogout(t *testing.T) {
	calls := &authCalls{}
	user := auth.User{ID: 1, GitHubUserID: 42, GitHubLogin: "asha-rao", AvatarURL: "https://avatars.test/42", ProfileURL: "https://github.test/asha-rao"}
	api := authTestAPI(fakeAuthenticator{calls: calls, user: user}, defaultOptions)

	t.Run("current user", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodGet, "/v1/session", nil)
		request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "raw-session-token"})
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)

		if response.Code != http.StatusOK || calls.currentToken != "raw-session-token" {
			t.Fatalf("current session response = %d, token = %q", response.Code, calls.currentToken)
		}
		var body sessionResponse
		if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
			t.Fatalf("decode response: %v", err)
		}
		if body.Data.GitHubLogin != "asha-rao" {
			t.Fatalf("session user = %#v", body.Data)
		}
	})

	t.Run("logout", func(t *testing.T) {
		request := httptest.NewRequest(http.MethodDelete, "/v1/session", nil)
		request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "raw-session-token"})
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)

		if response.Code != http.StatusNoContent || calls.logoutToken != "raw-session-token" {
			t.Fatalf("logout response = %d, token = %q", response.Code, calls.logoutToken)
		}
		if findCookie(t, response.Result().Cookies(), sessionCookieName).MaxAge >= 0 {
			t.Fatal("logout did not expire the session cookie")
		}
	})
}

func TestCurrentSessionRequiresValidCookie(t *testing.T) {
	api := authTestAPI(fakeAuthenticator{currentErr: auth.ErrInvalidSession}, defaultOptions)
	for _, includeCookie := range []bool{false, true} {
		request := httptest.NewRequest(http.MethodGet, "/v1/session", nil)
		if includeCookie {
			request.AddCookie(&http.Cookie{Name: sessionCookieName, Value: "expired"})
		}
		response := httptest.NewRecorder()
		api.ServeHTTP(response, request)
		if response.Code != http.StatusUnauthorized {
			t.Fatalf("include cookie %v: status = %d, want 401", includeCookie, response.Code)
		}
	}
}

func authTestAPI(authentication Authenticator, options Options) http.Handler {
	return New(
		openings.NewMemoryRepository(nil), fakeOpeningManager{}, fakeApplicationManager{}, fakeTrialProposalManager{}, readyChecker{}, authentication, fakeProfileManager{}, options,
		slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)),
	)
}

func findCookie(t *testing.T, cookies []*http.Cookie, name string) *http.Cookie {
	t.Helper()
	for _, cookie := range cookies {
		if cookie.Name == name {
			return cookie
		}
	}
	t.Fatalf("cookie %q not found", name)
	return nil
}

type authCalls struct {
	startCount   int
	finishCount  int
	state        string
	code         string
	currentToken string
	logoutToken  string
}

type fakeAuthenticator struct {
	calls      *authCalls
	start      auth.StartResult
	startErr   error
	session    auth.Session
	finishErr  error
	user       auth.User
	currentErr error
	logoutErr  error
}

func (fake fakeAuthenticator) Start(context.Context) (auth.StartResult, error) {
	if fake.calls != nil {
		fake.calls.startCount++
	}
	return fake.start, fake.startErr
}

func (fake fakeAuthenticator) Finish(_ context.Context, state, code string) (auth.Session, error) {
	if fake.calls != nil {
		fake.calls.finishCount++
		fake.calls.state = state
		fake.calls.code = code
	}
	return fake.session, fake.finishErr
}

func (fake fakeAuthenticator) CurrentUser(_ context.Context, token string) (auth.User, error) {
	if fake.calls != nil {
		fake.calls.currentToken = token
	}
	return fake.user, fake.currentErr
}

func (fake fakeAuthenticator) Logout(_ context.Context, token string) error {
	if fake.calls != nil {
		fake.calls.logoutToken = token
	}
	return fake.logoutErr
}
