package config

import "testing"

func TestFromEnvironmentUsesSafeDefaults(t *testing.T) {
	t.Setenv("BRANCH_OUT_API_ADDRESS", "")
	t.Setenv("BRANCH_OUT_ALLOWED_ORIGIN", "")
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
}

func TestFromEnvironmentUsesOverrides(t *testing.T) {
	t.Setenv("BRANCH_OUT_API_ADDRESS", "127.0.0.1:9090")
	t.Setenv("BRANCH_OUT_ALLOWED_ORIGIN", "https://branch-out.example")
	t.Setenv("BRANCH_OUT_DATABASE_URL", "postgres://example.test/branch_out")

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
}
