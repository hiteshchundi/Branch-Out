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

## Current frontend

The first frontend slice is a responsive discovery homepage split into three
clear components:

- **Header:** Branch-Out wordmark, navigation, functional project search, login
  and profile-onboarding preview, project-opening creator, and a persistent
  light/dark mode switch.
- **Body:** product promise, two-week trial preview, trust ladder, searchable and
  filterable project openings, complete opening details, proof-led applications,
  and an early-access interaction.
- **Footer:** product summary, navigation, and a clear team-responsibility note.

The final original logo is intentionally deferred until the rest of the
frontend is established. The current text wordmark is temporary and uses no
third-party artwork.

## Technology

- Next.js and React with TypeScript
- Tailwind CSS tooling with a small custom design-token layer
- Vinext/Vite development and production builds
- Vitest, Testing Library, and jsdom for automated frontend tests

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
evidence links, and honest completion behavior.

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

## Current boundaries

- Project openings and their detail records use representative local data until
  the Go API is available.
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
- The custom Branch-Out logo will be designed after the remaining frontend
  surfaces are complete.
