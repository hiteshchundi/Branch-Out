package auth

import (
	"context"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"net/url"
	"testing"
)

func TestGitHubClientUsesPKCEAndFetchesPublicIdentity(t *testing.T) {
	var tokenRequest url.Values
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, request *http.Request) {
		switch request.URL.Path {
		case "/token":
			if err := request.ParseForm(); err != nil {
				t.Errorf("parse token form: %v", err)
			}
			tokenRequest = request.PostForm
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]string{"access_token": "temporary-token", "token_type": "bearer"})
		case "/user":
			if request.Header.Get("Authorization") != "Bearer temporary-token" {
				t.Errorf("Authorization = %q", request.Header.Get("Authorization"))
			}
			if request.Header.Get("X-GitHub-Api-Version") != githubAPIVersion {
				t.Errorf("X-GitHub-Api-Version = %q", request.Header.Get("X-GitHub-Api-Version"))
			}
			writer.Header().Set("Content-Type", "application/json")
			_ = json.NewEncoder(writer).Encode(map[string]any{
				"id": 42, "login": "asha-rao", "name": "Asha Rao",
				"avatar_url": "https://avatars.githubusercontent.com/u/42",
				"html_url":   "https://github.com/asha-rao",
			})
		default:
			http.NotFound(writer, request)
		}
	}))
	defer server.Close()

	client := NewGitHubClient(GitHubConfig{
		ClientID: "client-id", ClientSecret: "client-secret",
		CallbackURL:      "http://localhost:8080/v1/auth/github/callback",
		AuthorizationURL: server.URL + "/authorize", TokenURL: server.URL + "/token", UserURL: server.URL + "/user",
	}, server.Client())

	authorizationURL, err := url.Parse(client.AuthorizationURL("state-value", "challenge-value"))
	if err != nil {
		t.Fatalf("parse authorization URL: %v", err)
	}
	query := authorizationURL.Query()
	if query.Get("state") != "state-value" || query.Get("code_challenge") != "challenge-value" || query.Get("code_challenge_method") != "S256" {
		t.Fatalf("authorization query = %v", query)
	}
	if _, requestedScope := query["scope"]; requestedScope {
		t.Fatal("authorization URL requested a scope for public sign-in")
	}

	user, err := client.Authenticate(context.Background(), "temporary-code", "verifier-value")
	if err != nil {
		t.Fatalf("Authenticate() error = %v", err)
	}
	if tokenRequest.Get("code") != "temporary-code" || tokenRequest.Get("code_verifier") != "verifier-value" {
		t.Fatalf("token request = %v", tokenRequest)
	}
	if user.ID != 42 || user.Login != "asha-rao" || user.ProfileURL != "https://github.com/asha-rao" {
		t.Fatalf("Authenticate() user = %#v", user)
	}
}

func TestGitHubClientRejectsProviderErrors(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(writer http.ResponseWriter, _ *http.Request) {
		writer.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(writer).Encode(map[string]string{"error": "bad_verification_code"})
	}))
	defer server.Close()

	client := NewGitHubClient(GitHubConfig{
		ClientID: "client-id", ClientSecret: "client-secret", CallbackURL: "http://localhost/callback",
		TokenURL: server.URL, UserURL: server.URL,
	}, server.Client())
	if _, err := client.Authenticate(context.Background(), "bad-code", "verifier"); err == nil {
		t.Fatal("Authenticate() error = nil, want provider error")
	}
}

func TestGitHubClientRequiresCompleteConfiguration(t *testing.T) {
	if NewGitHubClient(GitHubConfig{}, nil).Configured() {
		t.Fatal("Configured() = true without OAuth credentials")
	}
}
