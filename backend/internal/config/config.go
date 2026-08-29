// Package config owns the API's environment-based runtime configuration.
package config

import (
	"os"
	"strconv"
)

const (
	defaultAddress           = ":8080"
	defaultAllowedOrigin     = "http://localhost:3000"
	defaultDatabaseURL       = "postgres://branch_out:branch_out@localhost:5432/branch_out?sslmode=disable"
	defaultGitHubCallbackURL = "http://localhost:8080/v1/auth/github/callback"
	defaultFrontendURL       = "http://localhost:3000/"
)

type Config struct {
	Address            string
	GitHubClientID     string
	GitHubClientSecret string
	GitHubCallbackURL  string
	FrontendURL        string
	CookieSecure       bool
	AllowedOrigin      string
	DatabaseURL        string
}

func FromEnvironment() Config {
	return Config{
		Address:            valueOrDefault("BRANCH_OUT_API_ADDRESS", defaultAddress),
		AllowedOrigin:      valueOrDefault("BRANCH_OUT_ALLOWED_ORIGIN", defaultAllowedOrigin),
		GitHubClientID:     os.Getenv("BRANCH_OUT_GITHUB_CLIENT_ID"),
		GitHubClientSecret: os.Getenv("BRANCH_OUT_GITHUB_CLIENT_SECRET"),
		GitHubCallbackURL:  valueOrDefault("BRANCH_OUT_GITHUB_CALLBACK_URL", defaultGitHubCallbackURL),
		FrontendURL:        valueOrDefault("BRANCH_OUT_FRONTEND_URL", defaultFrontendURL),
		CookieSecure:       boolOrDefault("BRANCH_OUT_COOKIE_SECURE", false),
		DatabaseURL:        valueOrDefault("BRANCH_OUT_DATABASE_URL", defaultDatabaseURL),
	}
}

func valueOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}

	return fallback
}

func boolOrDefault(name string, fallback bool) bool {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	parsed, err := strconv.ParseBool(value)
	if err != nil {
		return fallback
	}
	return parsed
}
