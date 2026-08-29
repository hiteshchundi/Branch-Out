SQLC_VERSION := v1.31.1
GOOSE_VERSION := v3.27.3
DATABASE_URL ?= postgres://branch_out:branch_out@localhost:5432/branch_out?sslmode=disable

.PHONY: db-up db-down generate migrate-up migrate-down migrate-status test test-integration vet

db-up:
	docker compose up -d postgres

db-down:
	docker compose stop postgres

generate:
	go run github.com/sqlc-dev/sqlc/cmd/sqlc@$(SQLC_VERSION) generate

migrate-up:
	go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir db/migrations postgres "$(DATABASE_URL)" up

migrate-down:
	go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir db/migrations postgres "$(DATABASE_URL)" down

migrate-status:
	go run github.com/pressly/goose/v3/cmd/goose@$(GOOSE_VERSION) -dir db/migrations postgres "$(DATABASE_URL)" status

test:
	go test ./...

test-integration:
	BRANCH_OUT_TEST_DATABASE_URL="$(DATABASE_URL)" go test ./internal/auth ./internal/openings ./internal/profile -run Postgres -count=1

vet:
	go vet ./...
