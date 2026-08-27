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
  panel, and a persistent light/dark mode switch.
- **Body:** product promise, two-week trial preview, trust ladder, searchable
  project openings, and an early-access interaction.
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

The current tests cover project discovery filtering, empty search results, the
three main page regions, login-panel behavior, and theme preference persistence.

## Current boundaries

- Project openings use representative local data until the Go API is available.
- The login panel is accessible and interactive, but GitHub OAuth remains
  disabled until backend authentication is implemented.
- The early-access form confirms frontend input only and does not claim to store
  an email address.
- The custom Branch-Out logo will be designed after the remaining frontend
  surfaces are complete.
