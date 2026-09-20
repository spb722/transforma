# Quickstart: Validating the Responsive UI Redesign

Manual + scripted validation steps to prove each rollout group works end-to-end. Run after every group in research.md §7, not only at the end.

## Prerequisites

- Working tree has this feature's changes plus the pre-existing uncommitted `001-trainer-client-coaching` work (do not stash/revert it — constitution Principle X).
- Local API + frontend dev servers running and reachable at `http://localhost:8080` (**never** `127.0.0.1:8080` — constitution Principle VIII).
- Existing coaching test fixtures available (per Clarifications: reuse `api/test/coaching-helpers.mjs` / the coaching test suite's accounts, e.g. the `test_1` account already wired into `e2e/capture-design-screens.mjs`) — no new manual test accounts needed.
- Playwright installed for `e2e/` (already a project dependency, used by `e2e/capture-design-screens.mjs`).

## 1. Automated tests

```bash
cd frontend && npm run test          # vitest — frontend unit/store tests
cd ../api && npm test                # node:test — coaching API tests (adjust to actual script name if different)
```

Expected: 100% of pre-existing tests pass (SC-003). Any new/updated test added for this feature is included in this run, not a separate suite.

## 2. Production build

```bash
cd frontend && npm run build
```

Expected: build succeeds with no new errors/warnings introduced by this feature (SC-007).

## 3. Manual functional walkthrough (per rollout group)

Start the dev server, then open `http://localhost:8080` and walk the acceptance scenarios for the screens in that group directly from `spec.md`'s User Stories 1–6. At minimum for every group:

1. Sign in (passkey) as the client test account with an active coach plan — confirm Home/Plan show the coach schedule as read-only, no personal-plan editing controls in the primary flow (FR-007/008).
2. Sign in as the client test account without an active coach plan — confirm personal Plan create/edit still works (FR-009).
3. Start today's workout — confirm the occurrence resolved matches the coaching time zone (FR-010).
4. Sign in as the trainer test account — exercise the nine distinct plan-management actions (FR-011) on a test client's plan and confirm each requires confirmation before applying (FR-013) and that publishing a replacement recurring plan does not alter an occurrence you deliberately started/completed first in the same run (FR-012, SC-006).
5. Trigger at least one loading, one empty, one error, one disabled, and (for the trainer publish flow) one conflict state, and confirm each renders via the shared components from `contracts/ui-component-contract.md` (FR-026/027).

## 3a. Serving a local build at `localhost:8080` without a full Docker rebuild

`docker compose build web` rebuilds the frontend from source inside a container, which pulls
`@capacitor/assets`'s `sharp` dependency — in a network-restricted environment that binary
download can time out (unrelated to any application code). If that happens, skip the rebuild and
copy the already-built static output straight into the running container instead:

```bash
cd frontend && npm run build
docker cp dist/. transforma-web-1:/usr/share/nginx/html/
```

This is a non-persistent, disposable overlay (it doesn't survive a container restart and touches
no tracked config), safe to repeat after every rollout group for a fresh look at `http://localhost:8080`.

## 4. Responsive verification (all four required viewports)

```bash
# from repo root, with the dev server already running at http://localhost:8080
cd e2e && node capture-design-screens.mjs
```

This captures the existing 390×844 mobile and 1440×900 desktop sets into `design/ui-audit/current-mobile/{client,trainer}/` and `design/ui-audit/current-web/`. Per research.md §6, extend the script (once, during the Foundation group) to also capture 360×800 and 768×1024 passes before relying on it for full four-viewport coverage (FR-014).

For each captured screenshot:

- Compare against the same screen's reference in `design/claude-export/Transforma Blackprint Green (1).html` (opened in a browser) and against the corresponding pre-redesign screenshot already in `design/ui-audit/`.
- Confirm no horizontal overflow, no clipped/overlapping text, correct read-only/status treatment, and 44×44px touch targets (FR-017/018).

## 5. Accessibility spot-check (per group)

- Tab through every interactive element on each touched screen with a mouse/pointer disabled — confirm reachability and a visible focus ring (FR-020/021).
- Toggle OS/browser `prefers-reduced-motion` — confirm animations reduce/disable (FR-024).
- Zoom text to 200% — confirm no clipped/overlapping critical content (FR-023).
- Run an automated contrast check (e.g. browser devtools contrast inspector) on the new token pairs listed in `data-model.md`'s validation rule (FR-022).

## 6. Regression sign-off for the group

Before moving to the next rollout group, confirm every capability in constitution Principle VI touched by this group's screens still works (e.g., for the trainer core-loop group: recurring plan publish, schedule manager's day-off/reschedule/restore, and one-trainer-per-client enforcement remain unaffected).

## 7. After implementation completes

```bash
graphify update .
```

Refresh the knowledge graph to reflect the redesigned component tree (constitution's Quality Gates & Workflow section) — never hand-edit `graphify-out/`.
