# Tasks: Responsive UI Redesign (Transforma "Blackprint Green")

**Input**: Design documents from `/specs/002-responsive-ui-redesign/` (spec.md, plan.md, research.md, data-model.md, contracts/ui-component-contract.md, quickstart.md)

**Tests**: Included — the constitution (Principle VII) requires tests/build/viewport verification every phase, so verification tasks are mandatory, not optional, for this feature.

**Organization**: Grouped by user story (spec.md priorities). Four components — `ClientWorkspace.jsx`, `WeeklyCheckIn.jsx`, `Progress.jsx`, `Fees.jsx` — are genuinely shared between a client `mode` and a trainer `mode` (confirmed in `App.jsx`'s route table). Each is restyled **once**, in the story where it's most load-bearing; the story using its other `mode` gets a verification-only task with an explicit dependency, never a duplicate restyle (a real same-file constraint, not a modeling choice).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no unfinished-task dependency)
- **[Story]**: US1–US6 per spec.md; Setup/Foundational/Polish tasks carry no story label

## Path Conventions

Existing repo layout (Express API + React SPA), unchanged by this feature: `api/` (untouched), `frontend/src/` (target of nearly all tasks), `e2e/` (screenshot/flow scripts), `design/` (reference + output for screenshots).

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Establish a pre-redesign baseline so every later phase has something concrete to regress against.

- [X] T001 Run `cd frontend && npm run test` and `cd api && npm test` and record current pass/fail counts as the baseline for SC-003.
- [X] T002 [P] Run `cd frontend && npm run build` to confirm the current production build succeeds (baseline for SC-007).
- [X] T003 [P] Extend `e2e/capture-design-screens.mjs` to add 360×800 and 768×1024 viewport passes (new `makePage` variants) alongside the existing 390×844 mobile and 1440×900 desktop passes, writing viewport-suffixed filenames so all four required viewports (constitution Principle II) can be captured without overwriting each other.
- [X] T004 Run the extended `e2e/capture-design-screens.mjs` against the current (pre-redesign) UI at `http://localhost:8080` to produce a full four-viewport baseline set under `design/ui-audit/current-mobile/{client,trainer}/` and `design/ui-audit/current-web/`.
- [X] T005 [P] Open `design/claude-export/Transforma Blackprint Green (1).html` in a browser and record exact token values (colors, spacing, radii, type scale) as an addendum note in `specs/002-responsive-ui-redesign/research.md` §1, confirming/refining the palette already identified via static scan.
- [X] T006 Confirm the existing coaching test fixtures (`api/test/coaching-helpers.mjs` scenarios: active-coach-plan client, no-coach-plan client, trainer-with-clients) run successfully via the coaching test suite, and record the account identifiers used by `e2e/capture-design-screens.mjs` (`test_1`, `relationshipId`) for reuse in manual verification steps.

**Checkpoint**: Baseline tests, build, and four-viewport screenshots exist. Nothing in `frontend/src` has changed yet.

---

## Phase 2: Foundational (Design Tokens + Shared Primitives) — BLOCKS all user stories

**Purpose**: Build the one shared token layer and shared component set every screen group will consume. No screen-level task in Phases 3–8 may start before this phase's checkpoint.

- [X] T007 Extend the `:root` token block in `frontend/src/index.css` with "Blackprint Green" values (surface/label/separator/accent ramps) per `data-model.md` §Design Token Set, keeping every existing token **name** unchanged.
- [X] T008 Extend the `:root[data-theme='light']` override block in `frontend/src/index.css` with corresponding light-theme values consistent with the new palette (same file as T007 — sequential, not parallel).
- [X] T009 Validate WCAG AA contrast for `--label` on `--bg`/`--surface` and `--on-acc` on `--acc` in both theme blocks (`data-model.md` validation rule, FR-022); adjust values in `frontend/src/index.css` if any pair fails (same file as T007/T008 — sequential).
- [X] T010 [US-shared] Add `disabled`/`disabledReason` prop support to `Row` and restyle `Button`, `Row`, `Section`, `TextField`, `TextArea`, `SearchField`, `NumberField`, `Switch`, `Segmented`, `Stepper`, `Slider`, `Check`, `SelectRow` in `frontend/src/components/ui.jsx` onto the new tokens, per `contracts/ui-component-contract.md` §2 (existing props unchanged).
- [X] T011 Add `StatusBadge({ status, label })` to `frontend/src/components/ui.jsx` (same file as T010 — sequential), rendering every occurrence/plan status in `data-model.md`'s Key Entities with both an icon/shape and color (FR-025).
- [X] T012 Add `EmptyState`, `Skeleton`/`SkeletonRow`, `ConflictBanner`, and `OfflineBanner` to `frontend/src/components/ui.jsx` (same file as T010/T011 — sequential) per `contracts/ui-component-contract.md` §2; wire `ConflictBanner` to the existing `expectedVersion()` optimistic-concurrency rejection surfaced through `frontend/src/lib/coaching/api.js`, and `OfflineBanner` to the existing `frontend/public/sw.js` cache/online state.
- [X] T013 [P] Extend `frontend/src/components/Icon.jsx` with any new stroke icons the export requires (status/badge glyphs), following the existing `--icon-stroke` convention — different file from T010–T012, safe to run in parallel.
- [X] T014 [P] Migrate `frontend/src/components/coaching/coaching.css` off its hardcoded colors (`#eef4ea`, `#203a29`, `#68756c`, local `--coach-*` literals, etc.) onto the shared tokens per `contracts/ui-component-contract.md` §1 (nav, header, stat-grid, panel, client-list, join-card rules).
- [X] T015 [P] Migrate `frontend/src/components/coaching/editor.css` onto shared tokens (template-bar, exercise grid, occurrence-summary/controls rules) — different file from T014, safe to run in parallel.
- [X] T016 [P] Migrate `frontend/src/components/coaching/checkin.css` onto shared tokens (adherence grid, response/report panels, weight list) — different file, parallel-safe.
- [X] T017 [P] Migrate `frontend/src/components/coaching/diet.css` onto shared tokens (editor, diet-item, food rows) — different file, parallel-safe.
- [X] T018 [P] Migrate `frontend/src/components/coaching/fees.css` onto shared tokens, replacing the local `.coaching-status` color rules with the new `StatusBadge` component's styling contract (T011) — different file, parallel-safe.
- [X] T019 Add explicit 768px and 1440px breakpoint rules to `frontend/src/index.css` and the five migrated coaching CSS files (T014–T018) wherever a mobile-only rule (e.g. `coaching.css`'s `max-width:760px` nav collapse) currently has no tablet/desktop counterpart (research.md §4).
- [X] T020 Run `cd frontend && npm run test` and `cd frontend && npm run build`; confirm no regression introduced by the foundation phase before any screen task begins.

**Checkpoint**: Shared tokens and shared components exist and build clean. User story phases may now begin.

---

## Phase 3: User Story 1 - Client core loop (Priority: P1) 🎯 MVP

**Goal**: Home, coach-assigned/personal Plan, and Start/Active Workout render the new visual system with plan-authority rules intact (spec.md User Story 1).

**Independent Test**: Per spec.md — verify with an active-coach-plan client and a no-coach-plan client that Home/Plan/Workout render correctly at all four viewports and enforce read-only vs. editable plan state.

- [X] T021 [P] [US1] Restyle `frontend/src/views/Home.jsx` onto the new tokens/components, preserving all existing personal-home data bindings.
- [X] T022 [P] [US1] Restyle `frontend/src/views/coaching/ClientHome.jsx` onto the new tokens/components, preserving `hasActiveCoachPlan()`-driven status/read-only logic unchanged.
- [X] T023 [P] [US1] Restyle `frontend/src/views/Plan.jsx` onto the new tokens/components: the coach-assigned path must use `StatusBadge`/a read-only banner (FR-007) and hide personal-plan controls (FR-008); the no-coach-plan path must keep full create/edit/track behavior (FR-009).
- [X] T024 [P] [US1] Restyle `frontend/src/views/RoutineEdit.jsx` onto the new tokens/components (personal-plan editor; still reachable only when `!coachPlanActive` per the existing `App.jsx` routing guard — guard itself unchanged).
- [X] T025 [P] [US1] Restyle `frontend/src/views/Workout.jsx` (Start/Active Workout) onto the new tokens/components, preserving occurrence-resolution and set-logging behavior (FR-010); the view itself must render a started/in-progress or completed occurrence as locked against destructive replacement (FR-030), not only the schedule/publish flow; force `data-theme="dark"` while a session is live regardless of the client's saved appearance preference (per the approved export's own stated rule — gym-lighting legibility), reverting to the client's chosen theme on leaving the screen.
- [X] T026 [US1] Apply `EmptyState`/`Skeleton`/`StatusBadge` (T011/T012) to Home/ClientHome/Plan/Workout loading and empty states (FR-026); depends on T021–T025.
- [X] T027 [US1] Verify at 360×800, 390×844, 768×1024, 1440×900 via `e2e/capture-design-screens.mjs` that Home/ClientHome/Plan/Workout have no horizontal overflow and meet 44×44 touch targets (FR-014/017/018); additionally verify at 360×800/390×844 with the on-screen keyboard open during set-logging on Workout that the log/finish action remains reachable (FR-019).
- [X] T028 [US1] Manually verify plan-authority enforcement and coaching-time-zone-correct occurrence resolution (quickstart.md §3 steps 1–3) using the fixtures confirmed in T006.
- [X] T029 [US1] Run `cd frontend && npm run test` and `cd frontend && npm run build`; extend vitest coverage for Home/Plan/Workout rendering and coach-plan-active branching if not already covered; confirm no regressions (SC-003, SC-007).

**Checkpoint**: US1 fully functional and independently testable/demoable.

---

## Phase 4: User Story 2 - Trainer core loop (Priority: P1)

**Goal**: Client Overview, Client Workspace, Workout Plan Editor (templates, recurring editor, schedule manager) render the new visual system with all nine plan-management actions kept distinct (spec.md User Story 2).

**Independent Test**: Per spec.md — verify with a trainer test account that Client Overview/Workspace/Plan Editor render correctly and that publishing a replacement recurring plan updates only eligible future occurrences.

- [X] T030 [P] [US2] Restyle `frontend/src/views/coaching/TrainerHome.jsx` (Client Overview) onto new tokens/components — denser grid at 1440×900 per FR-015/016.
- [X] T031 [P] [US2] Restyle `frontend/src/components/coaching/CoachingShell.jsx` (shared coaching chrome) onto new tokens/components, adding persistent contextual nav at tablet/desktop per FR-015.
- [X] T032 [US2] Restyle `frontend/src/views/coaching/ClientWorkspace.jsx` onto new tokens/components for **both** `mode="trainer"` and `mode="client"` rendering paths (top + schedule sections) — single file, restyled once here since it's first load-bearing in this P1 story; Phase 5 (US3) only verifies the client-mode result, per the note in this file's header.
- [X] T033 [P] [US2] Restyle `frontend/src/views/coaching/WorkoutPlans.jsx` onto new tokens/components (starter/saved/recent template-source selection, per `plan-sources.js`) — different file from T030–T032, parallel-safe.
- [X] T034 [US2] Restyle `frontend/src/components/coaching/WorkoutPlanEditor.jsx` recurring-plan-editor surfaces (sources, training days) onto new tokens/components, keeping the nine distinct actions (FR-011) visually distinct via `StatusBadge`/`Button` variants; depends on T010–T012 (Foundational).
- [X] T035 [US2] Restyle `frontend/src/components/coaching/WorkoutPlanEditor.jsx` schedule-manager surfaces (day off, reschedule, edit-one-occurrence, restore) onto new tokens/components, adding an explicit confirmation step before each destructive/plan-replacing action applies (FR-013) — same file as T034, sequential.
- [X] T036 [US2] Verify (quickstart.md §3 step 4) that publishing a replacement recurring plan preserves a deliberately started/completed test occurrence (FR-012/SC-006), using the fixtures from T006; depends on T034/T035.
- [X] T037 [US2] Verify at all four required viewports that trainer screens use tablet/desktop space for persistent nav and side-by-side editing rather than a stretched mobile layout (FR-016); depends on T030–T035.
- [X] T038 [US2] Run `cd frontend && npm run test`, `cd api && npm test`, and `cd frontend && npm run build`; extend coverage for plan-publish and schedule-manager actions; confirm no regressions (SC-003, SC-007).

**Checkpoint**: US1 + US2 (both P1 core loops) functional together.

---

## Phase 5: User Story 3 - Remaining client screens (Priority: P2)

**Goal**: Exercise library/details, personal stats, coaching overview/workspace (client mode), weekly check-in, progress, fees, and settings adopt the unified system (spec.md User Story 3).

**Independent Test**: Per spec.md — for each listed screen, confirm shared tokens/components render, pre-existing actions still work, and all four viewports render without overflow.

- [X] T039 [P] [US3] Restyle `frontend/src/views/Library.jsx` (exercise library + detail sheet) onto new tokens/components.
- [X] T040 [P] [US3] Restyle `frontend/src/views/Stats.jsx` (personal stats top/lower) onto new tokens/components, preserving `BodyMap.jsx`/`Heatmap.jsx`/`LineChart.jsx` integrations.
- [X] T041 [US3] Restyle `frontend/src/views/coaching/WeeklyCheckIn.jsx` onto new tokens/components for **both** `mode="client"` and `mode="trainer"` rendering paths, preserving submission/validation behavior — restyled once here (client-primary flow); Phase 6 (US4) verifies the trainer-mode result only. Depends on Phase 2 completion.
- [X] T042 [US3] Restyle `frontend/src/views/coaching/Progress.jsx` onto new tokens/components for **both** modes — restyled once here; Phase 6 (US4) verifies trainer-mode only.
- [X] T043 [US3] Restyle `frontend/src/views/coaching/Fees.jsx` onto new tokens/components for **both** modes — restyled once here; Phase 6 (US4) verifies trainer-mode only.
- [X] T044 [P] [US3] Restyle `frontend/src/views/Settings.jsx` onto new tokens/components, preserving preference-persistence behavior.
- [X] T045 [US3] Verify `frontend/src/views/coaching/ClientWorkspace.jsx`'s `mode="client"` rendering (restyled in T032/Phase 4) meets US3's acceptance scenario 3; fix client-mode-only gaps in that same file if found, without redoing the trainer-mode work.
- [X] T046 [US3] Apply `EmptyState`/`Skeleton` to Library/Stats/WeeklyCheckIn/Progress/Fees/Settings loading and empty states (FR-026); depends on T039–T044.
- [X] T047 [US3] Verify at all four required viewports via `e2e/capture-design-screens.mjs` that this group's screens have no horizontal overflow and meet touch-target requirements (FR-014/017/018); additionally verify at 360×800/390×844 with the on-screen keyboard open during Weekly Check-in submission that the submit action remains reachable (FR-019).
- [X] T048 [US3] Run `cd frontend && npm run test` and `cd frontend && npm run build`; extend vitest coverage for touched screens; confirm no regressions (SC-003, SC-007).

**Checkpoint**: US1–US3 functional together; client experience fully migrated.

---

## Phase 6: User Story 4 - Remaining trainer screens (Priority: P2)

**Goal**: Invitations, studio settings, diet assignment, check-in review, progress review, and fee management adopt the unified system (spec.md User Story 4).

**Independent Test**: Per spec.md — for each listed screen, confirm shared tokens/components render and pre-existing actions still work.

**Dependency note**: This phase's T051/T052/T053 depend on Phase 5's T041/T042/T043 (`WeeklyCheckIn.jsx`, `Progress.jsx`, `Fees.jsx` are shared files already restyled there) — schedule Phase 5 before or alongside Phase 6, not fully independently, since both are P2 but share these three files.

- [X] T049 [P] [US4] Restyle `frontend/src/views/coaching/Invitations.jsx` onto new tokens/components, preserving send/revoke/resend behavior with an explicit confirmation step before revoke applies (FR-013), and pending/accepted/expired status via `StatusBadge`.
- [X] T050 [P] [US4] Restyle `frontend/src/views/coaching/TrainerSettings.jsx` (Studio Settings) onto new tokens/components, preserving setting-persistence behavior.
- [X] T051 [P] [US4] Restyle `frontend/src/views/coaching/DietPlans.jsx` and `frontend/src/components/coaching/DietPlanEditor.jsx` onto new tokens/components, preserving diet-assignment behavior.
- [X] T052 [P] [US4] Restyle `frontend/src/components/coaching/CheckInResponse.jsx` (Check-in Review) onto new tokens/components — depends on Phase 5 T041 (`WeeklyCheckIn.jsx`) being restyled first if this component renders inside it.
- [X] T053 [US4] Verify `frontend/src/views/coaching/Progress.jsx`'s `mode="trainer"` rendering (restyled in Phase 5 T042) meets US4's acceptance scenario 5 (Client Progress review); fix trainer-mode-only gaps in that same file if found.
- [X] T054 [US4] Verify `frontend/src/views/coaching/Fees.jsx`'s `mode="trainer"` rendering (restyled in Phase 5 T043) meets US4's acceptance scenario 6 (Fee Management); fix trainer-mode-only gaps in that same file if found.
- [X] T055 [US4] Apply `EmptyState`/`Skeleton`/`StatusBadge` to Invitations/TrainerSettings/DietPlans/CheckInResponse loading and empty states (FR-026); depends on T049–T052.
- [X] T056 [US4] Verify at all four required viewports that this group's screens have no horizontal overflow and meet touch-target requirements (FR-014/017/018).
- [X] T057 [US4] Run `cd frontend && npm run test`, `cd api && npm test`, and `cd frontend && npm run build`; extend coverage for touched trainer screens; confirm no regressions (SC-003, SC-007).

**Checkpoint**: US1–US4 functional together; trainer experience fully migrated.

---

## Phase 7: User Story 5 - System-wide states & accessibility (Priority: P3)

**Goal**: Loading, empty, error, disabled, success, offline, and conflict states are consistent, and every migrated screen meets the accessibility bar (spec.md User Story 5).

**Independent Test**: Per spec.md — trigger each state via test fixtures on a sample client and trainer screen; run keyboard-only navigation and contrast checks across every migrated screen.

- [X] T058 [US5] Sweep every screen touched in Phases 3–6 for consistent Loading/Empty/Error/Disabled treatment via `Skeleton`/`EmptyState`/`Row`'s `disabled` prop; fix any screen not yet using the shared components (FR-026).
- [X] T059 [US5] Wire `ConflictBanner` (T012) onto every recurring-plan-publish and concurrent-schedule-edit surface in `frontend/src/components/coaching/WorkoutPlanEditor.jsx` per FR-027.
- [X] T060 [US5] Wire `OfflineBanner` (T012) into the app shell (`frontend/src/App.jsx`'s `Shell` component) reflecting existing `frontend/public/sw.js` cache/online state per FR-028.
- [X] T061 [US5] Keyboard-navigation pass across every screen touched in Phases 3–6, **including an explicit end-to-end keyboard-only walk of the SC-004 primary path** (client starts and logs a workout; trainer reviews a client and publishes a plan update): confirm logical tab order and a visible focus state at every step (FR-020/021, SC-004); add missing `:focus-visible` styling to `frontend/src/index.css` or the relevant component CSS.
- [X] T062 [US5] Contrast pass: verify WCAG AA for every new token pair across both themes (FR-022); adjust values in `frontend/src/index.css` if any fail.
- [X] T063 [US5] Text-scaling pass: verify up to 200% browser zoom (FR-023, per WCAG 1.4.4) across all touched screens; fix any clipping/overlap found.
- [X] T064 [US5] Reduced-motion pass: confirm the existing `@media (prefers-reduced-motion: reduce)` rule (`frontend/src/index.css` line 139) covers every new animation introduced by restyled components (FR-024).
- [X] T065 [US5] Color-independence pass: confirm every `StatusBadge` and status indicator pairs color with an icon or label, not color alone (FR-025); fix any bare-color usage found.
- [X] T066 [US5] Run `cd frontend && npm run test`, `cd api && npm test`, and `cd frontend && npm run build`; confirm the states/accessibility fixes in T058–T065 introduce no regressions (SC-003, SC-007) — this phase edits files across Phases 3–6's screens, so it requires its own verification pass per constitution Principle VII, not just a visual sweep.

**Checkpoint**: All states/accessibility requirements verified across the full migrated surface.

---

## Phase 8: User Story 6 - Login, AI Coach, and admin coach management (Priority: P3)

**Goal**: Login/passkey, AI Coach chat, Coach onboarding, and admin coach-management screens adopt the unified system (spec.md User Story 6, confirmed in scope during clarification).

**Independent Test**: Per spec.md — verify Login/Coach/AdminCoach render with shared tokens/components at all four viewports, and that passkey sign-in and AI Coach messaging behave unchanged.

- [X] T067 [P] [US6] Restyle `frontend/src/views/Login.jsx` onto new tokens/components, preserving passkey sign-in success/error/cancel behavior exactly.
- [X] T068 [P] [US6] Restyle `frontend/src/views/Coach.jsx` (AI Coach chat) onto new tokens/components, preserving message send/stream/response behavior; `api/coach/*` backend untouched.
- [X] T069 [P] [US6] Restyle `frontend/src/views/CoachIntake.jsx` and `frontend/src/views/CoachProposal.jsx` onto new tokens/components (Coach onboarding flow, gated by `coachPlanActive` in `App.jsx` — guard unchanged).
- [X] T070 [P] [US6] Restyle `frontend/src/views/AdminCoach.jsx` onto new tokens/components, preserving all existing AI Coach configuration behavior.
- [X] T071 [US6] Verify at all four required viewports plus the Phase 7 accessibility checks (keyboard/contrast/motion/text-scaling) for Login/Coach/CoachIntake/CoachProposal/AdminCoach; depends on T067–T070.
- [X] T072 [US6] Run `cd frontend && npm run test` and `cd frontend && npm run build`; extend coverage for Login/Coach/AdminCoach; confirm no regressions (SC-003, SC-007).

**Checkpoint**: All 33 in-scope screens (spec.md FR-001) are migrated.

---

## Final Phase: Polish & Cross-Cutting Verification

**Purpose**: Whole-system checks that only make sense once every screen group is done.

- [X] T073 [P] Update `frontend/android` and `frontend/ios` app icon/splash assets and `frontend/public/manifest.json`/`frontend/index.html` `theme-color` to match the new palette (asset-only — no native code change).
- [X] T074 Run the full `e2e/` flow scripts (`01-register.mjs`, `02-invite.mjs`, `03-workouts.mjs`) against the redesigned UI at `http://localhost:8080` to confirm no regression in registration, invitation, and workout flows (constitution Principle VI).
- [X] T075 Run the extended `e2e/capture-design-screens.mjs` one final time at all four viewports; compare the full output against `design/claude-export/Transforma Blackprint Green (1).html` and the Phase 1 (T004) baseline; log any unresolved visual difference.
- [X] T076 Run `cd frontend && npm run build` for a final production-build verification (SC-007).
- [X] T077 Run the full `frontend` vitest and `api` test suites one final time; confirm 100% of pre-existing tests pass (SC-003).
- [X] T078 Re-walk every acceptance scenario in spec.md's User Stories 1–6 end-to-end against the fully migrated app (SC-002).
- [X] T079 Run `graphify update .` to refresh `graphify-out/` for the redesigned component tree — never hand-edit `graphify-out/` directly (constitution Quality Gates & Workflow).
- [X] T080 Mark all completed tasks in this file (`specs/002-responsive-ui-redesign/tasks.md`) and record final `/speckit.converge` readiness.

---

## Phase 9: Convergence

Findings from the 2026-09-20 convergence assessment (31/31 FRs, 7/7 SCs, all 6 user stories' acceptance scenarios, 10/10 constitution principles checked):

- [X] T081 Add `role="status"` to the save-status `<span>{status}</span>` in `frontend/src/components/coaching/CheckInResponse.jsx` per FR-020/026 (partial, LOW) — the four equivalent status indicators in `WorkoutPlans.jsx`/`WeeklyCheckIn.jsx`/`DietPlans.jsx` all already have it; this one doesn't, so a screen-reader user isn't told the save succeeded. Fixed.
- [X] T082 Perform one literal keyboard-only pass (Tab/Enter, no mouse) of the trainer's primary path — Client Overview → Client Workspace → Workout Plan Editor → the publish confirmation dialog — per SC-004 (partial, LOW). Done: reached "Publish to client" after 181 Tab presses through a real multi-day plan editor with zero non-visible focus outlines along the way (strong FR-021 confirmation) — but this walk is what surfaced T083 below.
- [X] T083 **HIGH** — Fix keyboard focus management in `frontend/src/components/Modals.jsx` per FR-020 (missing, pre-existing, not introduced by this feature): opening any sheet or centered dialog (`openSheet`/`confirmSheet` — used by dozens of call sites across the whole app, not just the redesigned screens) does not move focus into the dialog, trap it there, or restore it on close, and the dialog container has no `role="dialog"`/`aria-modal`. Confirmed live: after triggering the "Publish this plan to the client?" confirmation, focus stayed on the trigger button behind it; Tabbing from there continues through the underlying page's form fields, never reaching the dialog's own "Cancel"/"Publish" buttons — a keyboard-only user cannot operate any confirmation dialog in the app at all. Fixed as its own dedicated pass: `Sheet` now captures `document.activeElement` on mount and restores it on unmount; the topmost sheet (stack-aware via an `isTop` prop, since sheets can nest) moves focus to its first focusable element on open, traps Tab/Shift+Tab within it, and closes on Escape (the keyboard equivalent of the existing backdrop-click dismissal, respecting `sheet.locked`); both the bottom-sheet and centered-dialog containers now carry `role="dialog"`/`aria-modal="true"`/`tabIndex={-1}` so a dialog with no focusable children is still a valid fallback focus target (the existing global `:focus-visible` ring covers it). Verified live via Playwright against the real "Sign out?" and plan-publish confirmations: role/aria-modal present, focus lands on the dialog's own button on open, Tab and Shift+Tab both stay trapped across a full lap, Escape closes and returns focus to the trigger, and the full `03-workouts.mjs` regression suite (25 checks, including the mouse-driven publish-confirmation flow) still passes unchanged.

---

## Phase 10: 2a Blackprint Green Alignment

The client shared a revised design export, `design/claude-export/Transforma 2a Blackprint Green.dc.html` ("2a"), which turned out to differ from the `(1)` export Phases 1–9 were built against in more than color: 2a composes every screen from solid-fill blocks that touch edge-to-edge with a 2px gap standing in for the rule between them (not separately-margined cards), uses pervasive small bold uppercase tracked "eyebrow" labels, a "brand + on-device badge" header row, and a flat tab bar with a top-border active indicator instead of a raised circular button. Implemented directly (not through a new spec-kit cycle, per explicit direction), screen by screen, each verified against the export's literal values before moving to the next:

- [X] T084 Foundational primitives: `.eyebrow`/`.eyebrow-trainer`, `.rule2`, `.appbar`/`ScreenHeader` (brand + "on device" badge + rule + title/subtitle), `.bgrid`/`.bcell`/`.blocklist` (the abutting-block grid), `.trainer-block`/`.trainer-cta` (full-bleed fill reserved for trainer-authored content and the primary action), `.seg-block` (abutting segmented control), and a flat `#tabbar` (no circular FAB; active tab gets a `border-top` in the client's own personal accent, deliberately not the design's hardcoded green, to preserve the existing 8-accent personalization feature). `frontend/src/index.css`, `frontend/src/components/ui.jsx`, `frontend/src/components/TabBar.jsx`, `frontend/src/components/Icon.jsx` (`shieldCheck`, `arrowRight`).
- [X] T085 Home — day strip reads each day's plan as a short word (`.daylabel`) instead of a colored dot; trainer-assigned days get the full-bleed `.trainer-block`, personal days a plain `.bcell` with the primary action carrying the accent; streak/workouts split into a two-tile `.bgrid`. `frontend/src/views/Home.jsx`.
- [X] T086 Plan — coach-assigned plan card, per-day exercise `.blocklist` with a `--label`-colored divider rule under each day header, and a rest-time/next-day footer note per day (rest time only stated when every exercise in the day actually agrees on one value, to avoid stating a wrong number). `frontend/src/views/Plan.jsx`.
- [X] T087 Workout — reskin only, by explicit decision (see below): eyebrow-styled session header + `.rule2`, zero-radius steppers; the all-sets-editable-table interaction (supersets, per-set RIR/RPE, timed holds) is unchanged. `frontend/src/views/Workout.jsx`.
- [X] T088 Stats — tiles and every card converted to `.bgrid`/`.bcell` with eyebrow labels; `Segmented` (shared component) rebuilt from an iOS-style sliding-pill control to the flat abutting-block style, which cascades correctly to its other call sites (Settings, CoachIntake, sheets.jsx). `frontend/src/views/Stats.jsx`, `frontend/src/components/ui.jsx`.
- [X] T089 Library — `.blocklist` exercise rows; `.chip`/`.chip.on` (body-part/equipment filters) changed from a rounded pill with accent-colored selection to a square with inverted white/black selection, matching the same selection language as `.seg-block` and the day strip's "today" cell. `frontend/src/views/Library.jsx`, `frontend/src/index.css`.
- [X] T090 Settings — back-nav eyebrow header (this screen is reached by back-navigation, not a tab, so it deliberately does not get the brand/on-device `ScreenHeader`); `.sect-t` section labels (also used by `Coach.jsx`, unconverted but unaffected in structure) switched to the uppercase eyebrow style; accent-color swatches squared off. `frontend/src/views/Settings.jsx`, `frontend/src/index.css`.
- [X] T091 Post-workout summary sheet (`FinishSummary` in `frontend/src/sheets.jsx`) — stat tiles (Duration/Volume/Sets/PRs) converted to `.bgrid`/`.bcell`; the rest of the dialog (trophy icon, title, body map, session rating) left as-is (see below).
- [X] T092 Swept and fixed pre-existing zero-radius violations surfaced along the way (predate this phase, not introduced by it): `.tag`, `.chip`, `.wday` circular indicator kept but its rectangular cell part, `.btn.xs`, `.wprog`, `.stp`, `.lrow-i`, `#toast`, `#timer .bar` all changed from a hardcoded px/pill radius to `var(--r-sm)` or removed.

**Deliberately not done in this phase** — real product/scope decisions, not restyle work, each needing its own explicit go-ahead before implementing:

- [ ] T093 **Workout screen's interaction model.** 2a's "Active workout" mockup shows a single-set-at-a-time flow (`SET 3/4`, a big Weight/Reps editor for just the current set, a "Log set 3 → then rest 90s" button that advances). The current app shows every set in an editable table at once (needed for supersets, per-set RIR/RPE, timed-hold starts, editing out of order). Explicit decision this session: keep the table, reskin only (T087). Revisit only as its own design/product decision — this is a real behavior change, not a visual one, and the single-set mockup doesn't obviously accommodate supersets or the effort column as they exist today.
- [ ] T094 **Two screens the design shows that don't exist in the app.** (a) A dedicated "Body weight" screen (LATEST/GOAL tiles, an 8-week trend bar chart, an entries list, a "Log today's weight" CTA) — today body weight is an inline Home/Stats panel plus a log sheet, not its own route. (b) A full-screen post-workout "Session complete" recap (a green `SESSION COMPLETE` header, Volume/Sets/PRs tiles, a "What you logged" list, explicit "Save session"/"Discard" buttons) — today `FinishSummary` is a modal that appears *after* the workout is already auto-saved, with no discard step. Building either is new screens/data-flow, not a reskin.
- [ ] T095 **Settings features the design mockup invents.** A 3-way "INK / PAPER / SYSTEM" theme picker (app currently has Dark/Light only, no OS-auto-detect mode) and a "Privacy" section with coaching-style data-sharing toggles ("Share summaries with coach", "Share body weight") that don't correspond to any real setting in this app's actual privacy model (that model is local-first-by-default plus opt-in AI Coach consent, not a per-field coach-sharing panel). Neither was built — both are new functionality.
- [ ] T096 **Everything outside this design capture.** The coaching/trainer-side screens (`TrainerHome`, `ClientHome`, `ClientWorkspace`, `WorkoutPlans`, `DietPlans`, `Invitations`, `Fees`, `Progress`, `WeeklyCheckIn`, `CheckInResponse`, `TrainerSettings`) were restyled to the original `(1)` design during Phases 3–8 but not re-aligned to 2a's specific blockprint/eyebrow composition — same gap for `Login`, `Coach`/`CoachProposal`/`CoachIntake`, and `Admin`/`AdminCoach`. None of these appear in the 2a export, so there's no literal spec to build against yet; a future pass would need either a matching design capture or a judgment call extending the same visual language by analogy (as T085–T091 already did for the personal-tracker side).
- [ ] T097 **Remaining hardcoded-radius components**, found but out of scope for this phase because none appear with a direct precedent in the 2a export: `.iconbtn` (circular icon buttons), `.thumb` (exercise thumbnails), `.searchf`/`.search .input` (search fields), `.sw` (the on/off switch), `.timef` (time input), `.sld-track`/`.sld-fill`/slider thumb, `.exmedia .gifhint`/`.giftoggle`, `.ctip` (tooltip), `.mchip`, `.glyph-cell` (glyph picker), `.cal-d`/`.cal-h` (calendar), and `CoachIntake.jsx`'s own day-picker (a separate `.wday` from Home's `.daycell`). Some (switch knobs, avatars, the "today" dot) are probably intentional circles even in a zero-radius system; each needs a real look rather than a blanket zero.
- [ ] T098 **Minor design-fidelity nits** flagged as non-blocking by verification passes: a couple of `.eyebrow` instances land at the shared 700-weight default where that specific design instance used 800 (the export itself isn't fully consistent between screens on this); `FinishSummary`'s trophy icon/title/body-map/session-rating chrome wasn't restyled beyond its stat tiles (T091).



### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — can start immediately.
- **Foundational (Phase 2)**: Depends on Setup completion — **BLOCKS** all user stories (T007–T009 and T010–T012 are same-file sequential chains within Phase 2 itself; T013–T018 are parallel-safe).
- **User Stories (Phases 3–8)**: All depend on Foundational (Phase 2) completion.
  - US1 (Phase 3) and US2 (Phase 4) are both P1 and have no file overlap with each other — can run fully in parallel.
  - US3 (Phase 5) and US4 (Phase 6) are both P2 but **share three files** (`WeeklyCheckIn.jsx`, `Progress.jsx`, `Fees.jsx`) restyled once in Phase 5 — Phase 6's T051–T054 must wait for Phase 5's T041–T043.
  - US2 (Phase 4) and US3 (Phase 5) share one file (`ClientWorkspace.jsx`, restyled once in Phase 4) — Phase 5's T045 must wait for Phase 4's T032.
  - US5 (Phase 7) depends on Phases 3–6 being complete (it sweeps screens they restyled).
  - US6 (Phase 8) has no file overlap with any other story and could technically run in parallel with Phases 3–7, but is sequenced last per spec.md priority (P3) and because Login is the natural last-polished "front door."
- **Polish (Final Phase)**: Depends on all of Phases 1–8 being complete.

### Parallel Opportunities

- Setup: T002, T003, T005 in parallel (different files/no shared state); T001, T004, T006 are verification runs, sequenced around them.
- Foundational: T013–T018 in parallel once T007–T012's sequential `ui.jsx`/`index.css` chain completes.
- US1 (Phase 3): T021–T025 in parallel (five distinct view files); T026 onward is sequential (depends on all five).
- US2 (Phase 4): T030, T031, T033 in parallel; T032 (`ClientWorkspace.jsx`) and T034/T035 (`WorkoutPlanEditor.jsx`) are their own sequential chains.
- US3 (Phase 5): T039, T040, T044 in parallel; T041, T042, T043 are independent of each other (different files) and can run in parallel with T039/T040/T044.
- US4 (Phase 6): T049, T050, T051 in parallel; T052 depends on Phase 5's T041.
- US6 (Phase 8): T067–T070 fully in parallel (four distinct files).

## Implementation Strategy

### MVP First

1. Phase 1 (Setup) → Phase 2 (Foundational) → Phase 3 (US1). Stop and validate US1 independently (client core loop, the single highest-frequency path) before continuing.

### Incremental Delivery

1. Setup + Foundational → foundation ready, no visible change yet.
2. US1 (client core loop) + US2 (trainer core loop) → both P1 stories, the two core loops — demoable MVP.
3. US3 (remaining client) + US4 (remaining trainer, after US3's shared-file tasks) → full client and trainer surfaces migrated.
4. US5 (states & accessibility sweep) → quality bar applied across everything migrated so far.
5. US6 (Login/Coach/Admin) → remaining confirmed-in-scope screens.
6. Final Phase → whole-system regression, build, and Graphify refresh.

### Rollout Rationale

This order matches `research.md` §7 and keeps every phase small enough to satisfy constitution Principle VII (tests + build + four-viewport verification per phase, never deferred to one final pass).
