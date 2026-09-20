<!--
Sync Impact Report
- Version change: 0.0.0 (template) → 1.0.0
- Modified principles: n/a (initial ratification — template placeholders replaced)
- Added sections: Core Principles (I–X), Technology & Design Constraints, Quality Gates & Workflow, Governance
- Removed sections: none (template placeholder sections renamed and filled)
- Templates requiring updates:
  - ✅ .specify/templates/plan-template.md — generic "Constitution Check" gate already references this file by path; no structural change needed, plan authors must fill it against these 10 principles
  - ✅ .specify/templates/spec-template.md — generic; principles enforced via review, not template edits
  - ✅ .specify/templates/tasks-template.md — generic; task categorization for this feature must add explicit "preservation/regression" and "visual verification" task types per Principle V/VII
  - ⚠ .agents/skills/speckit-*/SKILL.md — generic command bodies, no project-specific references found requiring edits
- Follow-up TODOs: none — all placeholders resolved from user-supplied principles
-->

# transforma (transforma) Constitution

## Core Principles

### I. Preserve Working Business Behavior During UI Changes

UI and visual redesign work MUST NOT change existing business behavior, API contracts, or data
semantics unless a specification explicitly proves the change is required and the user has
approved it in writing. Every screen migrated to the new visual system MUST continue to produce
the same domain outcomes (state transitions, persisted data, permissions) as before the
migration. Visual/structural refactors and behavioral changes MUST NOT be bundled in the same
task; behavioral changes require their own justified, approved scope.

**Rationale**: This is a redesign, not a rewrite. The fastest way to erode trust in a coaching
product is to silently change what a button does while changing how it looks.

### II. Mobile-First, Responsive, With Full Desktop Support

Every screen MUST be designed and implemented mobile-first, then verified to reflow correctly —
not simply stretch — at tablet and desktop breakpoints. Mobile remains the primary interaction
model (bottom navigation, single-column flows, sticky primary actions). Tablet and desktop MUST
progressively use available space (denser grids, persistent contextual navigation, side-by-side
editing) where that measurably helps the workflow, especially for trainer screens. Minimum
viewports to validate: 360×800, 390×844 (mobile), 768×1024 (tablet), 1440×900 (desktop).

**Rationale**: Clients primarily use the app mid-workout on a phone; trainers frequently work
from a desktop managing many clients. Both must be first-class, not one stretched into the other.

### III. Accessible, Reusable Components on Consistent Design Tokens

All new and restyled UI MUST be built from shared, reusable React components and centrally
defined CSS design tokens (color, type scale, spacing, radius, elevation, motion) rather than
one-off, screen-local styles. Components MUST meet: visible keyboard focus states, minimum
44×44 CSS-pixel touch targets, WCAG AA color contrast, support for text scaling, and a
`prefers-reduced-motion` fallback for all animation. Client and trainer surfaces MUST share one
token system and component library, with role-appropriate density as a variant, not a fork.

**Rationale**: Two visually unrelated products (dark client app, light trainer app) is the core
problem this redesign fixes. Tokens and shared components are what keep them unified going
forward instead of drifting apart again.

### IV. Coach-Assigned Plans Are Authoritative and Read-Only for Clients

When a client has an active coach-assigned workout plan, that plan is the single primary plan
shown in the main Plan and Home experiences, is visually and functionally marked read-only, and
personal plan-building/editing controls MUST be hidden from the primary flow. The client MUST NOT
be able to modify the coach's recurring plan or schedule through any UI surface. Home and Start
screens MUST resolve the correct scheduled occurrence for the selected date using the coaching
relationship's configured time zone. When no active coach plan exists, the client retains full
personal plan create/edit/track capability.

**Rationale**: This is an existing, load-bearing product rule (trainer authority over assigned
programming). A redesign that blurs read-only vs. editable state is a functional regression even
if every pixel looks correct.

### V. Started and Completed Occurrences Are Never Destructively Replaced

A scheduled workout occurrence that a client has started or completed MUST be preserved exactly
as recorded. Trainer actions that affect future scheduling — publishing a replacement recurring
plan, editing one occurrence, rescheduling, giving a day off, or restoring an occurrence to the
recurring prescription — MUST apply only to eligible future/untouched occurrences and MUST leave
started or completed occurrences intact, per existing business rules. UI redesign MUST NOT
introduce new destructive-by-default flows (e.g., a restyled button that silently overwrites
history); every destructive action requires explicit confirmation.

**Rationale**: Workout history is the client's record of real effort. Losing or silently mutating
it breaks trust and analytics irreversibly.

### VI. Existing Capabilities Must Remain Functional

The redesign MUST NOT regress: passkey authentication, trainer roles, invitations and consent,
one-trainer-per-client enforcement, the coaching relationship lifecycle, workout animations and
the exercise repository, diet assignment, weekly check-ins, progress/personal history, fees,
personal workouts and weigh-ins, and offline/synchronization behavior. Any screen or flow in this
list that is touched MUST have its critical path exercised (automated test and/or manual
verification against a dedicated test account) before and after the change.

**Rationale**: This is a live product with real coaching relationships. "The redesign works" means
nothing if it breaks the flows people depend on daily.

### VII. Every Phase Requires Tests, Build Verification, and Responsive Visual Verification

No implementation phase is complete without: passing existing automated tests, new/updated tests
for the behavior touched, a successful production build, and responsive verification at all four
required viewports (360×800, 390×844, 768×1024, 1440×900) compared against the approved Claude
Design export and current screenshots. Phases MUST be scoped small enough that this verification
is actually performed per phase, not deferred to one final pass.

**Rationale**: A redesign spanning dozens of screens fails silently if verification is batched to
the end — by then the cost of finding a regression is much higher and much harder to attribute.

### VIII. Local Development Uses `localhost:8080`, Never `127.0.0.1:8080`

All local verification, manual testing, and documentation referencing the dev server MUST use
`http://localhost:8080`. `127.0.0.1:8080` MUST NOT be used or introduced (including in scripts,
CORS config, or docs) as part of this feature's work.

**Rationale**: Explicit, non-negotiable project convention — avoids cookie/session and CORS
mismatches tied to origin differences between `localhost` and `127.0.0.1`.

### IX. No API, Database, or Data-Model Changes Without Proven Need and Explicit Approval

This is a UI/visual redesign. No API contract, database schema, or data-model change is permitted
unless the specification explicitly demonstrates the existing contract cannot support a required,
in-scope UI behavior, and the user has explicitly approved that specific change before
implementation begins. Default assumption for every screen: the existing API and store shape are
sufficient and MUST be reused as-is.

**Rationale**: Keeps blast radius contained to presentation and interaction layers, where visual
regression is recoverable, versus data layers, where mistakes can be destructive or hard to
reverse.

### X. Preserve Unrelated Existing Work in the Dirty Worktree

The working tree contains substantial in-progress, uncommitted work unrelated to this redesign
(trainer/client coaching feature branch changes, new migrations, new tests, etc., as of this
feature's start). This feature's implementation MUST NOT discard, overwrite, `git checkout --`,
`git reset --hard`, `git clean`, or otherwise destructively touch any file or change outside the
files this feature intentionally modifies. When a file this feature needs to touch already has
unrelated uncommitted changes, those changes MUST be preserved and built upon, never dropped.

**Rationale**: Losing another feature's in-flight work as collateral damage from a styling task is
an unacceptable and avoidable cost.

## Technology & Design Constraints

The current stack is retained unless the implementation plan identifies a genuine blocker and the
user explicitly approves an exception: React 19, Vite 8, JavaScript/JSX, React Router 7 (hash
routing), Zustand, custom CSS with CSS variables, PWA + Capacitor support. Tailwind or any new UI
framework/component library MUST NOT be introduced unless the plan proves it necessary and the
user approves it in advance. The approved Claude Design HTML export(s) under
`design/claude-export/` are the visual specification only — they MUST NOT be embedded via iframe,
used to replace the React app, or have their generated JS copied in ways that duplicate existing
application state, routing, or domain logic. Design intent is translated into React components,
shared layout primitives, CSS tokens, and responsive variants; existing SVG/icon conventions are
reused where possible.

## Quality Gates & Workflow

Spec Kit governs this feature end-to-end: constitution → specify → clarify → plan → checklist →
tasks → analyze → implement → converge. Implementation MUST NOT begin until specification,
clarification, plan, checklist, and tasks are complete and `/speckit.analyze` reports no
unresolved critical inconsistency, uncovered requirement, or constitution violation. Verification
before any implementation phase is reported done includes: existing automated tests, new/updated
tests, a production build, the four required responsive viewports, comparison against the approved
Claude Design export, and exercise of the specific coaching flows the phase touched. Safe fixtures
or dedicated test accounts are used for all verification; live coaching relationships, real
invitations, and real user data MUST NOT be mutated for visual testing. `graphify-out/` is treated
as read-only reference material during planning and MUST be refreshed via `graphify update .`
after implementation changes land — it is never hand-edited.

## Governance

This constitution supersedes conflicting prior practice for this feature and its implementation.
Amendments require: a documented rationale, a version bump per the rules below, and explicit user
approval before the amended principle takes effect. All specs, plans, checklists, and tasks
produced under Spec Kit for this project MUST be checked against these principles; any deviation
must be justified in the plan's Constitution Check section or rejected. Versioning follows
semantic versioning for governance documents: MAJOR for backward-incompatible principle removals
or redefinitions, MINOR for new principles or materially expanded guidance, PATCH for wording and
clarification fixes. Compliance is reviewed at the `/speckit.analyze` gate and again before
`/speckit.converge` is considered complete.

**Version**: 1.0.0 | **Ratified**: 2026-09-18 | **Last Amended**: 2026-09-18
