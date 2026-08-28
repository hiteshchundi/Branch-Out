# Branch-Out

Branch-Out helps small product teams find credible collaborators and safely test
whether they can build well together. The product moves trust through three
understandable signals:

1. **Skill Screened** — practical judgment has been assessed.
2. **Work Demonstrated** — prior work and the person’s contribution are visible.
3. **Collaboration Proven** — a teammate confirms behavior observed in shared work.

## Current frontend

The first frontend slice is a responsive discovery homepage split into three
clear components:

- **Header:** Branch-Out wordmark, navigation, functional project search, login
  panel, project-opening creator, and a persistent light/dark mode switch.
- **Body:** product promise, two-week trial preview, trust ladder, searchable and
  filterable project openings, complete opening details, and an early-access
  interaction.
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
persistence, and theme preference persistence.

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

## Current boundaries

- Project openings and their detail records use representative local data until
  the Go API is available.
- The login panel is accessible and interactive, but GitHub OAuth remains
  disabled until backend authentication is implemented.
- The early-access form confirms frontend input only and does not claim to store
  an email address.
- Project-opening drafts are stored only in the current browser until the backend
  project-opening API is implemented.
- The custom Branch-Out logo will be designed after the remaining frontend
  surfaces are complete.
