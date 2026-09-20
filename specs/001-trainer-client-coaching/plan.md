# Implementation Plan: Trainer–Client Coaching MVP

**Branch**: `codex/001-trainer-client-coaching` | **Original plan**: 2026-09-07 | **Refinement**: 2026-09-12 | **Spec**: `specs/001-trainer-client-coaching/spec.md`

**Input**: Feature specification and approved responsive prototype in `design/coaching-prototype/`.

The Spec Kit feature identifier is `001-trainer-client-coaching`; setup reports this identifier as BRANCH through its feature-directory override. It is not an existing Git branch. Use `codex/001-trainer-client-coaching` when implementation creates a feature branch.

## Summary

Turn the existing individual workout tracker into a small coaching product: trainers invite clients, publish workout/diet copies, review progress and weekly check-ins, and record externally verified fees. Clients keep the existing logger/history and gain a clear assigned-workout home. Adapt the approved design to the current app rather than replacing its framework.

Keep passkeys, personal JSON data, React/Vite, and the Node API. Add SQLite-backed coaching records with explicit authorization, immutable workout prescriptions, and retry-safe result uploads. WhatsApp handles conversation; one editable check-in response and manual payment-link confirmation complete the first release.

The first MVP is now present. This refinement plan addresses gaps found by exercising the real trainer account `sachin_trainer` and client `test_1`; it changes design artifacts only and leaves application implementation to the next phase.

## Refinement outcome required

The completed experience must behave as one product, not two disconnected applications:

1. A trainer starts a client plan from saved templates, their own routines, the built-in starter plan, or a recent plan previously published to one of their clients.
2. Exercise selection uses the existing searchable 1,324-exercise catalog, metadata, and animations. Manual/custom authoring is the fallback, not the default.
3. A client sees the trainer-owned schedule in Personal Home, Plan, and Start, then records it through the existing logger and History/Stats without copying the assignment into editable personal state.
4. A trainer can move, reset, cancel, and restore future sessions. Publishing a revised recurrence produces the correct future schedule without changing past or started sessions.

## Current implementation evidence

- `WorkoutPlanEditor.jsx` creates random exercise IDs and accepts a free-text name. A typed catalog name therefore becomes an unknown custom exercise for the client and loses its animation and catalog-derived type.
- `WorkoutPlans.jsx` loads only explicitly saved coaching templates. It does not expose trainer personal routines, the starter plan, or a previous published assignment from another client, and it does not pass the selected `sourceTemplateId` when publishing.
- Assigned sessions already enter the existing logger through `beginAssignedWorkout()` and completed results already enter personal History/Stats. The missing integration is before start: `Home.jsx`, `Plan.jsx`, `Workout.jsx`, and `TabBar.jsx` read only `gym_state_v1` personal routines.
- The live `sachin_trainer -> test_1` assignment has nine retained occurrences and all are canceled. `WorkoutPlans.jsx` hides canceled rows; there is no Restore button and the existing reset-via-null API is not exposed.
- `occurrences.reconcile()` neither cancels future dates removed by a plan revision nor reactivates dates that reappear. A far-future move can also collide with a recurrence that has not yet been materialized.
- Baseline automated tests pass (**83 API**, **221 frontend**) but cover only the happy move/cancel path and do not prove these product behaviors.

## Refinement design

### 1. Correct scheduling authority first

Refactor occurrence materialization and reconciliation before adding new entry points that consume the schedule.

- Catch up elapsed dates under the previous revision before switching the assignment's current revision.
- Reconcile today through the rolling 28-day horizon as a desired set of stable recurrence keys.
- Update prescriptions only for future/today unstarted desired rows; cancel obsolete mutable rows with an audited `plan_removed` reason; add newly desired rows; preserve past, started, completed, and valid moved overrides.
- Add an idempotent trainer-only Restore mutation for explicitly canceled future occurrences. Reappearing plan-removed dates may be restored by reconciliation, while an explicit trainer cancellation remains canceled until Restore.
- Add migration `006_occurrence_restore.sql` to expand the occurrence-event type constraint for `restored`, `plan_removed`, and `plan_restored` without deleting existing events.
- Keep Move on the same occurrence ID, expose the existing null-date Reset, make unchanged moves a no-op, and reject destinations already occupied or naturally scheduled even outside the currently materialized window.
- Reject two plan days claiming the same weekday instead of silently dropping one.
- Catch up before workspace reads and assigned-session starts so the UI never relies only on the six-hour maintenance interval.

### 2. Build a catalog-backed plan composer

Extract the personal exercise picker into a shared coaching-safe component using `allExercises`, body-part/equipment filters, `Thumb`/`Media`, and the existing mode defaults.

- Store a stable plan-entry ID separately from the catalog/custom exercise ID. Built-ins resolve media locally by catalog ID; custom exercises copy the bounded metadata required to render them on the client's device. Do not send image/GIF binaries or eagerly fetch all 140MB of media.
- Default catalog cardio entries to Cardio and other entries to Reps; retain explicit Timed selection and target editing.
- Keep a clearly labeled **Custom/manual exercise** path when search has no match.
- Preserve assignment unit, per-exercise rest, and notes in the existing logger. The logger must render assignment notes and use the assignment unit/rest instead of the client's global personal defaults.

### 3. Unify reusable plan sources

Add a plan-source chooser above the editor with four groups:

- **Saved coaching templates**, including load, update/save-as-new, and archive controls.
- **My personal plan**, converted locally from `S.routines`, `S.week`, `S.customEx`, unit, and rest defaults without mutating personal state.
- **Starter Push/Pull/Legs**, converted through the same adapter.
- **Recent assignments**, returned by a bounded trainer-scoped read endpoint containing only plan content, client label, revision, and publication time. No client results or history are included.

Loading any source creates an isolated draft. Publishing never mutates the source. Only a real saved-template selection supplies `sourceTemplateId`; recent assignment reuse needs no schema-level lineage for this refinement.

### 4. Project coaching into the Personal journey

Keep SQLite assignments authoritative and personal `S.routines/week/dayPlan` preserved and independent. Add pure own-schedule selectors and a single `refreshOwnCoaching()` store action that loads bootstrap plus the active workspace, clears stale data on access loss, and refreshes on mount, focus, and every 30 seconds. When an active coach plan is present, enter exclusive coached mode and hide all personal authoring/start controls without deleting personal data.

- Personal Home shows today's trainer assignment as the primary scheduled card and marks assigned days in the week strip.
- Personal Plan becomes a detailed read-only **Coach-assigned plan** and schedule; personal routines, weekly schedule, authoring/share controls, and direct editor routes are unavailable in coached mode.
- The Start chooser and center Start button offer only today's assigned occurrence. A coach rest day links back to the coach schedule rather than offering a personal or freestyle workout.
- Assigned start remains online-only and uses `beginAssignedWorkout()`; a connection/version error refreshes the schedule without offering a personal replacement. Its logger permits actual performance entry but locks exercise/set structure and preserves the session when leaving.
- Completed assigned sessions remain in personal History/Stats exactly once and carry a visible Coach assigned plus waiting/synced label.
- Compare assigned dates in the relationship zone and personal dates in the device zone, displaying the business date/zone when they differ.

### 5. Make schedule operations recoverable in the UI

Move schedule management out of the bottom of a long draft-only form into an always-visible section. Group the rolling horizon into Upcoming, Canceled, and Past/completed.

- Upcoming: Move, Reset to original date when overridden, and confirmed Cancel.
- Canceled future: Restore, optionally to another valid date. Past canceled rows remain read-only.
- Disable only the row being saved. Preserve typed dates/draft content on errors, reload the authoritative version after 409, and show the conflict next to that row.
- Do not let a workspace refresh replace unsaved plan-editor changes.
- Client schedule views filter relevant upcoming/history rows instead of taking the first 14 database rows, which can otherwise be entirely old or canceled.

## Refinement implementation sequence and gates

1. **Occurrence correctness:** backend reconciliation, restore/reset/collision behavior, and API tests. Gate: removed/added weekdays, move/reset/cancel/restore, revisions, and immutable past/started targets all pass.
2. **Exercise identity and source adapters:** shared picker, plan schema normalization, custom metadata, personal/PPL conversion, and recent-source endpoint. Gate: a catalog exercise retains its ID, animation, type, unit, rest, and notes on the client; source copies remain isolated.
3. **Trainer composer and schedule UI:** source chooser, template management, exercise picker, grouped schedule actions, conflict/save states. Gate: the current all-canceled `test_1` plan can be restored without direct database edits.
4. **Personal projection:** own-coaching refresh/selectors plus Home, Plan, Start, History/Stats labels. Gate: a newly published today occurrence appears and starts from Personal without opening Coaching, while personal creation/edit/start/freestyle controls are absent until the coach plan is removed.
5. **Regression and browser verification:** all existing tests/build, focused API/Vitest coverage, and Safari trainer plus Firefox client journey. Gate: publish -> personal display -> start -> finish/sync -> revise -> move/reset/cancel/restore is demonstrated end-to-end on `http://localhost:8080`.

No new framework or service is required. The changes remain inside the existing React/Zustand frontend, Node API, and SQLite coaching store.

## Expected refinement footprint

- Backend: `api/coaching/occurrences.js`, `plans.js`, `workspaces.js`, `sessions.js`, `templates.js` or a focused plan-source read service, `routes.js`, validation, migration 006, and coaching plan/session tests.
- Frontend data: `useCoachingStore.js`, new pure `lib/coaching/schedule.js` and plan-source conversion helpers, plus their Vitest suites.
- Frontend UI: extract a reusable catalog picker from `sheets.jsx`; update `WorkoutPlanEditor.jsx`, `WorkoutPlans.jsx`, `ClientWorkspace.jsx`, `Home.jsx`, `Plan.jsx`, `Workout.jsx`, `TabBar.jsx`, workout/history labels, and coaching styles.
- Verification: existing API/frontend tests, production build, targeted scheduling/source/personal-flow automation, then Safari trainer and Firefox client manual validation against the existing local accounts.

## Technical Context

**Language/Version**: Existing JavaScript ES modules, JSX, and CSS; React 19, Node 22. Retain existing dependency ranges/lockfiles except the targeted SQLite addition. No TypeScript or framework migration.

**Primary Dependencies**: Existing Vite 8, React Router 7 HashRouter, Zustand 5, SimpleWebAuthn, and native Node HTTP routing; add `better-sqlite3` 13.0.3. Use existing validation/test tooling. Optional AI components remain independent and gain no authority over trainer prescriptions.

**Storage**: Existing `db.json` identities and per-user JSON state plus `DATA_DIR/coaching.sqlite`. One process, one SQLite connection, local persistent disk, WAL, FULL synchronization, foreign keys, 5,000ms busy timeout. Existing local active-workout persistence plus an authenticated-UID-scoped durable result outbox. No external database service.

**Testing**: Existing API `node --test test/*.test.js`; frontend Vitest; production build; focused API integration tests and browser acceptance scenarios. Extend existing isolated temporary-data test conventions. Actual Safari/iPhone and Chrome/Android checks remain release validation, separate from prototype viewport tests.

**Target Platform**: Existing Docker-hosted same-origin web application/PWA on desktop and mobile browsers. Preserve existing standalone mobile build behavior; coaching is a hosted-web capability in this release. No new app-store submission.

**Project Type**: Existing frontend plus backend web application, extended in place.

**Performance Goals**: At proposed pilot size (one trainer, 5–10 clients), engineering targets are p95 <=500ms for ordinary coaching API reads/writes on the deployment host, excluding external checkout/passkey interactions and deliberate lock-contention tests; visible home/selected workspace within 2 seconds on a representative mobile connection. Measure rather than claim these are already achieved. Business usability thresholds are SC-001–SC-008 in the spec.

**Constraints**: Preserve existing accounts/history/personal tools. Online start freezes assigned targets; continue/finish offline, personal starts still offline. Other coaching writes require connectivity. One active trainer per client. Explicit sharing consent. No full chat, automatic billing, nutrition database, new AI features, or marketplace. Checkout/provider/currency/contact and licensing/media checks are pilot setup inputs.

**Scale/Scope**: Proposed one-trainer pilot with 5–10 clients, while isolating additional operator-provisioned trainers. 28-day future occurrence window with catch-up materialization; Monday–Sunday weeks in stored relationship zone. No horizontal API replicas or shared network filesystem.

## Constitution Check

`.specify/memory/constitution.md` is an unfilled template, not a ratified set of principles. No substantive constitution gates can be inferred from its sample text. No constitution was changed. The checks below come from the user/specification and serve as explicit design gates.

**Before Phase 0: passed.** Scope is bounded to the agreed coaching MVP; the prototype is an approved visual reference; existing app reuse is feasible. Research was required for shared storage, invite admission/consent, sync ownership, and historical scheduling.

**After Phase 1: passed at design level.**

- Simplicity: one existing app/API, one embedded database, no additional service, chat stack, or payment integration.
- Authorization: operator-controlled trainer capability, object-scoped access, transactional single-use consent, immediate server revocation, client archive retention.
- Data preservation: additive storage, complete prescription snapshot, result outbox, canonical history merge, version conflicts, retained fee events.
- Honest state: missing/partial/unsynced is distinct from zero/completed/saved; checkout navigation does not prove payment.
- Mobile usability: approved direction is adapted to the existing UI; acceptance includes 320px/390px layouts and physical-device testing.
- Scope discipline: operational choices are configurable pilot inputs; no provider integration or rewrite of personal-state sync.

These are design checks, not evidence that the unbuilt feature passes tests. Implementation and pilot release gates are in `quickstart.md`.

## Project Structure

### Documentation (this feature)

```text
specs/001-trainer-client-coaching/
├── spec.md
├── checklists/requirements.md
├── plan.md
├── research.md
├── data-model.md
├── quickstart.md
└── contracts/
    ├── http-api.md
    └── ui-and-sync.md
```

`tasks.md` belongs to the subsequent `/speckit-tasks` phase and is intentionally not generated here.

### Source Code (repository root)

Proposed implementation locations; new files below are not created by this plan.

```text
api/
├── server.js                  # Existing auth, routes, personal history projection
├── coaching/                  # New human-coaching modules, separate from AI coach/
│   ├── db.js                  # Connection, schema versioning, migration runner
│   ├── migrations/            # Versioned coaching schema
│   ├── routes.js              # Existing handler-map integration
│   ├── access.js              # Capabilities, relationship and request guards
│   ├── invitations.js         # Admission bridge and explicit acceptance
│   ├── plans.js               # Templates, revisions, occurrence reconciliation
│   ├── sessions.js            # Snapshots, terminal results, idempotency
│   ├── progress.js            # Minimal history adapter and derived summaries
│   ├── check-ins.js           # Self-reports and one response
│   └── fees.js                # Fee state and immutable events
├── test/coaching-*.test.js    # Focused contracts/integration/recovery tests
├── package.json / package-lock.json
└── Dockerfile                 # Include modules/migrations and native dependency
frontend/
├── src/App.jsx                # Capability-aware routing and join intent
├── src/store/useStore.js      # Personal state and result reconciliation
├── src/store/useCoachingStore.js  # New views, UID cache and outbox integration
├── src/lib/coaching/          # New API, outbox, logger/date adapters + tests
├── src/views/coaching/        # Trainer/client/join/plan/fee screens
├── src/components/coaching/   # Responsive shell, cards, status and form components
├── src/sheets.jsx             # Assigned start/finish; preserve personal logger
├── src/views/Workout.jsx      # Assigned targets versus actual deviations
├── src/views/Settings.jsx     # Trainer setup/contact, retained personal settings
└── public/sw.js               # Keep all API data uncached
docker-compose.yml             # Preserve topology and persistent volume
.env.example                   # Trainer and payment-link/currency configuration
design/coaching-prototype/     # Accepted reference, independent deployment
```

**Structure Decision:** Add focused modules to the existing frontend/API. `coaching/` names human coaching to avoid confusion with optional `api/coach/`. Reuse components, pure workout helpers, test harnesses, and deployment topology. Introduce boundaries that protect ownership, persistence, or a distinct workflow.

## Phase 0 outcome

`research.md` resolves storage/runtime, identity integration, offline-session semantics, stable schedule identities, time zones, fee authority, deployment recovery, reusable plan sources, exercise identity/media, Personal projection, and reversible scheduling. No architecture clarification is outstanding.

The selected offline rule is online assigned start followed by offline logging. A research alternative allowing cached offline starts was rejected because it cannot guarantee new sessions use the latest trainer revision.

## Phase 1 outcome

`data-model.md` defines entities, ownership, validation, transitions, plan-source projections, and migration boundaries. `contracts/http-api.md` specifies baseline plus refinement routes/errors; `contracts/ui-and-sync.md` defines the unified personal/coaching presentation, composer, schedule actions, save states, and account/cache behavior. `quickstart.md` supplies implementation validation and pilot setup. No application source, migration, package lockfile, or deployment was changed in this planning phase.

## Original MVP delivery sequence (baseline now implemented)

1. **Foundation and relationships (P1):** schema/runtime, capability provisioning, request guards, invitation admission/consent, relationship ending, role-specific shell and empty states. Prove unrelated/ended-trainer denial before showing real client data.
2. **Assigned training (P1):** template editing, publication/revisions, stable occurrences, online snapshot start, logger integration, offline outbox, history reconciliation, and completion summaries. Prove stale-sync/revision preservation first.
3. **Diet and progress (P2):** reusable diet copies, weight/strength summaries, weekly check-ins, one versioned response, and WhatsApp contact. Reuse ownership/save rules.
4. **Fees and pilot readiness (P2):** validated external links, manual confirmation/correction events, overdue UI, responsive/accessibility checks, backup restore, and two-week pilot.

The refinement sequence and gates earlier in this plan supersede this historical delivery order for the next task-generation pass.

## Requirement coverage

- FR-001–FR-004: relationship/profile/invitation entities; onboarding/workspace contracts; quickstart scenarios A–C.
- FR-005–FR-007: template/revision/occurrence/session entities; plan-source/catalog/personal-projection/schedule contracts; scenarios D–F and M–O.
- FR-008: diet copies/revisions and empty states; scenario G.
- FR-009–FR-012: progress, sync receipts, check-ins, response versions, contact; scenarios H–I.
- FR-013–FR-015: fee/events and manual-confirmation contracts; scenario J.
- FR-016: additive persistence, personal-mode compatibility, durable outbox/cache boundaries; scenarios B, E, F, K–L.
- SC-001–SC-008: exact measurable thresholds appear in the quickstart pilot checks.

## Complexity Tracking

No substantive constitution violation exists to justify. The embedded database and result outbox enforce the spec's shared-write/preservation requirements. A full personal-state migration, realtime chat, provider billing integration, and new frontend framework are excluded.
