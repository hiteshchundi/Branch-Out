# Branch-Out

Branch-Out helps small product teams find credible collaborators and safely test
whether they can build well together. The product moves trust through three
understandable signals:

1. **Skill Screened** — practical judgment has been assessed.
2. **Work Demonstrated** — prior work and the person’s contribution are visible.
3. **Collaboration Proven** — a teammate confirms behavior observed in shared work.

## Documentation

See the [Branch-Out Handbook](HANDBOOK.md) for a complete explanation of every
current feature, exact usage steps, validation behavior, device-local storage,
accessibility controls, and known limitations. The handbook is updated whenever
the application changes.

## Frontend MVP status

The frontend MVP is feature-complete and ready for backend integration. It is a
responsive discovery homepage split into three clear components:

- **Header:** original Branch-Out identity, navigation, functional project
  search, login and profile-onboarding preview, project-opening creator, and a
  persistent light/dark mode switch.
- **Body:** product promise, two-week trial preview, trust ladder, searchable and
  filterable project openings, a device-local saved-opening shortlist with
  factual side-by-side comparison, complete opening details, proof-led
  applications, bounded two-week trial agreements, explainable outcome reviews,
  and an early-access interaction.
- **Footer:** product summary, navigation, and a clear team-responsibility note.

The first backend milestone is also available in [`backend`](backend): a
dependency-free Go REST API with health/readiness checks, filterable project
opening discovery, automated tests, and an OpenAPI contract.

## Original brand identity

The Branch-Out mark was drawn from scratch for this repository and uses no
third-party artwork. One grounded stem branches into three outward nodes,
representing Skill Screened, Work Demonstrated, and Collaboration Proven. The
inline component adapts to light and dark themes; narrow headers retain the mark
while hiding only the text name. The same geometry is available in
`public/branch-out-mark.svg` and powers the custom favicon.

## Technology

- Next.js and React with TypeScript
- Tailwind CSS tooling with a small custom design-token layer
- Vinext/Vite development and production builds
- Vitest, Testing Library, and jsdom for automated frontend tests
- Go REST API, with PostgreSQL persistence planned for the next backend milestone

## Local development

Requirements:

- Node.js 22.13 or newer
- pnpm

Install dependencies and start the development server:

```bash
pnpm install
pnpm dev
```

Then open the local address printed by the development server.

Run the API in a second terminal (Go 1.23 or newer is required):

```bash
cd backend
go run ./cmd/api
```

The API listens on `http://localhost:8080` by default. See
[`backend/README.md`](backend/README.md) for configuration, request examples,
the OpenAPI contract, and backend-specific checks.

## Quality checks

Run the complete automated test suite:

```bash
pnpm test
```

Run static code checks and the production build:

```bash
pnpm lint
pnpm build
```

The current tests cover text and structured project discovery filters, combined
filter behavior, reset and empty states, complete project details, the three main
page regions, login-panel behavior, project-opening validation and draft
persistence, proof-led application validation and recovery, and theme preference
persistence. Profile onboarding tests cover validation, draft recovery, safe
evidence links, and honest completion behavior. Saved-opening tests cover safe
storage recovery, stale and malformed data, saving, filtering, removal, and
two-to-three-opening comparison behavior. Trial-agreement tests cover step-level
validation, safe draft recovery, two-week date bounds, persistence, and honest
completion behavior. Outcome-review tests cover evidence requirements, safe
links, draft recovery, transparent trust-candidate rules, and publication
boundaries.

The final accessibility pass adds a keyboard skip link, visible focus states,
focus containment and background-scroll locking for every dialog, consistent
Escape behavior, focus restoration to the control that opened a flow, reduced
motion support, and graceful theme switching when browser storage is blocked.

Run the backend checks separately:

```bash
cd backend
go test ./...
go vet ./...
```

## Profile onboarding

The login panel includes a clearly labelled **Preview profile setup** action. It
opens a three-step local draft for:

1. Display name, primary role, bio, and timezone
2. Weekly availability, preferred project duration, working style, and
   communication cadence
3. Skills, a required HTTPS GitHub profile, an optional portfolio, and a short
   explanation of the applicant's evidence

The preview never requests credentials or claims to authenticate the visitor.
It validates unsafe or unrelated evidence links, saves the profile draft only in
the current browser, and presents a profile preview without creating an account.

## Project discovery

Openings can be narrowed by role, compensation, weekly commitment, or any
combination of those filters with the header search. Each opening has an
accessible detail panel containing:

- Project stage and desired outcome
- Owner contribution and visible trust signal
- Commitment, duration, timezone overlap, and compensation
- A small two-week trial milestone
- Access and confidentiality expectations

### Saved openings

Every opening card and detail panel can add or remove that opening from a
device-local shortlist. **Saved only** combines with the existing search and
structured filters, displays the saved count, and offers a clear route back to
all openings when the shortlist is empty. Stored IDs are validated against the
current catalogue, so malformed browser data and openings that no longer exist
are ignored safely. The shortlist is not synced to an account or another device.

When at least two openings are saved, **Compare saved** opens a responsive
side-by-side view. People can choose any two or three saved openings and compare
compensation, weekly time, duration, timezone overlap, owner trust evidence,
the proposed two-week trial, and access expectations. The comparison does not
generate a score, rank collaborators, or choose an opening for the visitor.

## Create a project opening

The **Post a project** action opens a three-step draft flow covering:

1. Project problem, outcome, open role, and must-have skills
2. Weekly commitment, duration, timezone overlap, and explicit compensation
3. A small two-week trial milestone, owner contribution, and confidentiality

Each step validates its own fields and provides accessible error messages. A
partial or completed draft can be saved on the current device and restored when
the flow is reopened. The interface clearly states that local completion is not
publication; publishing will be connected after account onboarding exists.

## Proof-led applications

The **Apply with proof** action inside each project detail opens an application
draft tailored to that opening. It requires:

- A short project-specific note
- One complete HTTP or HTTPS work-sample link
- A clear description of the applicant's contribution to that sample
- Confirmed weekly availability
- One small proposed first contribution

Applications validate weak or missing evidence, reject unsupported URL schemes,
save separately for each project on the current device, and clearly state that a
completed frontend draft has not been sent.

## Two-week trial agreements

The **Plan trial** action inside each project detail opens a three-step draft:

1. One inspectable outcome, a reviewable deliverable, and explicit non-goals
2. Start and end dates spanning 13–15 calendar days, bounded whole-number weekly
   hours, and a check-in cadence
3. Minimum access, confidentiality handling, an ownership expectation to
   discuss, a clean exit plan, and mutual-review confirmation

Each project keeps a separate device-local draft. Restored data is limited to
known field types, each visible step validates independently, and completion
clearly states that the draft has not been sent, accepted, or converted into a
legal agreement.

## Outcome feedback and trust candidates

**Preview outcome review** inside a project's trial milestone opens a three-step
post-trial draft:

1. Actual trial and deliverable status, an outcome summary, and optional public
   evidence
2. At least two directly observed collaboration behaviors, a concrete example,
   and whether the reviewer would collaborate again
3. A public-safe summary plus privacy and mutual-review confirmations

The resulting preview is transparent: a **Collaboration Proven candidate**
requires a completed trial, met deliverable, at least three observed behaviors,
and “Yes” to collaborating again. Completed or partial work can instead become a
**Work Demonstrated candidate**. A stopped outcome creates no signal candidate.
The interface displays every factor and never calculates a hidden score.

Each project stores a separate draft locally. No feedback or trust signal is
published; counterpart confirmation and moderation require the future account
and backend systems.

## Current boundaries

- The Go API exposes representative project openings, but the frontend still
  reads its matching local catalogue until the integration milestone.
- API project openings remain in memory until PostgreSQL persistence is added.
- The login panel is accessible and interactive, but GitHub OAuth remains
  disabled until backend authentication is implemented.
- Profile onboarding creates only a device-local preview, not an authenticated
  account or public profile.
- The early-access form confirms frontend input only and does not claim to store
  an email address.
- Project-opening drafts are stored only in the current browser until the backend
  project-opening API is implemented.
- Application drafts are stored separately for each project in the current
  browser and are not submitted to another person.
- Trial-agreement drafts stay in the current browser and are not sent or
  accepted by another person.
- Outcome-review drafts and trust candidates stay local and are not confirmed or
  published.
- Saved openings stay only in the current browser and are not synchronized.
