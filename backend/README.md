# Branch-Out API

This directory contains the modular Go API for Branch-Out. The first milestone
is intentionally dependency-free and read-only: it establishes stable HTTP and
domain boundaries before PostgreSQL, GitHub OAuth, and write workflows arrive.

## Requirements

- Go 1.23 or newer

## Run locally

```bash
go run ./cmd/api
```

Configuration uses environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `BRANCH_OUT_API_ADDRESS` | `:8080` | API listen address |
| `BRANCH_OUT_ALLOWED_ORIGIN` | `http://localhost:3000` | Exact frontend origin allowed by CORS |

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

```bash
go test ./...
go vet ./...
```

The tests cover liveness, readiness, CORS preflight behavior, response shape,
combined discovery filtering, invalid filters, unsupported methods, and unknown
routes.

## Package boundaries

- `cmd/api` composes configuration, domain service, and HTTP transport.
- `internal/config` owns environment parsing and safe defaults.
- `internal/openings` owns project-opening types, filtering, and the repository
  contract.
- `internal/httpapi` owns REST routing, JSON responses, CORS, and server errors.

The in-memory repository is a deliberate seam, not a persistence strategy. The
next backend milestone should add PostgreSQL migrations and a pgx/SQLC-backed
repository behind the existing domain contract, then make readiness reflect the
database connection.
