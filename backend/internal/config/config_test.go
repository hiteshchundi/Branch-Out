package config

import "testing"

func TestFromEnvironmentUsesSafeDefaults(t *testing.T) {
	t.Setenv("BRANCH_OUT_API_ADDRESS", "")
	t.Setenv("BRANCH_OUT_ALLOWED_ORIGIN", "")
	t.Setenv("BRANCH_OUT_GITHUB_CLIENT_ID", "")
	t.Setenv("BRANCH_OUT_GITHUB_CLIENT_SECRET", "")
	t.Setenv("BRANCH_OUT_GITHUB_CALLBACK_URL", "")
	t.Setenv("BRANCH_OUT_FRONTEND_URL", "")
	t.Setenv("BRANCH_OUT_COOKIE_SECURE", "")
	t.Setenv("BRANCH_OUT_DATABASE_URL", "")

	got := FromEnvironment()
	if got.Address != ":8080" {
		t.Fatalf("Address = %q, want :8080", got.Address)
	}
	if got.AllowedOrigin != "http://localhost:3000" {
		t.Fatalf("AllowedOrigin = %q, want http://localhost:3000", got.AllowedOrigin)
	}
	if got.DatabaseURL != "postgres://branch_out:branch_out@localhost:5432/branch_out?sslmode=disable" {
		t.Fatalf("DatabaseURL = %q, want local PostgreSQL default", got.DatabaseURL)
	}
	if got.GitHubClientID != "" || got.GitHubClientSecret != "" {
		t.Fatal("GitHub credentials should not have non-empty defaults")
	}
	if got.GitHubCallbackURL != "http://localhost:8080/v1/auth/github/callback" || got.FrontendURL != "http://localhost:3000/" {
		t.Fatalf("unexpected auth URL defaults: %#v", got)
	}
	if got.CookieSecure {
		t.Fatal("CookieSecure = true for local HTTP default")
	}
}

func TestFromEnvironmentUsesOverrides(t *testing.T) {
	t.Setenv("BRANCH_OUT_API_ADDRESS", "127.0.0.1:9090")
	t.Setenv("BRANCH_OUT_ALLOWED_ORIGIN", "https://branch-out.example")
	t.Setenv("BRANCH_OUT_DATABASE_URL", "postgres://example.test/branch_out")
	t.Setenv("BRANCH_OUT_GITHUB_CLIENT_ID", "client-id")
	t.Setenv("BRANCH_OUT_GITHUB_CLIENT_SECRET", "client-secret")
	t.Setenv("BRANCH_OUT_GITHUB_CALLBACK_URL", "https://api.branch-out.example/v1/auth/github/callback")
	t.Setenv("BRANCH_OUT_FRONTEND_URL", "https://branch-out.example/")
	t.Setenv("BRANCH_OUT_COOKIE_SECURE", "true")

	got := FromEnvironment()
	if got.Address != "127.0.0.1:9090" {
		t.Fatalf("Address = %q, want override", got.Address)
	}
	if got.AllowedOrigin != "https://branch-out.example" {
		t.Fatalf("AllowedOrigin = %q, want override", got.AllowedOrigin)
	}
	if got.DatabaseURL != "postgres://example.test/branch_out" {
		t.Fatalf("DatabaseURL = %q, want override", got.DatabaseURL)
	}
	if got.GitHubClientID != "client-id" || got.GitHubClientSecret != "client-secret" {
		t.Fatal("GitHub credential overrides were not loaded")
	}
	if got.GitHubCallbackURL != "https://api.branch-out.example/v1/auth/github/callback" || got.FrontendURL != "https://branch-out.example/" {
		t.Fatalf("unexpected auth URL overrides: %#v", got)
	}
	if !got.CookieSecure {
		t.Fatal("CookieSecure = false, want true")
	}
}
