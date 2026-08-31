# Branch-Out Handbook

Updated: 31 August 2026

This handbook is the user guide for every feature currently available in the
Branch-Out frontend. It is a living document and must be updated whenever a
feature is added, changed, or removed.

## What Branch-Out does

Branch-Out helps small teams find credible collaborators and test whether they
work well together before making a large commitment. It replaces vague profile
claims with three understandable trust signals:

1. **Skill Screened** — practical judgment was assessed in a focused challenge.
2. **Work Demonstrated** — previous work and the person's contribution are clear.
3. **Collaboration Proven** — a teammate confirmed behavior observed in shared work.

The current frontend is a local product preview. Published discovery data comes
from the Branch-Out API and PostgreSQL; unfinished signed-out workflows remain
device-local drafts while backend services are connected one feature at a time.

## Quick start

1. Start the application and open the local address shown by the development
   server.
2. Browse the homepage or use the search and filters to find an opening.
3. Save interesting openings for a device-local shortlist, or open one to review
   its outcome, owner contribution, trial milestone,
   and access expectations.
4. Choose **Apply with proof** to prepare a project-specific application draft.
5. Choose **Post a project** in the header to prepare a new opening draft.

Applications, trials, feedback, and signed-out drafts are not sent or published.
Authenticated project owners can store a private opening draft in their account,
then explicitly publish or close that opening.

## Header

The header stays at the top of the page and contains the application's global
controls.

### Branch-Out identity

**What it is:** The original Branch-Out logo and product name. One grounded stem
branches toward three nodes, representing Skill Screened, Work Demonstrated,
and Collaboration Proven. It was drawn for this repository without third-party
artwork and adapts to both color themes.

**How to use it:** Select the logo to return to the top of the homepage. On very
narrow screens, the recognizable mark remains visible while the text name is
hidden to preserve room for header controls. The complete identity remains in
the footer.

### Primary navigation

**What it is:** Short links to the main discovery and trust sections.

**How to use it:**

- Select **Openings** to move directly to project discovery.
- Select **How trust works** to review the three Branch-Out trust signals.

The navigation is hidden on smaller screens to preserve space. The same
destinations remain available elsewhere on the page and in the footer.

### Project search

**What it is:** A text search across project titles, summaries, skills, roles,
compensation, commitment, duration, timezone, and stage.

**How to use it:**

1. Enter one or more words, such as `React climate` or `accessibility`.
2. Every search word must match information in the same opening.
3. Combine search text with any discovery filters for more precise results.
4. Select the clear button inside the search field to remove only the search
   text.

### Light and dark mode

**What it is:** A two-position theme switch for light and dark appearances.

**How to use it:** Select the switch to change themes. Branch-Out saves the
choice on the current device. On a first visit, it follows the operating-system
preference.

### Post a project

**What it is:** The entry point to the three-step project-opening creator.

**How to use it:** Select **Post a project** or **Post** on a narrow screen. See
[Create a project opening](#create-a-project-opening) for the complete flow.

### Log in

**What it is:** GitHub-first member access backed by a durable Branch-Out
session.

**How to use it:** Select **Log in**, then **Continue with GitHub**. GitHub asks
for authorization and returns to Branch-Out. The header shows the member's
display name or GitHub login after the session is confirmed. Open it to view the
public GitHub profile, log out, or manage the account profile.
Branch-Out never asks the frontend to collect a GitHub password or access token.

The backend must be running with a configured GitHub OAuth app. If the API cannot
be reached, the panel explains that sign-in is unavailable. Callback, cancelled,
expired, and failed sign-in outcomes are announced on the page, then removed
from the browser address. Logging out revokes the server session and clears the
browser cookie.

Close the panel with its close button, by selecting the shaded area outside it,
or by pressing `Escape`.

## Profile onboarding

**What it is:** A three-step collaboration profile. Signed-in members load and
save it through their Branch-Out account. Signed-out visitors can still use a
device-local preview. Neither version creates a public or verified profile.

### Step 1: Identity

Enter:

- Display name
- Primary role
- A bio of at least 40 characters explaining what you build and how you work
- Timezone

Do not enter private contact details in the bio.

### Step 2: Availability

Choose:

- Realistic weekly availability
- Preferred project duration
- Async-first, balanced, or live-collaboration working style
- Preferred communication cadence

These expectations will later help both sides assess collaboration fit before
starting a trial.

### Step 3: Evidence

Enter:

- Skills you can demonstrate
- A required complete HTTPS GitHub profile link; for signed-in members this is
  supplied by the authenticated account and cannot be edited
- An optional complete HTTP or HTTPS portfolio link
- An explanation of at least 20 characters describing what the evidence shows
  and what you personally contributed

Only public evidence should be linked. Never enter passwords, access tokens,
private repository links, or client-confidential information.

### Save and complete the profile

Signed-out visitors can select **Save draft** at any step to store the current
entries in this browser. The same local draft is restored when onboarding is
reopened.

Signed-in members see existing account data when the flow opens. Complete all
three steps and select **Save profile** to create or replace the account-backed
profile. Partial authenticated profiles are not saved. Branch-Out displays the
result and states that it has not been published or verified. Signed-out users
select **Complete profile draft** and receive the existing local-only preview.
Close onboarding with its close button, the shaded area, or `Escape`.

## Homepage introduction

### Product promise

**What it is:** A short explanation of Branch-Out's goal: find collaborators who
can show their work, start with a small milestone, and earn trust through real
collaboration.

**How to use it:**

- Select **Explore openings** to move to project discovery.
- Select **See the trust model** to review how trust signals progress.

### Two-week trial preview

**What it is:** A sample of the small, reversible milestone used to begin a new
collaboration. It demonstrates the expected preparation: work-sample review,
availability confirmation, and agreed repository scope.

**How to use it:** This card is informational. Use the trial milestone shown in
each project detail when deciding whether an opening is appropriately scoped.

## Trust model

**What it is:** The visible progression from an assessed skill to credible work
and finally to confirmed collaboration behavior.

**How to use it:** Read each signal as a different kind of evidence. No single
badge is presented as absolute proof of expertise.

- **Skill Screened** describes a practical Branch-Out assessment.
- **Work Demonstrated** points to credible previous work with a clear role.
- **Collaboration Proven** records behavior confirmed after meaningful shared work.

## Discover project openings

### Result count

**What it is:** A live count of openings matching the current search and filters.

**How to use it:** Watch the count update as search text or filters change. It is
also announced to assistive technologies.

The catalogue initially announces that published openings are loading. Search
text and structured filters are sent to the API, with a short delay while typing
to avoid unnecessary requests. If the first request fails, Branch-Out shows a
clear retry action and does not substitute sample cards. If a later refresh
fails, the last successful results remain visible and are labelled as such.

### Role filter

**What it is:** A filter for Engineering, Design, or Research openings.

**How to use it:** Choose one role or leave **All roles** selected.

### Compensation filter

**What it is:** A filter for Paid, Fixed bounty, Revenue share, or Portfolio
openings.

**How to use it:** Choose one compensation type or leave **All compensation**
selected. Compensation is always shown explicitly on every card.

### Weekly-time filter

**What it is:** A filter for Under 6 hours, 6–8 hours, or 8+ hours per week.

**How to use it:** Choose the commitment you can realistically sustain or leave
**Any commitment** selected.

### Combining and resetting filters

Search and structured filters work together. An opening must satisfy every
active choice.

Select **Reset** to clear all structured filters and search text. The number in
parentheses shows how many structured filters are active. If nothing matches,
use **Reset all filters** from the empty-result message.

### Saved openings

**What it is:** A shortlist of interesting openings stored only in the current
browser. It does not require an account and does not synchronize to another
device.

**How to use it:**

1. Select **Save** on an opening card, or **Save opening** inside its detail
   panel.
2. The control changes to **Saved**, and the count beside **Saved only** updates.
3. Select **Saved only** to show only shortlisted openings. Search and the role,
   compensation, and weekly-time filters continue to apply.
4. Select **Showing saved** to return to all matching openings.
5. Select **Saved** on a card or **Remove saved** in its detail panel to remove
   the opening.

When no openings are saved, the saved-only empty state provides **Browse all
openings**. Save and removal confirmations are announced to assistive
technologies. Branch-Out validates restored IDs against the current project
catalogue and safely ignores malformed storage, duplicates, and openings that
no longer exist.

### Compare saved openings

**What it is:** A factual side-by-side decision aid for saved openings. It does
not assign a fit score, rank project owners, or recommend a winner.

**How to use it:**

1. Save at least two openings. **Compare saved** remains disabled until two are
   available.
2. Select **Compare saved** beside the saved-only control.
3. Use the opening checkboxes to choose any two or three saved openings. The
   comparison supports a maximum of three columns to keep the facts readable.
4. Compare project stage, owner trust signal, compensation, weekly time,
   duration, timezone overlap, two-week trial milestone, and access terms.
5. Select **View this opening** to move from comparison to that opening's full
   detail panel.
6. Select **Done comparing**, the close button, the shaded area, or press
   `Escape` to close the comparison.

Removing a checkbox affects only the current comparison; it does not remove the
opening from the saved shortlist. Selection changes and limits are announced to
assistive technologies. On narrow screens, comparison cards stack vertically.

### Project cards

**What they are:** Compact summaries containing compensation, freshness, title,
purpose, required skills, commitment, duration, and timezone overlap.

**How to use them:** Select **Save** to shortlist an opening or **View opening**
to open its complete details.

## Project details

**What it is:** A focused panel containing the information needed to evaluate an
opening before applying.

Each detail panel includes:

- Project stage and desired outcome
- Project owner's name and visible trust signal
- Compensation, commitment, duration, and timezone overlap
- A small two-week trial milestone
- Work the owner has already contributed
- Access and confidentiality expectations
- Required skills

**How to use it:** Review the scope and risk before selecting **Apply with
proof**. Select **Plan trial** to prepare a bounded collaboration agreement. The
trial milestone also provides **Preview outcome review** for post-trial evidence.
The opening can also be saved or removed from the shortlist here. Close the
panel with its close button, the shaded area, or `Escape`.

## Apply with proof

**What it is:** A short, project-specific application draft designed to prevent
resume-style mass applications.

### Application fields

1. **Short note to the project owner** — explain why this specific project and
   your experience fit. The note must contain at least 30 characters.
2. **One relevant work sample** — enter one complete `http` or `https` link.
   Unsupported schemes such as `javascript:` are rejected.
3. **What was your contribution?** — describe the part of the sample you
   personally delivered in at least 20 characters.
4. **Availability for this project** — state realistic weekly hours and a start
   date or timing.
5. **Proposed first contribution** — suggest one small useful action in at least
   20 characters.
6. **Availability confirmation** — confirm that the stated time is realistic for
   the project's expected duration.

### Save an application

Signed-out visitors can select **Save draft** at any time. That preview stays in
the current browser and is restored for the same project.

Signed-in members first complete every field, then select **Save private
application**. A completed collaboration profile is required. Branch-Out
validates the evidence and saves one private account draft for that published
opening. Reopening the project restores the server-backed draft. An opening's
owner cannot apply to their own opening.

### Submit an application

After saving a signed-in application, review its private summary, confirm that
the evidence and availability are ready to share, and select **Submit
application**. Submission is a separate, explicit action. The submitted
application becomes read-only and cannot be replaced by another draft.

Only applications for currently published openings can be saved or submitted.
The API rejects closed or unavailable openings. After submission, the opening
owner can review the application privately. Withdrawal and applicant-owner
messaging are separate: withdrawal is available before a decision, while
messaging is not available yet. When the owner accepts or declines, the
applicant's read-only application shows that result.

### Withdraw a submitted application

Before the owner decides, the applicant can confirm the permanent-action warning
and select **Withdraw application**. Withdrawal is irreversible, prevents an
owner decision, and does not allow another application for the same opening. The
applicant and owner both see the withdrawn state. Drafts and already-decided
applications cannot be withdrawn.

### Review submitted applications

Authenticated opening owners select **Post a project** to load their most recent
opening. A published or closed opening includes a **Submitted applications**
section. It shows submitted, decided, and withdrawn applications, ordered by the
original submission time, with the applicant's note, work sample, stated
contribution, availability, proposed first step, skills, profile evidence,
GitHub profile, and optional portfolio. A withdrawn application is labeled and
has no decision controls.

Applicant drafts remain private and never appear in owner review. Select
**Accept application** or **Decline application**, review the irreversible-action
warning, confirm it, and save the decision. Only a submitted application can be
decided, and the first decision cannot be changed in this milestone.

A member who does not own the opening receives the same not-found response as a
missing opening. Reading the list does not notify applicants. Saving a decision
makes it visible in the applicant's read-only application, but messaging and
next-step coordination are not available yet.

Close the application with its close button, the shaded area, or `Escape`.

## Plan a two-week trial

**What it is:** A project-specific draft that helps two people discuss a small,
reversible collaboration before making a larger commitment. It is a planning
aid, not a transmitted offer or legal agreement.

**Where to find it:** Open any project detail and select **Plan trial**.

### Step 1: Scope

Define:

- A trial outcome of at least 20 characters
- A concrete, reviewable deliverable of at least 20 characters
- Explicit non-goals of at least 15 characters to prevent scope creep

The opening's proposed two-week milestone pre-fills the outcome and remains
editable.

### Step 2: Working terms

Choose:

- Start and end dates spanning 13–15 calendar days
- Whole-number weekly hours between 1 and 40
- Async updates every two days, twice-weekly live check-ins, or a weekly review
  with async updates

The end date must be after the start date. Invalid, shorter, or longer date
ranges receive an accessible field-level explanation.

### Step 3: Safeguards

Choose or describe:

- The minimum repository or production access needed
- Public, written-agreement, or synthetic-data confidentiality handling
- An ownership or licensing expectation to discuss before work starts
- A clean exit plan of at least 20 characters covering handoff, access removal,
  payment, or early termination
- Confirmation that both people must review and explicitly accept final terms

The ownership choices are discussion prompts, not legal advice. Teams remain
responsible for appropriate contracts, IP terms, security, and offboarding.

### Save and complete the trial draft

Signed-out visitors and signed-in members whose applications are not accepted
can select **Save draft** to keep a project-specific preview in the current
browser. Branch-Out safely ignores malformed stored fields.

After the opening owner accepts an application, the applicant sees **Save
private proposal**. All three sections must then be complete because the
proposal is stored as one validated account record. The private draft can be
restored on another device, but the opening owner cannot see it in this phase.

Select **Complete trial draft** after Safeguards. The completion summary shows
the outcome, dates, weekly time, check-in cadence, access level, and exit plan.
It explicitly states whether the draft is device-local or private to the
applicant's account, and that it has not been sent, accepted, or turned into a
legal agreement. Sending, owner review, mutual acceptance, and legal execution
remain later lifecycle steps. Close the flow with its close button, the shaded
area, or `Escape`.

## Review a trial outcome

**What it is:** A project-specific post-trial review that connects observable
work and collaboration behavior to an explainable trust-signal candidate. It
does not publish feedback, award a badge, or modify another person's profile.

**Where to find it:** Open a project detail and select **Preview outcome review**
inside the two-week trial milestone.

### Step 1: Outcome

Record:

- Whether the trial was completed, partially completed, or stopped early
- Whether the agreed deliverable was met, partially met, or not met
- An outcome description of at least 30 characters
- An optional complete HTTP or HTTPS public evidence link

Activity alone is not presented as proof. The summary should describe the
inspectable result and the contributor's part.

### Step 2: Collaboration

Choose at least two behaviors directly observed during the trial:

- Reliable delivery
- Clear communication
- Sound scope judgment
- Constructive feedback

Then provide one concrete example of at least 30 characters and choose **Yes**,
**Maybe, with different scope**, or **No** for collaborating again. Describe
events and decisions rather than making unsupported personality judgments.

### Step 3: Mutual review

Write a public-safe summary of at least 30 characters. Confirm that it excludes
secrets, private links, personal data, and confidential client information.
Also confirm that both collaborators must review the record before a trust
signal can be earned.

### Transparent trust-candidate rules

The completion preview shows every factor used; there is no hidden score.

- **Collaboration Proven candidate:** completed trial, met deliverable, at least
  three observed behaviors, and **Yes** to collaborating again
- **Work Demonstrated candidate:** completed or partially completed work that
  does not satisfy every Collaboration Proven rule
- **No trust signal candidate:** a stopped-early outcome

These are candidates only. No feedback or signal is published. Counterpart
confirmation and moderation will be required after accounts and the backend
exist.

### Save and close the outcome draft

Select **Save draft** at any step. Each project has a separate device-local
outcome review, and malformed stored fields or unknown behavior labels are
ignored safely. Close with the close button, shaded area, or `Escape`.

## Create a project opening

**What it is:** A three-step draft flow for describing a credible, appropriately
scoped collaboration opportunity.

### Step 1: Project

Enter:

- Project name
- Problem and desired outcome; at least 20 characters
- Open role
- Must-have skills

Select **Continue** after the current step is complete. Validation is limited to
the visible step so there are no hidden errors.

### Step 2: Commitment

Choose or enter:

- Weekly commitment
- Expected duration
- Timezone overlap
- Explicit compensation type

### Step 3: Trial

Enter:

- One small, reversible two-week milestone; at least 20 characters
- Work, research, or validation the owner has already contributed; at least 20
  characters
- Public, limited-details, or confidential-after-agreement access

The responsibility notice reminds teams that they control contracts, IP,
credentials, repository access, and offboarding.

### Save an opening draft

Signed-out visitors can select **Save draft** at any step. The current entries
are saved on this device and restored the next time the creator is opened.

Authenticated members first see their most recently updated account opening, if
one exists. Complete all three steps, then select **Save draft** or
**Save private draft** to create or update it. A completed collaboration profile
is required because the owner identity shown on the opening comes from that
profile. If drafts cannot be loaded, saving is disabled to avoid accidentally
creating a duplicate.

### Complete an opening draft

Signed-out visitors select **Complete draft** on the final step; a summary
confirms that the draft is saved locally. Authenticated members select **Save
private draft**; the summary confirms that it is stored in their account. Neither
action publishes the opening. The visible creator supports owner-only publishing
and closing.

### Publish and close an opening

After saving the final private draft, review its summary and select the public
safety confirmation. **Publish opening** remains disabled until this confirmation
is selected. Publishing makes the opening eligible for public discovery; saving
alone never publishes it.

A published opening loads in its management summary. To stop accepting
collaborators, select the separate closure confirmation and then **Close
opening**. Closure removes the opening from public discovery immediately. It
cannot currently be reopened. A closed summary offers **Start another draft** so
the owner can create a new opening without changing the closed record.

Use **Back** to return to a previous step. Close the creator with its close
button, the shaded area, or `Escape`.

## Early access

**What it is:** A frontend-only email interaction for the future first cohort.

**How to use it:** Enter a valid email address and select **Request access**. The
browser validates the email format and Branch-Out displays a confirmation. The
current frontend does not transmit or persist the address.

## Footer

**What it is:** A compact product summary, repeated navigation, and a reminder
that teams retain responsibility for access, agreements, and intellectual
property.

**How to use it:** Use its links to return to openings, the trust model, or early
access.

## Keyboard and accessibility behavior

- Press `Tab` from the top of the page to reveal **Skip to main content**, then
  press `Enter` to bypass the header controls.
- Interactive controls have visible keyboard focus.
- Dialog-style panels move focus to their close control when opened.
- `Tab` and `Shift` + `Tab` remain inside the active dialog, and the page behind
  the dialog is prevented from scrolling until the dialog closes.
- Press `Escape` to close login, project details, applications, the
  project-opening creator, profile onboarding, saved-opening comparison, and
  trial-agreement and outcome-review flows.
- Closing a dialog returns focus to the control that opened it so keyboard users
  can continue from the same place.
- Validation errors are connected to their fields and invalid fields expose
  their state to assistive technology.
- Result counts and save confirmations use live status announcements.
- Motion is minimized when the operating system requests reduced motion.
- Layouts adapt to desktop, tablet, and phone widths.

## Device-local data and privacy

The current frontend uses browser storage only for:

- Light or dark theme preference
- One profile-onboarding draft
- One signed-out project-opening preview; authenticated opening drafts are stored
  in the member account
- One proof-led application draft per project
- One two-week trial-agreement draft per project
- One outcome-review draft per project
- A validated list of saved project-opening IDs

This information stays in the browser profile on the current device. Clearing
site data for the local Branch-Out address removes it. Do not enter sensitive or
production credentials into any frontend preview field.

## Backend foundation

The repository includes a small Go REST API under `backend`. It provides
liveness and readiness checks plus `GET /v1/openings`, whose optional `query`,
`role`, `compensation`, and `commitment` filters follow the discovery controls in
the interface. Structured filter values are validated and failures use a stable
JSON error shape. Cross-origin access is limited to one configured frontend
origin.

Runtime discovery now reads from PostgreSQL through pgx and SQLC-generated typed
queries. Versioned Goose migrations create the schema and load representative
development data. The API verifies PostgreSQL during startup; its readiness route
returns HTTP 503 when the database cannot be reached. The in-memory repository
remains only as a fast test double.

The frontend calls this public discovery route directly. Header search and the
three structured filters become API query parameters, responses are validated
before rendering, and publishing or closing an owned opening triggers a catalogue
refresh.

The API also supports GitHub OAuth and durable, revocable application sessions,
and the frontend login panel now uses those routes.
It stores users, one-time OAuth attempts, and hashed session tokens in
PostgreSQL; GitHub access tokens are not retained. Public project discovery
returns only published openings.

Authenticated members can also create or replace a validated collaboration
profile through the backend. The GitHub profile link comes from the authenticated
identity rather than editable input. The visible onboarding form now loads and
saves these profiles for authenticated members while retaining a local preview
for signed-out visitors.
Authenticated members with completed profiles can also create, list, and edit
their own private opening drafts through the API. Ownership and draft status are
checked together during updates, and private drafts never appear in public
discovery. The visible project-opening creator now loads and manages the member's
most recently updated opening through these routes. It requires explicit,
separate confirmations before asking the API to publish a private draft or close
a published opening. The API records both lifecycle times. Published openings
enter public discovery; closed openings leave it. The API does not yet support
reopening or moderation.
The OpenAPI contract, database commands, rollback instructions, authentication
configuration, and operating details live in `backend/README.md`.

## Current limitations

- The development database begins with representative project and owner data.
- Public discovery requires a running API and PostgreSQL; there is no sample-data
  fallback when they are unavailable.
- GitHub login requires a configured OAuth app and a running API.
- Authenticated profiles can be saved but are not yet public or searchable. A
  completed profile is required for account-backed applications. Signed-out
  profile previews remain local only.
- Authenticated openings can be drafted, published, and closed. Reopening and
  moderation do not exist. Signed-out opening previews remain browser-local.
- Authenticated applications can be saved, submitted, and privately reviewed by
  the opening owner. Owners can make one irreversible accept/decline decision,
  which the applicant can see. Applicants can permanently withdraw before that
  decision. Reapplication, messaging, and next-step coordination are not
  available. Signed-out application previews remain browser-local.
- Trial-agreement drafts cannot be sent, mutually accepted, or signed.
- Outcome feedback and trust-signal candidates cannot be mutually confirmed,
  moderated, or published.
- Saved openings do not synchronize between browsers or devices.
- Early-access email addresses are not transmitted or stored.
- Notification and moderation flows do not exist yet.

## Handbook maintenance rule

Every feature change must update this handbook in the same development step.
Updates should cover:

1. What the feature is
2. Where to find it
3. How to use it
4. Validation, storage, privacy, and accessibility behavior
5. Any temporary limitation or backend dependency

The README should continue linking to this handbook as the primary user guide.
