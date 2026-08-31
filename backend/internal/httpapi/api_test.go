package httpapi

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/hiteshchundi/branch-out/backend/internal/openings"
)

const allowedOrigin = "http://localhost:3000"

var defaultOptions = Options{
	AllowedOrigin: allowedOrigin,
	FrontendURL:   "http://localhost:3000/",
}

func testAPI(repository openings.Repository) http.Handler {
	return New(repository, fakeOpeningManager{}, fakeApplicationManager{}, readyChecker{}, fakeAuthenticator{}, fakeProfileManager{}, defaultOptions, slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)))
}

func TestStatusRoutes(t *testing.T) {
	api := testAPI(openings.NewMemoryRepository(nil))
	for path, wantStatus := range map[string]string{"/healthz": "ok", "/readyz": "ready"} {
		t.Run(path, func(t *testing.T) {
			response := httptest.NewRecorder()
			api.ServeHTTP(response, httptest.NewRequest(http.MethodGet, path, nil))

			if response.Code != http.StatusOK {
				t.Fatalf("status = %d, want 200", response.Code)
			}
			var body statusResponse
			if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if body.Status != wantStatus {
				t.Errorf("status body = %q, want %q", body.Status, wantStatus)
			}
		})
	}
}

func TestReadinessReturnsUnavailableWhenDependencyFails(t *testing.T) {
	api := New(
		openings.NewMemoryRepository(nil),
		fakeOpeningManager{},
		fakeApplicationManager{},
		readyChecker{err: errors.New("database unavailable")},
		fakeAuthenticator{}, fakeProfileManager{}, defaultOptions,
		slog.New(slog.NewTextHandler(&bytes.Buffer{}, nil)),
	)
	response := httptest.NewRecorder()
	api.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/readyz", nil))

	if response.Code != http.StatusServiceUnavailable {
		t.Fatalf("status = %d, want 503", response.Code)
	}
	var body statusResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Status != "unavailable" {
		t.Errorf("status body = %q, want unavailable", body.Status)
	}
}

func TestListOpeningsReturnsFilteredEnvelope(t *testing.T) {
	api := testAPI(openings.NewMemoryRepository(openings.Seed()))
	response := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/v1/openings?query=design%20accessible&role=Design&compensation=Paid", nil)

	api.ServeHTTP(response, request)

	if response.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200: %s", response.Code, response.Body.String())
	}
	var body listResponse
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Meta.Count != 1 || len(body.Data) != 1 {
		t.Fatalf("response count = %d and data length = %d, want 1", body.Meta.Count, len(body.Data))
	}
	if body.Data[0].ID != "accessible-finance" {
		t.Errorf("opening ID = %q, want accessible-finance", body.Data[0].ID)
	}
}

func TestListOpeningsRejectsInvalidStructuredFilter(t *testing.T) {
	api := testAPI(openings.NewMemoryRepository(openings.Seed()))
	response := httptest.NewRecorder()
	api.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/openings?role=Founder", nil))

	if response.Code != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", response.Code)
	}
	var body errorEnvelope
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error.Code != "invalid_filter" || body.Error.Field != "role" {
		t.Errorf("error = %#v, want invalid_filter for role", body.Error)
	}
}

func TestListOpeningsHandlesRepositoryFailure(t *testing.T) {
	api := testAPI(failingRepository{})
	response := httptest.NewRecorder()
	api.ServeHTTP(response, httptest.NewRequest(http.MethodGet, "/v1/openings", nil))

	if response.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", response.Code)
	}
	var body errorEnvelope
	if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
		t.Fatalf("decode response: %v", err)
	}
	if body.Error.Code != "internal_error" {
		t.Errorf("error code = %q, want internal_error", body.Error.Code)
	}
}

func TestCORS(t *testing.T) {
	api := testAPI(openings.NewMemoryRepository(nil))

	t.Run("allows configured origin", func(t *testing.T) {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodOptions, "/v1/openings", nil)
		request.Header.Set("Origin", allowedOrigin)
		api.ServeHTTP(response, request)

		if response.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want 204", response.Code)
		}
		if response.Header().Get("Access-Control-Allow-Origin") != allowedOrigin {
			t.Errorf("allow origin = %q, want %q", response.Header().Get("Access-Control-Allow-Origin"), allowedOrigin)
		}
		if response.Header().Get("Access-Control-Allow-Credentials") != "true" {
			t.Error("credentialed CORS header is missing")
		}
	})

	t.Run("does not reflect another origin", func(t *testing.T) {
		response := httptest.NewRecorder()
		request := httptest.NewRequest(http.MethodGet, "/v1/openings", nil)
		request.Header.Set("Origin", "https://untrusted.example")
		api.ServeHTTP(response, request)

		if response.Header().Get("Access-Control-Allow-Origin") != "" {
			t.Errorf("unexpected allow origin %q", response.Header().Get("Access-Control-Allow-Origin"))
		}
	})
}

func TestUnsupportedMethodAndUnknownRoute(t *testing.T) {
	api := testAPI(openings.NewMemoryRepository(nil))
	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
		wantCode   string
	}{
		{name: "unsupported method", method: http.MethodPatch, path: "/v1/openings", wantStatus: http.StatusMethodNotAllowed, wantCode: "method_not_allowed"},
		{name: "unknown route", method: http.MethodGet, path: "/missing", wantStatus: http.StatusNotFound, wantCode: "not_found"},
	}

	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			response := httptest.NewRecorder()
			api.ServeHTTP(response, httptest.NewRequest(test.method, test.path, nil))

			if response.Code != test.wantStatus {
				t.Fatalf("status = %d, want %d", response.Code, test.wantStatus)
			}
			var body errorEnvelope
			if err := json.NewDecoder(response.Body).Decode(&body); err != nil {
				t.Fatalf("decode response: %v", err)
			}
			if body.Error.Code != test.wantCode {
				t.Errorf("error code = %q, want %q", body.Error.Code, test.wantCode)
			}
		})
	}
}

type failingRepository struct{}

func (failingRepository) List(context.Context, openings.Filters) ([]openings.Opening, error) {
	return nil, errors.New("repository unavailable")
}

type readyChecker struct{ err error }

func (checker readyChecker) Ping(context.Context) error {
	return checker.err
}
