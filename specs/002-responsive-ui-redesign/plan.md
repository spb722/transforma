# Implementation Plan: Responsive UI Redesign (Transforma "Blackprint Green")

**Branch**: `002-responsive-ui-redesign` (implemented on the current checked-out branch, `codex/001-trainer-client-coaching`, per Clarifications) | **Date**: 2026-09-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-responsive-ui-redesign/spec.md`

## Summary

Re-skin the existing 33-screen Transforma React SPA (client + trainer) onto the approved "Blackprint Green" visual direction, using one shared design-token layer and one shared component library across both roles, without changing any API, store shape, or business rule. Graphify + direct inspection show the app already has the right shape for this: a single shared component library (`frontend/src/components/ui.jsx`) and a single iOS-style token layer (`frontend/src/index.css`) that the personal app fully consumes, but the coaching subtree layers five separate stylesheets (`coaching.css`, `editor.css`, `diet.css`, `checkin.css`, `fees.css`) with their own hardcoded forest/lime colors instead of the shared tokens — that divergence is the concrete root cause of the "two products" problem and the primary migration target. The plan extends the existing token system with the new palette, migrates the five coaching stylesheets onto it, restyles `ui.jsx` and shared coaching components in place, and rolls screens out in small, independently-verifiable groups.

## Technical Context

**Language/Version**: JavaScript (ES modules), JSX — React 19

**Primary Dependencies**: React 19, React Router 7 (`HashRouter`), Zustand 5 (`useStore`, `useCoachingStore`, `useUI`), Vite 8, `@vitejs/plugin-react`, Capacitor 7 (`@capacitor/core`, `/android`, `/ios`, `/filesystem`, `/local-notifications`, `/share`), Express (`api/server.js`) — backend untouched by this feature.

**Storage**: SQLite via existing `api/coaching/db.js` / `api/db.js` — **N/A for this feature**; no schema, migration, or query changes (constitution Principle IX).

**Testing**: Vitest (`frontend/src/**/*.test.js`, e.g. `useCoachingStore.test.js`, `plan-sources.test.js`, `schedule.test.js`, `api.test.js`), Node's test runner for API tests (`api/test/coaching-*.test.js`, `coaching-performance.mjs`), Playwright-style scripts under `e2e/` (e.g. `e2e/03-workouts.mjs`, `02-invite.mjs`). All are retained and extended; none are replaced.

**Target Platform**: Installable PWA (`frontend/public/sw.js`, `manifest.json`) served locally at `http://localhost:8080` (never `127.0.0.1:8080`, Principle VIII), plus Capacitor-wrapped Android and iOS builds from the same web bundle.

**Project Type**: Web application — Express API (`api/`) + React SPA (`frontend/`), single HashRouter/Shell (`frontend/src/App.jsx`) covering both the personal app and the coaching app in one bundle.

**Performance Goals**: No regression vs. current production build — same Vite bundling, no new heavy runtime dependency (no new UI framework). Motion budget stays within the existing `--fast:140ms` / `--med:220ms` easing tokens already defined in `index.css`.

**Constraints**: Mobile-first, offline-capable (existing service worker behavior preserved, not extended), no API/DB changes, no new UI framework, must not regress any flow in constitution Principle VI, must render correctly at 360×800/390×844/768×1024/1440×900.

**Scale/Scope**: 33 in-scope screens/views (14 client + 15 trainer per the design guide manifest, plus Login/Coach chat/AdminCoach confirmed in Clarifications), 1 shared component library, 6 CSS files to unify (`index.css` + 5 coaching stylesheets), 2 user roles (client, trainer) sharing several components via an existing `mode="client"|"trainer"` prop pattern (`ClientWorkspace`, `WeeklyCheckIn`, `Progress`, `Fees`).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Check | Status |
|---|---|---|
| I. Preserve working business behavior | Every task pairs a visual/structural change with a baseline+regression check against existing tests/fixtures (FR-029); no task changes store logic, API calls, or domain rules. | PASS |
| II. Mobile-first, responsive, desktop support | Rollout order (below) starts every screen group at 360×800/390×844 before tablet/desktop; FR-014–019 codify the four viewports and reflow rules. | PASS |
| III. Accessible, reusable components, consistent tokens | Phase 1 defines one extended token set in `index.css` consumed by both surfaces; `ui.jsx` is restyled in place rather than forked; FR-020–025 codify the accessibility bar. | PASS |
| IV. Coach-assigned plans authoritative & read-only | User Story 1 and FR-007–010 are unchanged by this plan — the plan re-styles `ClientHome`/`Plan`/`Workout`, it does not touch `hasActiveCoachPlan()` or the routing gate in `App.jsx` (`coachPlanActive ? ... : <RoutineEdit/>`). | PASS |
| V. Started/completed occurrences never destructively replaced | No task touches `api/coaching/occurrences.js`, `plans.js`, or `schedule.js` logic; restyled Schedule Manager/Recurring Plan Editor controls call the same existing mutation functions. | PASS |
| VI. Existing capabilities remain functional | Regression checklist per screen group (Phase 2/tasks) explicitly lists the constitution's capability list per touched screen. | PASS |
| VII. Tests, build, responsive verification every phase | Each rollout group's tasks end with: existing tests pass, new/updated tests added, `npm run build` succeeds, four viewports checked. | PASS |
| VIII. `localhost:8080`, never `127.0.0.1:8080` | quickstart.md and all manual verification steps specify `localhost:8080` only. | PASS |
| IX. No API/DB changes without proof + approval | Technical Context marks Storage as N/A; no task in this plan touches `api/coaching/*.js` route/query logic or `api/coaching/migrations/`. | PASS |
| X. Preserve unrelated dirty-worktree work | Plan works only inside `frontend/src/**` (styles/components/views) plus this feature's own `specs/002-*` docs; it does not touch the uncommitted `001` files under `api/coaching/*`, `api/test/*`, or the new migrations, and reuses rather than reverts them. | PASS |

No violations — Complexity Tracking table is empty (see below).

## Project Structure

### Documentation (this feature)

```text
specs/002-responsive-ui-redesign/
├── plan.md              # This file
├── research.md          # Phase 0 output
├── data-model.md         # Phase 1 output
├── quickstart.md         # Phase 1 output
├── contracts/
│   └── ui-component-contract.md   # Phase 1 output — design-token & shared-component contract
├── checklists/
│   └── requirements.md   # Spec quality checklist (already validated)
└── tasks.md              # Phase 2 output (/speckit-tasks — not created by this command)
```

### Source Code (repository root)

This is the existing **web application** structure (Express API + React SPA); no new top-level directories are introduced.

```text
api/                                  # Express backend — UNTOUCHED by this feature
├── coaching/*.js, migrations/*.sql   # domain logic & schema — out of scope (Principle IX)
└── coach/*.js                        # AI Coach backend — untouched; only its chat UI is restyled

frontend/
├── src/
│   ├── index.css                     # [EXTEND] shared token layer — add "Blackprint Green" tokens
│   ├── App.jsx                       # [NO CHANGE to routing/logic] Shell already gates on coachPlanActive, user.capabilities.trainer
│   ├── components/
│   │   ├── ui.jsx                    # [RESTYLE IN PLACE] shared primitives (Button, Row, Section, Field*, Segmented, Switch, ...)
│   │   ├── Icon.jsx                  # [EXTEND] existing stroke-icon set — add any new icons the export requires, same conventions
│   │   ├── TabBar.jsx, Toast.jsx, Modals.jsx, RestTimer.jsx, ErrorBoundary.jsx   # [RESTYLE IN PLACE]
│   │   ├── BodyMap.jsx, Heatmap.jsx, LineChart.jsx, Stepper.jsx, NumField.jsx    # [RESTYLE IN PLACE]
│   │   ├── ExerciseCatalogPicker.jsx # [RESTYLE IN PLACE]
│   │   └── coaching/
│   │       ├── coaching.css, editor.css, diet.css, checkin.css, fees.css        # [MIGRATE] onto index.css tokens, then trim to role-density deltas only
│   │       ├── CoachingShell.jsx     # [RESTYLE IN PLACE] shared coaching layout/nav chrome
│   │       ├── WorkoutPlanEditor.jsx # [RESTYLE + verify] template sources, recurring editor, schedule manager surfaces
│   │       ├── DietPlanEditor.jsx, CheckInResponse.jsx, ContactTrainer.jsx       # [RESTYLE IN PLACE]
│   │       └── plan-sources.js, schedule.js, dates.js  # [NO CHANGE] logic modules feeding the editor — reused as-is
│   ├── views/
│   │   ├── Login.jsx, Home.jsx, Plan.jsx, RoutineEdit.jsx, Workout.jsx, Stats.jsx, History.jsx, Library.jsx, Settings.jsx   # [RESTYLE IN PLACE] personal app
│   │   ├── Coach.jsx, CoachIntake.jsx, CoachProposal.jsx, Admin.jsx, AdminCoach.jsx                                          # [RESTYLE IN PLACE] AI Coach + admin (confirmed in scope)
│   │   └── coaching/
│   │       ├── TrainerHome.jsx, Invitations.jsx, TrainerSettings.jsx, WorkoutPlans.jsx, DietPlans.jsx                       # [RESTYLE IN PLACE] trainer-only views
│   │       ├── ClientHome.jsx, MyDiet.jsx, Join.jsx                                                                          # [RESTYLE IN PLACE] client-only views
│   │       └── ClientWorkspace.jsx, WeeklyCheckIn.jsx, Progress.jsx, Fees.jsx                                                # [RESTYLE IN PLACE] shared, mode="client"|"trainer"
│   └── store/useStore.js, useCoachingStore.js, useUI.js   # [NO CHANGE] state ownership stays exactly as-is
└── android/, ios/, public/manifest.json, public/sw.js     # [ASSET-ONLY] icon/splash/theme-color updates to match new brand marks, no behavior change

e2e/                                   # [EXTEND] add/adjust screenshot assertions if selectors change; flows untouched
```

**Structure Decision**: No new projects, packages, or directories. This is a pure in-place restyle of the existing `frontend/src` tree: one token file extended, five coaching stylesheets migrated onto it, existing components and views restyled without moving files or changing their public props/behavior contracts, except where a prop is added to support a new visual state (documented per-component in `contracts/ui-component-contract.md`). `api/` is untouched. State ownership (`useStore` for personal, `useCoachingStore` for coaching, `useUI` for shared UI chrome like toasts/sheets) is unchanged — this plan is a presentation-layer migration only.

## Complexity Tracking

*No Constitution Check violations — table intentionally empty.*
