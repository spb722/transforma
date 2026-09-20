# Feature Specification: Responsive UI Redesign (Transforma "Blackprint Green")

**Feature Branch**: `002-responsive-ui-redesign`

**Created**: 2026-09-18

**Status**: Draft

**Input**: User description: "Implement the approved Transforma UI redesign (Claude Design 'Blackprint Green' export) across client and trainer experiences, preserving existing React architecture, coaching business rules, and behavior, mobile-first with tablet/desktop support."

**Visual specification**: `design/claude-export/Transforma Blackprint Green (1).html` (approved Claude Design export; interactive reference only, not production code — see Assumptions).

**Current-state references**: `design/ui-audit/current-mobile/client/` (14 screenshots), `design/ui-audit/current-mobile/trainer/` (15 screenshots), `design/ui-audit/current-web/` (8 screenshots), `design/ui-audit/CLAUDE-DESIGN-GUIDE.md`.

## Clarifications

### Session 2026-09-18

- Q: Which screens beyond the design manifest should be in scope? → A: AI Coach chat (`Coach.jsx`), Login/passkey auth (`Login.jsx`), and admin coach management (`AdminCoach.jsx`) are all in scope for this redesign.
- Q: How should `design/coaching-prototype/` (a separate Next.js + Tailwind + shadcn app) be treated? → A: Ignore entirely; it is not a visual reference for this feature. `design/claude-export/` and the current-state screenshots remain the only visual references.
- Q: Continue on the current git branch or create a new one for this feature? → A: Stay on `codex/001-trainer-client-coaching`; the Spec Kit feature directory (`specs/002-responsive-ui-redesign/`) is independent of git branch, and switching branches would risk the large uncommitted `001` work.
- Q: Are dedicated test accounts/fixtures already available for regression verification? → A: Yes — reuse `api/test/coaching-helpers.mjs` and the existing coaching test suite's fixtures (active-coach-plan client, no-coach-plan client, trainer-with-clients) rather than creating or using separate manual accounts.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Client core loop is redesigned without breaking plan authority (Priority: P1)

A client opens the app on a phone, lands on Home, sees today's status (coach-assigned or personal), opens the Plan tab, and starts today's workout — all in the new visual system. If a trainer has an active coach-assigned plan, the client sees it as the single, clearly read-only schedule; if not, the client sees and can edit a personal plan.

**Why this priority**: This is the highest-frequency path in the product (used every workout session) and the one place a visual mistake most directly risks a business-rule regression (client editing a coach's plan, or the wrong occurrence resolving for "today").

**Independent Test**: Using a test account with an active coach plan and one without, verify Home, Plan, and Start/Active Workout render the new visual system at all four required viewports, the coach-assigned plan is visibly and functionally read-only, the personal-plan path allows create/edit, and starting a workout resolves the correct occurrence for the current date and coaching time zone.

**Acceptance Scenarios**:

1. **Given** a client with an active coach-assigned plan, **When** they open Home, **Then** they see today's coach-scheduled status (workout, rest, or day off) in the new visual system, with no personal-plan creation/editing controls visible in the primary flow.
2. **Given** a client with an active coach-assigned plan, **When** they open the Plan tab, **Then** they see only the coach's schedule, visibly marked read-only, and cannot edit, reorder, or delete any prescribed exercise, set, or day.
3. **Given** a client with no active coach plan, **When** they open the Plan tab, **Then** they can create, edit, and track a personal plan using the redesigned editor controls.
4. **Given** a client with a scheduled occurrence for today, **When** they tap Start Workout, **Then** the app resolves and opens that exact occurrence (not a different day's), evaluated in the coaching relationship's configured time zone.
5. **Given** a client mid-workout, **When** they log a set, rest, or finish, **Then** the active-workout UI reflects saving/success feedback in the new visual system without altering the underlying set-logging behavior.
6. **Given** the same client flows, **When** viewed at 360×800, 390×844, 768×1024, and 1440×900, **Then** navigation, content width, and touch targets adapt per the responsive requirements below with no horizontal overflow.

---

### User Story 2 - Trainer core plan-management loop is redesigned without breaking scheduling rules (Priority: P1)

A trainer opens the app, reviews their client list, opens a client's workspace, edits that client's workout plan (recurring plan editor, schedule manager), and publishes changes — all in the new visual system, on both mobile and desktop, with every distinct plan-management action (template load, recurring edit, one-day edit, reschedule, day off, restore) still visually and functionally distinguishable.

**Why this priority**: Second-highest frequency path, and the one with the most business-rule surface area (nine distinct, easily-confusable plan-management actions per the constitution's Principle V) — the redesign must not blur these into one ambiguous "edit" affordance.

**Independent Test**: Using a trainer test account with at least one active client, verify Client Overview, Client Workspace, Workout Plan Editor (with template/recent/saved sources), Recurring Plan Editor, and Schedule Manager render the new visual system, and that publishing a replacement recurring plan updates eligible future occurrences while a started/completed occurrence used in the same test remains untouched.

**Acceptance Scenarios**:

1. **Given** a trainer with multiple clients, **When** they open Client Overview, **Then** clients are listed in the new visual system with status at a glance (active plan, pending invite, needs attention), scannable at 1440×900 as a denser grid and at 390×844 as a single-column list.
2. **Given** a trainer editing a client's plan, **When** they choose to load a starter template, a saved trainer template, or a recent client plan, **Then** each source is visually distinguishable and the trainer can tell which one is currently loaded before saving.
3. **Given** a trainer editing the recurring plan, **When** they publish a replacement, **Then** eligible future scheduled occurrences update to the new prescription, while any occurrence already started or completed in the test scenario is preserved exactly as before.
4. **Given** a trainer viewing the Schedule Manager, **When** they give one day off, reschedule one occurrence, edit one occurrence without touching the recurring plan, or restore an occurrence to the recurring prescription, **Then** each action is a visually distinct, explicitly labeled control (not a shared ambiguous menu item), and each requires confirmation before applying.
5. **Given** the same trainer flows, **When** viewed at 360×800, 390×844, 768×1024, and 1440×900, **Then** desktop/tablet views use additional width for persistent contextual navigation and side-by-side editing where that aids the workflow, without becoming a stretched mobile layout.

---

### User Story 3 - Remaining client screens adopt the unified system (Priority: P2)

A client browses the exercise library and exercise detail sheets, views personal statistics, opens the coaching overview/workspace, completes a weekly check-in, reviews progress, views fees, and adjusts settings — all restyled to the same design tokens and component set as User Story 1, with all existing data and actions intact.

**Why this priority**: Lower frequency than the core loop, but required for the client experience to feel like one coherent product rather than a redesigned "shell" around untouched screens.

**Independent Test**: For each listed screen, verify it renders with the shared design tokens/components, all pre-existing actions on that screen still function (e.g., check-in submission, fee viewing, settings changes persist), and the four required viewports render without overflow.

**Acceptance Scenarios**:

1. **Given** the exercise library, **When** a client searches or filters, **Then** results render as restyled cards/rows and opening an exercise shows its detail sheet (media, instructions) unchanged in content but restyled.
2. **Given** personal statistics, **When** a client scrolls through top and lower content, **Then** all existing charts/metrics are present, restyled, and legible at all four viewports.
3. **Given** the coaching overview and workspace, **When** a client with an active coach opens them, **Then** relationship status, schedule, and communication affordances are present and restyled.
4. **Given** a weekly check-in due, **When** a client fills and submits it, **Then** the submission behavior, validation, and confirmation are unchanged, only restyled.
5. **Given** progress and fees screens, **When** a client opens them, **Then** all existing history/data displays correctly restyled, with no data loss or reformatting that hides previously visible information.
6. **Given** settings, **When** a client changes a preference, **Then** the change persists exactly as before the redesign.

---

### User Story 4 - Remaining trainer screens adopt the unified system (Priority: P2)

A trainer manages invitations, studio settings, diet assignment, check-in review, client progress review, and fee management — all restyled to the same design tokens and component set as User Story 2, with all existing data and actions intact.

**Why this priority**: Completes the trainer surface so the whole trainer experience is visually and behaviorally consistent, not just the plan-editing core.

**Independent Test**: For each listed screen, verify it renders with the shared design tokens/components, all pre-existing actions still function (e.g., sending/revoking an invitation, saving studio settings, assigning a diet, reviewing a check-in, adjusting a fee), and the four required viewports render without overflow.

**Acceptance Scenarios**:

1. **Given** pending invitations, **When** a trainer sends, revokes, or resends one, **Then** the action behaves as before the redesign, restyled with clear pending/accepted/expired status.
2. **Given** studio settings, **When** a trainer changes a setting, **Then** it persists exactly as before the redesign.
3. **Given** a client's diet assignment, **When** a trainer assigns or edits it, **Then** existing diet data and assignment behavior are unchanged, only restyled.
4. **Given** a submitted client check-in, **When** a trainer reviews it, **Then** all existing fields and any review/response action are present and restyled.
5. **Given** a client's progress history, **When** a trainer reviews it, **Then** all existing data displays correctly restyled.
6. **Given** fee management, **When** a trainer views or adjusts a client's fee, **Then** the action behaves as before the redesign, restyled.

---

### User Story 5 - Consistent states and accessibility across every migrated screen (Priority: P3)

Across every screen touched in Stories 1–4, loading, empty, error, disabled, success, offline, and (where applicable) conflict states are presented consistently using the shared token/component system, and every screen meets the accessibility bar (keyboard focus, contrast, touch targets, reduced motion, text scaling).

**Why this priority**: Cross-cutting quality bar — depends on Stories 1–4 having been migrated, and is what makes the redesign feel deliberate rather than merely re-skinned for the "happy path" only.

**Independent Test**: For a sample of at least one client screen and one trainer screen per state (loading, empty, error, disabled, success, offline, conflict), trigger the state via test fixtures and verify consistent presentation, plus run keyboard-only navigation and automated contrast checks against each migrated screen.

**Acceptance Scenarios**:

1. **Given** any migrated screen while data is loading, **When** it first renders, **Then** a consistent loading treatment (skeleton or spinner per component library) appears instead of a blank or jumping layout.
2. **Given** any migrated list/collection screen with no data, **When** it loads empty, **Then** a consistent empty-state treatment explains the state and, where applicable, offers the primary action to resolve it.
3. **Given** any migrated screen where a request fails, **When** the error occurs, **Then** a consistent error treatment is shown with a retry path where one existed before.
4. **Given** any migrated action that is temporarily unavailable (e.g., editing a started occurrence), **When** the control is disabled, **Then** it is visually distinct as disabled and communicates why, meeting the 44×44px target only when actually interactive.
5. **Given** a trainer publishing a recurring plan while another change to the same schedule occurred concurrently, **When** a conflict is detected, **Then** the UI surfaces the conflict clearly and does not silently overwrite either change.
6. **Given** the app offline (PWA/Capacitor), **When** a client or trainer opens a previously loaded screen, **Then** available cached content displays with a clear offline indicator, and actions that require connectivity are disabled with an explanation rather than failing silently.
7. **Given** any migrated screen, **When** navigated via keyboard only, **Then** every interactive element is reachable in a logical order with a visible focus state.
8. **Given** `prefers-reduced-motion` is set, **When** any migrated screen would otherwise animate, **Then** motion is reduced or removed while the state change still communicates clearly.

---

### User Story 6 - Login and AI Coach surfaces adopt the unified system (Priority: P3)

A person signs in via the passkey Login screen, and a client or admin uses the AI Coach chat and admin coach-management screens — all restyled to the same design tokens and component set as the rest of the app, with authentication and AI Coach behavior unchanged.

**Why this priority**: Confirmed in scope during clarification; lower frequency than the core loops but needed so the very first (Login) and AI-assisted screens don't feel like leftover unstyled surfaces.

**Independent Test**: Verify Login, Coach chat, and admin coach-management render with the shared design tokens/components at all four required viewports, that passkey sign-in still succeeds/fails exactly as before, and that sending/receiving an AI Coach message and toggling admin coach settings behave unchanged.

**Acceptance Scenarios**:

1. **Given** a returning user, **When** they open Login and authenticate with a passkey, **Then** the restyled screen completes sign-in exactly as before, including existing error handling for a failed or cancelled passkey attempt.
2. **Given** a client with AI Coach access, **When** they open the chat screen and send a message, **Then** the restyled chat renders the existing message flow (sending, streaming/loading, response) without changing the AI Coach's behavior or provider integration.
3. **Given** an admin/trainer on the coach-management screen, **When** they view or change AI Coach configuration, **Then** the restyled screen preserves all existing configuration options and their current behavior.

---

### Edge Cases

- What happens when a client's coach plan becomes active or is unassigned while the client has the app open (e.g., mid-session)? The Home/Plan view must reflect the new authoritative state on next data refresh, not silently keep showing stale personal-plan editing controls.
- How does the UI distinguish a rescheduled occurrence from its original day, and a day-off from a skipped/missed day, without relying on color alone?
- What happens when a plan title, client name, or exercise name is unusually long? Layout must truncate/wrap gracefully at all four viewports without breaking card or list layout or hiding the destructive/primary action.
- What happens when a trainer edits a recurring plan while a client has already started today's occurrence from the current (pre-edit) prescription? The started occurrence must not be silently altered (Principle V); the UI must make clear which occurrences the publish will and will not affect.
- What happens when the client and trainer are in different time zones? Occurrence resolution for "today" must use the coaching relationship's configured time zone, and the UI should make the applicable zone unambiguous where it affects what's shown.
- What happens when a screen has zero prior history (new client, no check-ins yet, no progress data yet)? Empty states must appear rather than broken charts or blank sections.
- What happens on a very narrow viewport (360×800) with a bottom-sheet or modal open plus the mobile keyboard visible? Critical actions (submit/save/confirm) must remain reachable without being obscured.
- What happens when a destructive trainer action (giving a day off, replacing a recurring plan, revoking an invitation) is triggered? Confirmation is always required before it applies (Principle V, design guide "destructive actions require confirmation").
- What happens when the same component (e.g., a status badge) needs to represent client-side and trainer-side variants of the same underlying state (e.g., "day off")? The redesign must render both from the same token/component so the meaning is visually consistent across roles.
- What happens to a client who has chosen the light/paper appearance preference when they open Start or Active Workout? Per the approved design export's own stated rule, the in-session workout screen always renders in the dark/ink theme regardless of the client's saved appearance preference, for legibility at arm's length in gym lighting; the preference reverts to the client's chosen appearance immediately on leaving the workout screen.

## Requirements *(mandatory)*

### Functional Requirements

**Scope & general**

- **FR-001**: The redesign MUST cover, at minimum, the client screens listed in the design guide's client screenshot manifest (Personal Home, Coach-assigned Plan, Start Workout, Personal Stats top/lower, Exercise Library, Exercise Details, Settings, Coaching Overview, Client Workspace top/schedule, Weekly Check-in, Client Progress, Client Fees) and the trainer screens listed in its trainer manifest (Client Overview, Invitations, Studio Settings, Client Workspace top/schedule, Current Workout Plan, Recurring Plan Editor sources/training-days, Schedule Manager, Manage One Workout, One-day Workout Editor, Diet Plan, Check-in Review, Client Progress, Fee Management), plus three screens confirmed in scope during clarification: the AI Coach chat screen (`Coach.jsx`), the Login/passkey authentication screen (`Login.jsx`), and the admin coach-management screen (`AdminCoach.jsx`).
- **FR-002**: The redesign MUST NOT change any existing API contract, database schema, or data model. Screens MUST be re-implemented against the existing stores/services (`useStore`, `useCoachingStore`, `api/coaching/*`) as-is.
- **FR-003**: The redesign MUST preserve every existing user-facing capability listed in the constitution's Principle VI (passkey auth, trainer roles, invitations/consent, one-trainer-per-client, coaching relationship lifecycle, workout animations/exercise repository, diets, weekly check-ins, progress/personal history, fees, personal workouts/weigh-ins, offline/sync).
- **FR-004**: The redesign MUST use a single shared set of design tokens (color, typography, spacing, radius, elevation, motion) and shared React components across both client and trainer surfaces, with role-appropriate density expressed as component variants rather than separate component trees.
- **FR-005**: The redesign MUST use the current stack as-is (React 19, Vite 8, JS/JSX, React Router 7 hash routing, Zustand, custom CSS with variables, PWA/Capacitor) and MUST NOT introduce Tailwind or another UI framework unless the plan proves a specific blocker and the user approves it.
- **FR-006**: The redesign MUST treat `design/claude-export/Transforma Blackprint Green (1).html` as the visual specification only. It MUST NOT be embedded via iframe, used as a code source to copy wholesale, or allowed to duplicate/replace existing routing or state logic.

**Client plan authority**

- **FR-007**: When a client has an active coach-assigned workout plan, the client's Home and Plan screens MUST show the coach's schedule as the primary and only plan, MUST mark it read-only in the UI, and MUST hide personal plan creation/editing controls from the primary flow.
- **FR-008**: The client MUST NOT be able to modify the coach's recurring plan or schedule through any client-facing control.
- **FR-009**: When a client has no active coach-assigned plan, the client MUST retain full ability to create, edit, and track a personal plan.
- **FR-010**: The Home and Start Workout screens MUST resolve the scheduled occurrence for the selected date using the coaching relationship's configured time zone, and MUST resolve consistently between Home's "today" status and Start Workout's opened occurrence.

**Trainer plan management**

- **FR-011**: The trainer UI MUST keep the following nine actions visually and functionally distinct: loading a starter template, loading a saved trainer template, loading a recent client plan, saving a plan as a new template, editing the recurring plan, replacing an existing recurring plan, editing one scheduled occurrence, rescheduling one occurrence, giving one day off, and restoring/returning an occurrence to the recurring plan.
- **FR-012**: Publishing a replacement recurring plan MUST update eligible future scheduled occurrences and MUST NOT alter occurrences already started or completed, consistent with existing business rules.
- **FR-013**: Every destructive or plan-replacing trainer action MUST require explicit confirmation before applying.

**Responsive behavior**

- **FR-014**: Every in-scope screen MUST be verified functional and visually correct at 360×800, 390×844 (mobile), 768×1024 (tablet), and 1440×900 (desktop).
- **FR-015**: Mobile layouts MUST use bottom navigation as the primary navigation model; tablet/desktop layouts MAY use persistent contextual navigation where it improves the trainer workflow.
- **FR-016**: Tablet and desktop layouts MUST reflow content (grids, multi-column layouts, side-by-side editing) rather than simply stretching the mobile single-column layout.
- **FR-017**: No in-scope screen MAY produce unintended horizontal page scroll/overflow at any of the four required viewports.
- **FR-018**: All interactive controls MUST have a minimum touch target of 44×44 CSS pixels.
- **FR-019**: Forms MUST remain usable with the on-screen mobile keyboard open (critical actions not obscured).

**Accessibility**

- **FR-020**: All interactive elements MUST be reachable and operable via keyboard alone, in a logical tab order.
- **FR-021**: All interactive elements MUST show a visible focus state.
- **FR-022**: Text and UI color contrast MUST meet WCAG AA.
- **FR-023**: The UI MUST support browser/OS text scaling up to 200% (per WCAG 1.4.4 Resize Text) without clipping or overlapping critical content.
- **FR-024**: Animations MUST respect `prefers-reduced-motion` by reducing or removing non-essential motion.
- **FR-025**: State (status, day-off, read-only, error, etc.) MUST NOT be communicated by color alone; an icon, label, or pattern MUST accompany color coding.

**States**

- **FR-026**: Every in-scope screen MUST define and implement, using shared components, its loading, empty (where applicable), error, disabled (where applicable), and success states.
- **FR-027**: Screens/actions where a conflict is possible (recurring plan publish, concurrent schedule edits) MUST define and implement a conflict state that surfaces the conflict rather than silently overwriting data.
- **FR-028**: The PWA/Capacitor offline experience MUST show a clear offline indicator and disable (with explanation) actions that require connectivity, while still displaying previously cached content where the current app already supports offline caching.

**Preservation & regression**

- **FR-029**: Every screen or flow touched by this redesign MUST have its pre-existing critical behavior verified (automated test and/or manual check against a dedicated test account) both before the screen is changed (baseline) and after (regression check).
- **FR-030**: Started and completed workout occurrences MUST render as locked/non-destructively-replaceable in the redesigned UI, consistent with existing business rules.
- **FR-031**: Local verification of this feature MUST use `http://localhost:8080` and MUST NOT use `http://127.0.0.1:8080`.

### Key Entities

- **Workout Occurrence**: A single scheduled instance of a workout on a specific date for a client, in one of the states: scheduled, customized, rescheduled, day-off, in-progress, completed. Its origin is either the client's personal plan or a trainer's recurring/one-off prescription. Once started or completed, it is immutable with respect to destructive replacement.
- **Recurring Plan**: A trainer-authored, repeating workout prescription assigned to a client, which generates future scheduled occurrences. Publishing a replacement affects only eligible future occurrences.
- **Personal Plan**: A client-authored workout plan used only when no active coach-assigned plan exists.
- **Coaching Relationship**: The link between one trainer and one client, including its configured time zone, lifecycle state (invited, active, ended), and whether an active coach plan currently governs the client's schedule.
- **Design Token Set**: The shared set of color, typography, spacing, radius, elevation, and motion values that both client and trainer surfaces draw from after this redesign.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: 100% of the client and trainer screens listed in FR-001 render using the shared design token/component system at all four required viewports (360×800, 390×844, 768×1024, 1440×900) with no unintended horizontal overflow.
- **SC-002**: Every acceptance scenario in User Stories 1 and 2 (client and trainer core loops) passes against a test account both before and after the redesign, with zero regressions in plan-authority enforcement (coach-plan read-only, personal-plan editability) or in the nine distinct trainer plan-management actions.
- **SC-003**: 100% of pre-existing automated tests covering coaching, workout, and personal-plan flows continue to pass after the redesign; new/updated tests exist for any UI behavior introduced or materially changed by this feature.
- **SC-004**: A person can complete the primary path — client starts and logs a workout; trainer reviews a client and publishes a plan update — using only keyboard navigation, with a visible focus indicator at every step.
- **SC-005**: Visual comparison of each migrated screen against its corresponding reference in the approved Claude Design export and current-state screenshots shows no unresolved layout break (overlap, clipped text, missing control) at any required viewport.
- **SC-006**: Zero instances, across all migrated screens, of a started or completed workout occurrence being altered or removed by a redesign-introduced interaction.
- **SC-007**: A production build of the frontend completes successfully after the redesign with no new build errors or warnings introduced by this feature.

## Out of Scope

- Any change to API contracts, database schema/migrations, or backend business logic, unless a specific change is proven necessary in the plan and explicitly approved by the user.
- Introducing Tailwind, a component library, or replacing the current custom-CSS approach, unless proven necessary and approved.
- Redesigning or altering the AI Coach feature's backend/prompt behavior (`api/coach/*`) beyond any shared UI chrome it renders through.
- New product features not present in the current application or the approved design export (the export is a visual direction for existing screens, not a new-feature brief).
- Native mobile shell changes beyond what's needed to host the redesigned web views (Capacitor config/asset changes only where required for the new visual system, e.g., icons/splash consistent with the new brand marks already reflected in the dirty worktree's `frontend/android` and `frontend/ios` changes).
- Committing, pushing, or altering git history; this feature's changes are implemented in the working tree per existing repository workflow.
- Content/copy rewrites beyond what's needed to fit the new layout (no scope to rewrite microcopy tone/voice unless required for an empty/error state that doesn't currently exist).
- The general platform admin panel (`frontend/src/views/Admin.jsx`, routed at `/admin`), which is distinct from the AI Coach admin-management screen (`AdminCoach.jsx`) confirmed in scope during clarification. `Admin.jsx` was not part of the original design brief or manifest and was not raised during clarification; it remains unstyled by this feature.

## Assumptions

- The single file under `design/claude-export/` ("Transforma Blackprint Green") represents the already-approved visual direction (the design guide's "compare three directions, pick one" step has already concluded); no further direction selection is needed from the user before planning.
- The Claude Design export is a bundled interactive prototype (React bundle inside a static HTML shell), not literal markup to copy; exact token values (colors, spacing, radii) will be confirmed by opening/inspecting it in a browser during the planning/design-token phase, using the palette already identified (green `#3ecb8e`/`#0a6b43` on dark `#201e1d`/`#2d2b2b`, off-white `#f3f2f2`/`#f8f4f4`, semantic red/error scale) as the starting reference.
- The design export currently shows only the client-side mobile direction; trainer and desktop-web treatments will be derived by extending its tokens/components per the design guide's rules (denser grids, persistent nav, side-by-side editing) rather than a matching trainer export existing yet. If trainer-specific mockups are later provided, they take precedence.
- "Existing SVG/icon conventions" means the current custom stroke-based icon set in `frontend/src/components/Icon.jsx`; new icons required by the redesign will be added to that same set rather than a new icon system.
- The current uncommitted worktree changes (frontend views, coaching store, API coaching modules, migrations, e2e tests, etc.) are unrelated in-progress work from the `001-trainer-client-coaching` feature and must be preserved; this feature builds on top of that working tree rather than reverting or ignoring it, and is implemented on the same branch per the clarified git-branch decision.
- "Offline behavior" scope is limited to preserving and correctly styling whatever offline/caching behavior already exists in the PWA/Capacitor setup (`frontend/public/sw.js`), not introducing new offline capability.
