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

The responsive frontend MVP is connected incrementally to the backend and is
split into three clear components:

- **Header:** original Branch-Out identity, navigation, functional project
  search, login and profile-onboarding preview, project-opening creator, and a
  persistent light/dark mode switch.
- **Body:** product promise, two-week trial preview, trust ladder, searchable and
  filterable project openings, a device-local saved-opening shortlist with
  factual side-by-side comparison, complete opening details, proof-led
  applications, bounded two-week trial agreements, explainable outcome reviews,
  and an early-access interaction.
- **Footer:** product summary, navigation, and a clear team-responsibility note.

The backend in [`backend`](backend) is a Go REST API with PostgreSQL-backed,
filterable project-opening discovery, GitHub OAuth, durable revocable sessions,
authenticated collaboration-profile persistence, dependency-aware health
checks, owner-managed project-opening draft, publication, and closure states,
reversible migrations, typed SQLC queries, automated tests, and an OpenAPI
contract.

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
- Go REST API with PostgreSQL, pgx, SQLC, and Goose

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

The frontend calls `http://localhost:8080` by default. Set
`NEXT_PUBLIC_BRANCH_OUT_API_URL` to the API origin when it runs elsewhere.

Run PostgreSQL migrations and the API in a second terminal (Go 1.26 or newer is
required):

```bash
cd backend
make db-up
make migrate-up
go run ./cmd/api
```

The API listens on `http://localhost:8080` by default. See
[`backend/README.md`](backend/README.md) for configuration, request examples,
the OpenAPI contract, GitHub OAuth app setup, and backend-specific checks. With
OAuth credentials configured, **Log in** sends the browser through GitHub and
returns to an authenticated Branch-Out session.

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
page regions, login-panel behavior, project-opening validation, draft
persistence, explicit publication and closure, proof-led application validation
and recovery, and theme preference persistence. Profile onboarding tests cover
validation, draft recovery, safe
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
make test
make vet
```

## Profile onboarding

The login panel supports GitHub sign-in, displays the returning member, links to
their public GitHub profile, and can revoke the current session. It also includes
a clearly labelled **Preview profile setup** action that opens a three-step local
draft for signed-out visitors. Signed-in members see **Manage profile**, which
loads and saves the same fields through their Branch-Out account:

1. Display name, primary role, bio, and timezone
2. Weekly availability, preferred project duration, working style, and
   communication cadence
3. Skills, a required HTTPS GitHub profile, an optional portfolio, and a short
   explanation of the applicant's evidence

GitHub authentication never asks the frontend to handle a password or access
token. The profile flow validates unsafe or unrelated evidence links. GitHub
identity is read-only for signed-in members, and completing the flow persists
their account profile. Signed-out drafts remain only in the current browser.
Neither path publishes or verifies the profile.

## Project discovery

Openings can be narrowed by role, compensation, weekly commitment, or any
combination of those filters with the header search. The frontend sends these
choices to the Go API and renders only its validated, published results from
PostgreSQL. Initial loading, empty results, and API failures are explicit; a
failed refresh retains the last successful catalogue and offers a retry. Each
opening has an accessible detail panel containing:

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
the flow is reopened for signed-out visitors. Authenticated members with a
completed profile load and manage their most recently updated account opening.
Saving remains private. After reviewing a completed draft, the owner must
explicitly confirm that its details are safe for public release before selecting
**Publish opening**. Published openings can be closed only after a separate
confirmation; closure removes them from discovery and cannot currently be
reversed. Published and closed openings also show their owner a private list of
submitted applications with applicant proof; drafts are never exposed.
Signed-out drafts never publish.

## Proof-led applications

The **Apply with proof** action inside each project detail opens an application
draft tailored to that opening. It requires:

- A short project-specific note
- One complete HTTP or HTTPS work-sample link
- A clear description of the applicant's contribution to that sample
- Confirmed weekly availability
- One small proposed first contribution

Applications validate weak or missing evidence, reject unsupported URL schemes,
and save separately for each project. Signed-out visitors keep a device-local
preview. Signed-in members with a completed profile can save one private draft
per published opening and submit it only after a separate confirmation. A
submitted application becomes read-only. Members cannot apply to their own
opening. Opening owners can privately review submitted applications and the
applicant's completed-profile proof, then accept or decline after a separate
confirmation. The decision is immutable and visible to the applicant. Messaging,
and next-step coordination are not part of this milestone. Before a decision,
the applicant can permanently withdraw the submission; the owner sees the
withdrawn state and can no longer decide it.

## Two-week trial agreements

The **Plan trial** action inside each project detail opens a three-step draft:

1. One inspectable outcome, a reviewable deliverable, and explicit non-goals
2. Start and end dates spanning 13–15 calendar days, bounded whole-number weekly
   hours, and a check-in cadence
3. Minimum access, confidentiality handling, an ownership expectation to
   discuss, a clean exit plan, and mutual-review confirmation

Signed-out visitors and signed-in members without an accepted application keep
a separate device-local preview for each project. Once an application is
accepted, the applicant can save one complete private proposal to their account
and restore it on another device. A separate confirmation sends it privately to
the opening owner and makes it read-only. The owner can then accept or decline
once after reviewing every term. Acceptance records both approvals, while the
interface clearly states that this is a planning record rather than a legal
agreement or electronic signature.

Once accepted, the proposal becomes a private shared execution log for the
applicant and opening owner. Either participant can append a timestamped
**Progress**, **Blocker**, or **Milestone** check-in with an optional HTTP or
HTTPS evidence link. Check-ins are immutable so the timeline remains an honest
record; they are never shown in public discovery.

Either participant can then submit one private factual closeout covering the
trial result, deliverable result, delivered work, optional evidence, and handoff
or remaining work. The other participant—not the submitter—can permanently
confirm or dispute it. A confirmed closeout still remains private and does not
publish feedback or create a trust signal.

After confirmation, the same private workspace unlocks one account-backed review
for each participant. Reviews require at least two directly observed behaviors,
a concrete example, a collaborate-again choice, and a private summary. The other
participant can acknowledge receipt, but acknowledgement is explicitly not
agreement or approval. Reviews remain private and do not create a score or badge.

Once both reviews are submitted and acknowledged, Branch-Out derives a private
trial-level trust candidate with every rule shown. **Collaboration Proven**
requires a completed trial, met deliverable, both participants choosing to
collaborate again, and at least two behaviors independently observed by both.
Completed or partial work can produce **Work Demonstrated**; stopped work
produces no signal candidate. This stores no hidden score and cannot publish.

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

Each project stores a separate preview draft locally. Confirmed account-backed
trials support private participant feedback and a transparent trial-level
candidate in the accepted-trial workspace. Neither feedback nor the candidate
can be published; moderation and publication remain future work.

## Current boundaries

- Project discovery requires the Go API and PostgreSQL. The frontend does not
  substitute sample cards when live discovery is unavailable.
- Authenticated owners can create, edit, publish, and close openings through the
  visible creator. Reopening and moderation are not implemented.
- GitHub login and logout are connected, but the OAuth app must be configured in
  the backend environment before sign-in is available.
- Authenticated profile onboarding loads and saves through the member account;
  signed-out onboarding remains a device-local preview.
- Saved account profiles are not yet public or searchable. A completed profile
  is required before an authenticated member can save an application.
- The early-access form confirms frontend input only and does not claim to store
  an email address.
- The project-opening creator stores signed-out previews in the current browser
  and authenticated drafts in the member account.
- Signed-out application previews stay in the current browser. Authenticated
  application drafts and submissions persist in the member account, and only
  submitted or decided applications appear in private owner review. Owners can
  make one irreversible accept/decline decision. Applicants can irreversibly
  withdraw a submission before that decision. Reapplication, messaging, and
  next-step coordination are not implemented.
- Trial-agreement previews stay in the current browser until the applicant is
  accepted. Accepted applicants can save and explicitly send one proposal;
  opening owners can privately accept or decline once. Mutually accepted
  proposals provide a participant-only immutable execution log. Check-in edits,
  deletions, and file uploads are unavailable. One participant can submit a
  read-only factual outcome and the counterpart can confirm or dispute it once.
  Once confirmed, both participants can submit one immutable private review and
  acknowledge receipt of the other's review without implying agreement.
  Outcome revisions, dispute resolution, counterproposals, signatures, and
  replacement proposals are not implemented.
- Outcome-review previews stay local. Account-backed participant reviews and
  their transparent trial-level candidate remain private and cannot be edited,
  moderated, converted to profile reputation, or published.
- Saved openings stay only in the current browser and are not synchronized.
