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
| `BRANCH_OUT_FRONTEND_URL` | `http://localhost:3000/` | Redirect destination after GitHub authentication |
| `BRANCH_OUT_GITHUB_CALLBACK_URL` | `http://localhost:8080/v1/auth/github/callback` | Callback URL registered with GitHub |
| `BRANCH_OUT_GITHUB_CLIENT_ID` | empty | GitHub OAuth app client ID |
| `BRANCH_OUT_GITHUB_CLIENT_SECRET` | empty | GitHub OAuth app client secret |
| `BRANCH_OUT_COOKIE_SECURE` | `false` | Require HTTPS when sending authentication cookies |

The API validates its database connection before listening. `/readyz` also
checks PostgreSQL on every request and returns HTTP 503 with
`{"status":"unavailable"}` when the dependency cannot be reached.

## API

- `GET /healthz` — process liveness
- `GET /readyz` — service readiness
- `GET /v1/auth/github/start` — begin GitHub authentication
- `GET /v1/auth/github/callback` — complete GitHub authentication
- `GET /v1/session` — return the authenticated user
- `DELETE /v1/session` — sign out and revoke the current session
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

## GitHub authentication

Create a GitHub OAuth app and register the callback URL shown above. Export its
client ID and secret before starting the API. Authentication remains unavailable
with a clear HTTP 503 response when either value is absent.

The API requests no GitHub scope because this milestone needs only public
identity. It protects the authorization-code flow with a one-time state value
and PKCE, then revalidates the identity through GitHub's user API. OAuth attempts
and application sessions are stored in PostgreSQL. The browser receives opaque,
HTTP-only, SameSite=Lax cookies; only SHA-256 token hashes are stored in the
database. GitHub access tokens are used only to retrieve the identity and are
not persisted.

For an HTTPS deployment, set `BRANCH_OUT_COOKIE_SECURE=true`, use HTTPS callback
and frontend URLs, and keep the client secret outside the repository. The
frontend login control is not connected to these routes yet; it remains an
explicit preview until the frontend integration milestone.

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

The tests cover liveness, readiness, credentialed CORS behavior, the OAuth and
session lifecycle, PKCE exchange behavior, response shape, combined discovery
filtering, invalid filters, unsupported methods, and unknown routes. PostgreSQL
integration tests cover single-use OAuth attempts, user upserts, session
revocation, full-catalogue retrieval, text search, combined structured filters,
conflicting filters, ordering, and cancellation.

## Package boundaries

- `cmd/api` composes configuration, domain service, and HTTP transport.
- `internal/config` owns environment parsing and safe defaults.
- `internal/database` contains SQLC-generated pgx query code.
- `internal/auth` owns GitHub OAuth, users, and durable sessions.
- `internal/openings` owns project-opening types, filtering, and the repository
  contract, including memory and PostgreSQL implementations.
- `internal/httpapi` owns REST routing, JSON responses, CORS, and server errors.

The memory repository remains as a fast domain-test double. Runtime traffic uses
PostgreSQL. Authentication can create or update an account and revoke its
sessions; project openings remain read-only, and the frontend has not yet been
wired to the backend routes.
