# Trainer–Client Coaching Validation

This file records implementation evidence. It does not replace the real participant measurements in `pilot.md`.

## Starting state

- Feature branch: `codex/001-trainer-client-coaching`
- Starting commit: `678bf5bf10446e8997a77d43e89c9b2721d8d0fc`
- Runtime observed on 2026-09-07: Node `v22.19.0`, npm `10.9.3`
- Existing user changes preserved: `.gitignore`, `.idea/`, `.specify/`, `design/`, and `specs/` were already modified or untracked before implementation. The standalone prototype in `design/coaching-prototype/` remains a nested repository and is not application source.

## Baseline

The first run before dependency installation failed because existing packages were absent: the API could not import `@anthropic-ai/claude-agent-sdk`, and frontend commands could not find Vitest/Vite. After `npm ci` in `api/` and `frontend/`:

- `npm test` in `api/`: PASS, 56/56 tests.
- `npm test` in `frontend/`: PASS, 207/207 tests.
- `npm run build` in `frontend/`: PASS. Vite reported the existing large-chunk warning for a chunk above 1,500 kB.
- npm audit output during installation reported existing dependency findings: API 3 (2 moderate, 1 high), frontend 15 (4 moderate, 10 high, 1 critical). They are recorded rather than automatically rewritten with `npm audit fix`, which could make unrelated breaking dependency changes.

## Phase evidence

### Shared foundation and access

- SQLite migrations 1–5 run transactionally with foreign keys, WAL, FULL synchronization, and a 5,000ms busy timeout. Reopen, uniqueness, foreign-key, rollback, corrupt-database, and failed-migration assertions pass.
- Coaching capability is separate from administrator status. Relationship guards deny unrelated users and active-trainer reads immediately after ending, while the client retains diet, check-in, fee, assigned-plan, and personal archives.
- Mutation boundaries enforce the configured Origin, JSON, 500KB limit, bounded dates/pages, public errors, expected versions, and current authorization on idempotent replay.
- Invitation tests cover hashed 32-byte tokens, seven-day expiry, revoke/single-recipient use, retry by the successful recipient, consent version, self-invitation, one active trainer, archived ending, and rejoining only with a fresh invitation.
- The service worker bypasses `/api/`; trainer client data stays memory-only; changing accounts clears displayed trainer state. Assigned-result queues remain UID-scoped.

### Product stories

- Workout publication preserves immutable revisions and client copies. Reps, timed, and cardio validators retain units, targets, rest, and notes. Occurrences materialize through today plus 28 days, survive moves by stable id, lock past/started rows, and catch up missed dates after downtime or during a long-running server interval.
- Assigned sessions require an online current-day start, freeze the server prescription, retain target versus actual values, enqueue locally before clearing, deduplicate retries, permit owner upload after ending, and project canonical assigned results over stale personal uploads.
- Diets publish independently of workouts as isolated immutable client copies. Viewing does not infer adherence.
- Weekly check-ins enforce one Monday row per relationship/week, four adherence values, optional explicit-unit weight and notes, optimistic versions, one editable trainer response, and a retained response marked for review after a client edit.
- Progress reports scheduled/completed/partial/extra separately, exposes assigned strength points and personal weight with source/unit labels, keeps server receipt timestamps distinct, labels missing data, and supports 4/12/24-week views.
- Fees validate positive minor-unit amounts, configured currencies/exponents, exact approved HTTPS hosts, periods/due dates, trainer-only verified receipt, reasoned corrections/voids, and retained audit events. Checkout open/return never changes state and payment never restricts training.
- The trainer and client homes, workspace, reusable workout templates, future move/cancel controls, diets, check-ins, progress, fee audit, contact fallback, invitations, and archived relationship states are integrated into the responsive coaching shell. No in-app chat was added; contact is a user-initiated WhatsApp/copy action without message prefill.

### Restore and packaging

- `api/test/coaching-storage.test.js` restores a stopped whole-data copy and verifies identity JSON, personal history, relationship data, immutable assigned prescription, fee event history, and successful replay of a pending assigned result.
- `docker compose build api web`: PASS on Docker Engine 29.7.2. The API build compiled `better-sqlite3`, imported the optional Agent SDK and Codex runtime, and removed temporary native build packages. The web image completed the production Vite build.
- Container smoke command against `ghcr.io/spb722/transforma-api:latest`: PASS. Alpine opened SQLite, applied migrations `[1,2,3,4,5]`, inserted a trainer profile, closed, reopened, and read `Container Trainer`.

### Responsive and performance

- Seeded authenticated trainer overview was inspected through the integrated local Vite/API application. At 320×720, 390×844, 768×1024, and 1440×900, `documentElement.scrollWidth <= innerWidth`; navigation switched from fixed bottom navigation below 760px to sticky sidebar at larger widths.
- At 320px, the workout editor, reusable template controls, reps/time/cardio fields, save status, and future move/cancel controls had no horizontal overflow. Visible overview buttons were at least 49px high, and keyboard Tab focus reached coaching navigation controls.
- Physical iPhone Safari and Android Chrome over the pilot HTTPS origin: **PENDING, no physical devices/test hostname supplied**. Viewport results do not count as physical-device evidence.
- `node api/test/coaching-performance.mjs` with 10 clients, 200 personal workouts per client, and 100 samples: trainer overview p95 **0.83ms** (500ms target), workspace server processing p95 **0.13ms** (2,000ms target). Scope excludes browser/network, passkeys, checkout, and intentional contention; repeat on the intended pilot host/network when supplied.

### Latest automated regression

- `npm test` in `api/`: PASS, **83/83** tests.
- `npm test -- --run` in `frontend/`: PASS, **221/221** tests across 16 files.
- `npm run build` in `frontend/`: PASS. The existing Hindi locale chunk remains above the configured 1,500kB warning threshold; this is a warning, not a build failure.
- Focused post-hardening tests for access replay, archives, progress strength, stopped backup/restore, occurrence downtime, and frontend account switching: PASS.
- `graphify update .`: PASS, refreshed `graphify-out/graph.json`, `graph.html`, and `GRAPH_REPORT.md` with 2,377 nodes and 5,520 edges. Graphify reported preexisting Android Gradle parse limitations and missing optional SQL parsing support; JavaScript/JSX extraction completed.

## Operational checks still required

- Real passkey creation/sign-in and invite-only admission interruption/recovery on the final HTTPS hostname.
- Full manual quickstart A–J on separate browser profiles, including UI interaction timing and checkout cancel/return on the selected provider.
- Physical iPhone Safari and Android Chrome checks.
- Performance on the intended pilot host/network.
- One trainer and 5–10 consenting clients for the 14-day SC-001–SC-008 pilot in `pilot.md`.

No production deployment, external payment, participant invitation, or two-week pilot was performed.

## 2026-09-13 convergence validation

- Added migration 6 and verified the live coaching database reports schema versions `[1,2,3,4,5,6]`. Existing explicitly canceled `test_1` occurrences were retained with stable IDs and classified as `explicit`, so they can be restored through the trainer UI rather than edited in SQLite.
- `npm test` in `api/`: PASS, **88/88** tests. New cases cover removed/re-added weekdays, explicit cancel/restore, move/reset/no-op behavior, predictable future collisions, duplicate weekday ownership, legacy entry normalization, and trainer-isolated recent plan sources.
- `npm test` in `frontend/`: PASS, **227/227** tests across 19 files. New cases cover relationship-zone schedule projection, moved/canceled grouping, legacy/catalog identity, Personal and Starter PPL conversion including Sunday, and own bootstrap/workspace refresh on mount, focus, 30-second interval, unlink, and access denial.
- `npm run build` in `frontend/`: PASS. The existing large locale-chunk warning remains non-fatal.
- `docker compose up -d --build api web`: PASS for the main migration/API/UI implementation. A later frontend-only rebuild was blocked by a Docker Hub metadata timeout; the final passing production bundle was copied into the already-running local web container for the browser validation below. No source or data was lost.
- `node e2e/02-invite.mjs`: PASS using isolated trainer/client WebAuthn authenticators, including profile, invitation, consent, active roster, single-recipient replay, one-active-trainer, and unrelated-user denial.
- `node e2e/03-workouts.mjs`: PASS. The trainer published a catalog-backed assignment, saw Personal/Starter/recent sources and catalog results, and used Move, Reset, Cancel, and Restore through the grouped schedule UI. The client saw the assignment on Personal Home, Plan, and Start; started it in the existing logger with coach note and `lb` prescription; finished it; and saw one synced **Coach assigned** History row.
- Visual artifacts: `e2e/shot-workout-composer.png` and `e2e/shot-personal-assignment.png`. The final Restore assertion confirms the original date is restored and stale move input is cleared.
- Final-code repeat: frontend **228/228**, production build, invitation invariants, and workout journey all passed. The refined E2E assertions prove that an active coach plan hides personal creation/routines/freestyle on Home, Plan, and Start; renders the complete read-only coach prescription/schedule; and removes Add exercise/Add set/Remove set from its logger while actual values remain recordable. The current bundle was copied into the running localhost web container.
- Final `graphify update .` refreshed the code graph to **2,528 nodes and 5,827 edges**; Graphify only reported its existing optional SQL-parser and Android Gradle parser limitations.
- The collaborative UI inventory exposed no attached Safari or Firefox surface during this run, so the automated pass used two isolated Chromium contexts with real virtual WebAuthn credentials. A short hands-on Safari/Firefox confirmation remains useful, but is not required to reproduce the verified application behavior.

## 2026-09-13 started-session and calendar regression

- Reproduced the reported state against the live API: today's occurrence was already `started`, while the browser's personal state no longer contained its local active logger. Home and Start only selected `scheduled` occurrences, so they incorrectly rendered the no-workout state.
- The own-workspace refresh now also reads assigned sessions and identifies the active server-started session. Home and Start render it as **In progress**, and Resume reconstructs the local logger with the server session ID and frozen prescription instead of creating a duplicate.
- Personal Home's week arrows and day buttons now select an actual date and project that date's coach occurrence. The Plan screen exposes future explicit cancellations under **Canceled by trainer**, distinguishing them from an unscheduled day.
- `npm test -- --run` in `frontend/`: PASS, **229/229** tests across 19 files. `npm run build`: PASS with the existing non-fatal large-chunk warning.
- Fresh `node e2e/02-invite.mjs && node e2e/03-workouts.mjs`: PASS. It verified reusable plan sources, exercise-catalog results, exclusive coached Home/Plan/Start, next-week projection, start, server-state recovery after clearing local active state, resume, finish/history, visible cancellation, and trainer move/reset/cancel/restore. The verified bundle was copied to the running `localhost:8080` web container.
- `graphify update .`: PASS, refreshed the code graph to **2,532 nodes and 5,835 edges**. Existing optional SQL-parser and Android Gradle parser warnings remain unchanged.

## 2026-09-13 trainer schedule usability

- Added additive migration 7 and API coverage for one-day prescription overrides, reset to the latest recurring prescription, persistence across publication/day off/restore, trainer-only authorization, and started-row locking. Full API suite: PASS, **90/90**.
- Reworked the trainer workout screen to lead with **Current plan** and **Schedule manager**, collapse recurring-plan composition, and place Edit this workout, Reschedule, Give day off, Restore, and reset actions behind one row-level **Manage** control.
- Client Home, Plan, Start, and workspace projections now show the effective dated prescription and consistent **Customized**, **Rescheduled**, and **Day off** states. Full frontend suite: PASS, **229/229**; production build: PASS with the existing non-fatal large locale-chunk warning.
- Fresh isolated invitation and workout journeys: PASS. The E2E run published a catalog-backed plan, edited one future date, verified the client received that override, rescheduled/reset the date, gave/restored a day off, proved the override survived those state changes, and returned the date to the recurring prescription.
- Visual QA: `e2e/shot-workout-composer.png` confirms the current-plan-first layout, grouped schedule, single Manage control, locked completed row, and uncluttered default state.
- `git diff --check`: PASS. `graphify update .`: PASS, refreshed the code graph to **2,538 nodes and 5,848 edges**; only the existing optional SQL-parser and Android Gradle parser warnings were reported.
- Before rollout, 420 same-state syncs forced the detached live SQLite WAL through an automatic checkpoint. A complete `/tmp/transforma-pre-restart.WDLSwK` backup passed `integrity_check` with all **11 relationships** present.
- Rebuilt and recreated the live API/web containers. `http://localhost:8080/api/health` returned OK with **16 users**; the live database passed `integrity_check`, retained all **11 relationships**, and reports migrations `[1,2,3,4,5,6,7]`. The deployed bundle contains **Edit this workout**, and the new customize route is active behind authentication.
- Button-visibility regression: reproduced in the user's live Safari responsive viewport. Both actions had opened the composer after the complete 28-day schedule, leaving it off-screen. The composer now mounts directly below Current plan and each action scrolls it into view; **Edit recurring plan** also reloads the published content. Frontend **229/229**, production build, live Safari verification, and fresh isolated E2E assertions for both buttons: PASS. The fixed web image is running on `localhost:8080`.

## 2026-09-13 recurring source replacement

- Reproduced the reported failure and inspected the live relationship: the attempted Starter PPL publication had rolled back, leaving assignment revision 7 and Beginner Full Body current. Reconciliation inserted fresh day-ID rows before retiring the old rows on those dates, triggering `DATE_OCCUPIED` inside the publication transaction.
- Reconciliation now replaces mutable future rows by original business date, retires obsolete rows before inserts, preserves completed/started history plus relevant moves and one-day edits, and keeps repeated reads version-stable. Internal `plan_removed` rows no longer appear as trainer/client Days off.
- API suite: PASS, **91/91**. Frontend suite: PASS, **229/229**. Production build: PASS with the existing non-fatal large locale-chunk warning.
- Fresh isolated invitation plus workout journey: PASS. The trainer published the original plan, edited/moved/canceled/restored a date, then loaded and published Starter PPL. Upcoming contained Push/Pull/Leg only, operational Days off excluded retired rows, and the client received Starter PPL without the old Coach Squat Day schedule.
- Live Safari follow-up captured the exact 4,538-byte Starter PPL request after an unexplained HTTP 500. Replaying that payload, including its original mutation ID and the live relationship state, against an online SQLite backup succeeded as version 8 without changing live data. Workout publication now retries one HTTP 500 exactly once with the same idempotency key, and unexpected coaching exceptions are logged server-side. API **91/91** and frontend **231/231** passed before redeployment.
