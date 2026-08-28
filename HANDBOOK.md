# Branch-Out Handbook

Updated: 28 August 2026

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

The current frontend is a local product preview. It uses representative project
data and device-local drafts while the account and backend services are still to
be built.

## Quick start

1. Start the application and open the local address shown by the development
   server.
2. Browse the homepage or use the search and filters to find an opening.
3. Save interesting openings for a device-local shortlist, or open one to review
   its outcome, owner contribution, trial milestone,
   and access expectations.
4. Choose **Apply with proof** to prepare a project-specific application draft.
5. Choose **Post a project** in the header to prepare a new opening draft.

Nothing in the current frontend is published or sent to another person. Drafts
are stored only in the current browser.

## Header

The header stays at the top of the page and contains the application's global
controls.

### Branch-Out wordmark

**What it is:** The temporary text identity for the product. The final original
logo will be designed after the remaining frontend features are complete.

**How to use it:** Select the wordmark to return to the top of the homepage.

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

**What it is:** A preview of the future GitHub-first member access panel.

**How to use it:** Select **Log in** to inspect the panel. GitHub authentication
is intentionally disabled until the backend authentication feature exists. The
current panel never asks for or stores credentials. Select **Preview profile
setup** to open the device-local onboarding flow described below.

Close the panel with its close button, by selecting the shaded area outside it,
or by pressing `Escape`.

## Profile onboarding preview

**What it is:** A three-step preview of the profile information Branch-Out will
collect after GitHub authentication is implemented. It creates a local draft,
not an account or public profile.

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
- A required complete HTTPS GitHub profile link
- An optional complete HTTP or HTTPS portfolio link
- An explanation of at least 20 characters describing what the evidence shows
  and what you personally contributed

Only public evidence should be linked. Never enter passwords, access tokens,
private repository links, or client-confidential information.

### Save and complete the profile draft

Select **Save draft** at any step to store the current entries in this browser.
The same draft is restored when onboarding is reopened.

Select **Complete profile draft** after the Evidence step. Branch-Out displays a
profile preview and states clearly that no account or public profile was created.
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
proof**. The opening can also be saved or removed from the shortlist here. Close
the panel with its close button, the shaded area, or `Escape`.

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

### Save an application draft

Select **Save draft** at any time. The draft is saved only in the current browser
and is restored when the application for that same project is reopened. Each
project has a separate draft.

### Complete an application draft

Select **Complete application draft**. Branch-Out validates every field and
places an accessible error next to anything that needs attention.

When validation succeeds, a summary confirms that the draft is ready and saved
on the device. It also states clearly that the application has not been sent.
Real submission will be added after account onboarding and the applications API
exist.

Close the application with its close button, the shaded area, or `Escape`.

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

Select **Save draft** at any step. The current entries are saved on this device
and restored the next time the project-opening creator is opened.

### Complete an opening draft

Select **Complete draft** on the final step. A summary confirms that the draft is
saved locally and ready for later review. It is not published. Publishing will
be added after account onboarding and the project-opening API exist.

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

- Interactive controls have visible keyboard focus.
- Dialog-style panels move focus to their close control when opened.
- Press `Escape` to close login, project details, applications, the
  project-opening creator, profile onboarding, and saved-opening comparison.
- Validation errors are connected to their fields and invalid fields expose
  their state to assistive technology.
- Result counts and save confirmations use live status announcements.
- Motion is minimized when the operating system requests reduced motion.
- Layouts adapt to desktop, tablet, and phone widths.

## Device-local data and privacy

The current frontend uses browser storage only for:

- Light or dark theme preference
- One profile-onboarding draft
- One project-opening draft
- One proof-led application draft per project
- A validated list of saved project-opening IDs

This information stays in the browser profile on the current device. Clearing
site data for the local Branch-Out address removes it. Do not enter sensitive or
production credentials into any frontend preview field.

## Current limitations

- Project and owner information is representative local data.
- GitHub login is not connected.
- Profile onboarding creates a local draft only; it does not identify or
  authenticate the visitor.
- Opening drafts cannot be published.
- Application drafts cannot be sent or reviewed by an owner.
- Saved openings do not synchronize between browsers or devices.
- Early-access email addresses are not transmitted or stored.
- There is no backend API, database, account, notification, or moderation flow yet.
- The final original Branch-Out logo is still deferred.
- The temporary OpenAI Sites configuration will be removed with its related
  hosting setup during final project cleanup.

## Handbook maintenance rule

Every feature change must update this handbook in the same development step.
Updates should cover:

1. What the feature is
2. Where to find it
3. How to use it
4. Validation, storage, privacy, and accessibility behavior
5. Any temporary limitation or backend dependency

The README should continue linking to this handbook as the primary user guide.
