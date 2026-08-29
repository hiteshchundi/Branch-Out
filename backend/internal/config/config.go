// Package config owns the API's environment-based runtime configuration.
package config

import "os"

const (
	defaultAddress       = ":8080"
	defaultAllowedOrigin = "http://localhost:3000"
)

type Config struct {
	Address       string
	AllowedOrigin string
}

func FromEnvironment() Config {
	return Config{
		Address:       valueOrDefault("BRANCH_OUT_API_ADDRESS", defaultAddress),
		AllowedOrigin: valueOrDefault("BRANCH_OUT_ALLOWED_ORIGIN", defaultAllowedOrigin),
	}
}

func valueOrDefault(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}

	return fallback
}
