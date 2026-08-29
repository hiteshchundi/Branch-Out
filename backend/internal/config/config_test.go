package config

import "testing"

func TestFromEnvironmentUsesSafeDefaults(t *testing.T) {
	t.Setenv("BRANCH_OUT_API_ADDRESS", "")
	t.Setenv("BRANCH_OUT_ALLOWED_ORIGIN", "")

	got := FromEnvironment()
	if got.Address != ":8080" {
		t.Fatalf("Address = %q, want :8080", got.Address)
	}
	if got.AllowedOrigin != "http://localhost:3000" {
		t.Fatalf("AllowedOrigin = %q, want http://localhost:3000", got.AllowedOrigin)
	}
}

func TestFromEnvironmentUsesOverrides(t *testing.T) {
	t.Setenv("BRANCH_OUT_API_ADDRESS", "127.0.0.1:9090")
	t.Setenv("BRANCH_OUT_ALLOWED_ORIGIN", "https://branch-out.example")

	got := FromEnvironment()
	if got.Address != "127.0.0.1:9090" {
		t.Fatalf("Address = %q, want override", got.Address)
	}
	if got.AllowedOrigin != "https://branch-out.example" {
		t.Fatalf("AllowedOrigin = %q, want override", got.AllowedOrigin)
	}
}
