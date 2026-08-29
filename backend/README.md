# Branch-Out API

This directory contains the modular Go API for Branch-Out. Project-opening
discovery is backed by PostgreSQL through pgx and SQLC-generated typed queries.
Goose migrations own the schema and representative development data.

## Requirements

- Go 1.26 or newer
- Docker with Compose, or a reachable PostgreSQL 18 instance

## Run locally

Start PostgreSQL and apply every migration:

```bash
make db-up
make migrate-up
```

Then start the API:

```bash
go run ./cmd/api
```

The Compose service uses local-only development credentials and persists its
data in the `branch_out_postgres_data` volume. `make db-down` stops PostgreSQL
without deleting that volume. If PostgreSQL runs elsewhere, pass its connection
string to Make and the API through `DATABASE_URL` and
`BRANCH_OUT_DATABASE_URL` respectively.

Configuration uses environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BRANCH_OUT_API_ADDRESS` | `:8080` | API listen address |
| `BRANCH_OUT_ALLOWED_ORIGIN` | `http://localhost:3000` | Exact frontend origin allowed by CORS |
| `BRANCH_OUT_DATABASE_URL` | `postgres://branch_out:branch_out@localhost:5432/branch_out?sslmode=disable` | PostgreSQL connection string |

The API validates its database connection before listening. `/readyz` also
checks PostgreSQL on every request and returns HTTP 503 with
`{"status":"unavailable"}` when the dependency cannot be reached.

## API

- `GET /healthz` — process liveness
- `GET /readyz` — service readiness
- `GET /v1/openings` — list project openings

Discovery accepts optional filters. Structured values use the labels already
shown by the frontend.

```bash
curl 'http://localhost:8080/v1/openings?query=react&role=Engineering&commitment=6%E2%80%938%20hrs%2Fweek'
```

Successful catalogue responses use a stable envelope:

```json
{
  "data": [],
  "meta": {
    "count": 0
  }
}
```

Invalid structured filters return HTTP 400 with a machine-readable code, a
human-readable message, and the relevant field.

The complete contract is in [`openapi.yaml`](openapi.yaml).

## Verify

Run unit tests and static analysis:

```bash
make test
make vet
```

With a migrated local database running, exercise the real pgx repository:

```bash
make test-integration
```

Regenerate typed database code after changing a migration or query:

```bash
make generate
```

SQLC `v1.31.1` and Goose `v3.27.3` are pinned in the Makefile so contributors
generate and migrate with the same tool versions. Generated files under
`internal/database` are committed and must not be edited by hand.

The tests cover liveness, readiness, CORS preflight behavior, response shape,
combined discovery filtering, invalid filters, unsupported methods, and unknown
routes. PostgreSQL integration tests cover full-catalogue retrieval, text search,
combined structured filters, conflicting filters, ordering, and cancellation.

## Package boundaries

- `cmd/api` composes configuration, domain service, and HTTP transport.
- `internal/config` owns environment parsing and safe defaults.
- `internal/database` contains SQLC-generated pgx query code.
- `internal/openings` owns project-opening types, filtering, and the repository
  contract, including memory and PostgreSQL implementations.
- `internal/httpapi` owns REST routing, JSON responses, CORS, and server errors.

The memory repository remains as a fast domain-test double. Runtime traffic uses
PostgreSQL. This milestone is still read-only: authenticated accounts and
project-opening write operations belong to later backend milestones.
