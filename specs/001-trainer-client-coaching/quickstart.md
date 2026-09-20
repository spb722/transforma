# Validation guide: Trainer–Client Coaching MVP

Use this guide to validate the implemented coaching MVP on isolated data. Automated evidence is recorded in `validation.md`; the two-week participant pilot remains separate in `pilot.md`.

For a plain-language journey that a non-technical tester can follow, use [`user-acceptance-test.md`](user-acceptance-test.md). It gives exact actions, expected results, pass/fail rules, and release-blocking privacy and payment checks.

## Prerequisites and pilot inputs

- Use a dedicated local/test data directory. Never seed production. Take a complete backup before introducing migrations to existing data.
- Retain Node 22 and repository lockfiles; implementation adds the pinned SQLite dependency. Prove container/native compatibility before deployment.
- Use separate browser profiles for trainer A, trainer B, client A, client B, and an unlinked individual. For physical-device passkey testing use the test application's HTTPS hostname, not a phone's `localhost`.
- Operator selects the proposed trainer and 5–10 clients, business time zone, optional WhatsApp number, provider-created test links, supported currencies/exponents, and approved checkout hosts. Decide actual provider, launch country, and currency before collecting real fees.
- Verify repository license/source-distribution and separately licensed exercise-media requirements before launch. This plan does not change licensing or assume new rights.

## Start the existing development topology

Run from the repository root. These install dependencies and use existing test/build scripts:

```sh
npm --prefix api ci
npm --prefix frontend ci
npm --prefix api test
npm --prefix frontend test
npm --prefix frontend run build
```

Create isolated data and run the API in one terminal:

```sh
coaching_dev_data=$(mktemp -d /tmp/transforma-coaching.XXXXXX)
DATA_DIR="$coaching_dev_data" PORT=3000 RP_ID=localhost ORIGIN=http://localhost:5173 node api/server.js
```

Retain this directory for the run; restarting with a new directory starts an empty instance. In another terminal, from repository root:

```sh
npm --prefix frontend run dev -- --host 127.0.0.1 --port 5173 --strictPort
```

Open `http://localhost:5173`. Existing Vite proxy forwards `/api` to port 3000. Exercise media may require the existing media service; missing media must not prevent testing logging/assignments. Keep browser hostname and passkey RP/origin consistent.

Register test accounts through the UI. Use the ID returned by `/api/me` to configure `TRAINER_UIDS` for trainer A/B, then restart with the **same** data directory and origin. Do not grant `ADMIN_UIDS` merely for coaching. Set `COACHING_PAYMENT_HOSTS` (comma-separated exact hostnames) and `COACHING_CURRENCIES` (JSON mapping currency codes to minor-unit exponents) before fee tests, as defined in `research.md` and `.env.example`. Complete trainer profiles in Settings.

Repeat onboarding with `INVITE_ONLY=1`, using a coaching invitation for a new account. Independently confirm existing admin signup codes still work. No test-only authentication bypass may ship in production routes.

## Automated implementation checks

Extend existing API `node:test` with isolated identities, JSON/SQLite files, and signed-session fixtures. Never connect fixtures to development/production data. Use frontend Vitest for pure adapters/date/outbox behavior; favor behavior assertions over component snapshots.

New coverage must include authorization and ended relationships; concurrent acceptance/admission; rollback; stale plan/check-in/response/fee versions; occurrence moves/downtime; immutable snapshots; retries/conflicting IDs; account-scoped outbox; checkout invariance; fee audits; timezone/week/due boundaries; legacy compatibility.

The existing test commands must discover/pass new suites after implementation. Build deployment images from source because upstream images do not contain this feature:

```sh
docker compose build api web
```

Use test configuration/volumes when starting images. Prove SQLite import, insert/read/reopen, and migration startup in the actual API container/deployment architecture. A local JS test does not prove Alpine packaging. Do not start Compose against production data as a test shortcut.

## End-to-end scenarios

### A. Provisioning and invitations

Trainer A configures identity/zone/contact and creates a copyable seven-day invitation. An unrelated client cannot access the workspace directly. Trainer B cannot see A's invitations/templates/clients. A client cannot set trainer/admin capability through UI, personal upload, or API fields.

Redeem concurrently in two accounts: exactly one relationship. Successful-recipient retry returns that relationship. Test expired/revoked/invalid tokens, revocation between registration options/verification, and acceptance after trainer disablement. No invalid path creates sharing.

### B. New and existing onboarding

Record an existing client's ID, routines, workout IDs, and weigh-ins. Accept after reading the named-trainer sharing disclosure. Verify identical account and preserved history.

For a new invite-only user, create the passkey using the coaching token without another code. Interrupt after account persistence and before acceptance. Sign in and finish consent: one admission, one relationship. If the token becomes unavailable, keep the ordinary account without sharing. An already-linked client must end the current relationship before joining another.

### C. Ending and retention

End from each party in separate fixtures. Subsequent trainer requests, including mutation replay and open-page refresh, deny access. Client retains personal history and archived received plans/check-ins/fees with checkout/edit actions disabled. A previously started session may still sync under its client. Reopening an accepted invite never reactivates an ended relationship.

### D. Plans, occurrences, and revisions

Build a template with reps/time/cardio, load/rest/notes, and an exercise with no completed sets. Assign two copies and customize one; source/other client remain unchanged.

Start today, then revise the plan: started targets stay frozen, future unstarted targets change. Personal progression/optional existing AI cannot change the assignment. Move an upcoming occurrence across a week boundary: stable ID, no duplicate recurrence/completion. Past/started moves/cancellation deny. Check zero, partial, and extra attempts are labeled accurately.

### E. Offline, crash, and retry

Start online, disconnect, finish, reload: one local entry waiting to sync. Reconnect and repeat upload: one result and one occurrence completion. Fail after enqueue/before active clear and after server commit/before response; recover without duplication/loss. Reuse ID with different results: retain local payload and show conflict.

On storage failure retain active work, never claim saved. New assigned start offline requests connection; personal start works. Log out pending, log into B: no A display/upload. Return to A and recover. Repeat with session expiry and relationship ending before upload.

### F. Stale device and personal tools

Upload old `/api/data` after assigned confirmation. Pull/reconcile on stale/new clients: canonical result, all frozen targets, and latest trainer plan survive exactly once. Same-ID fabricated personal data cannot replace targets/actuals. Importing assignment-shaped data cannot manufacture authorization.

Unassigned editing/deletion, routines, progression, imports/exports, weights, and offline logging retain behavior. Joining/publication never erases old workouts. Existing whole-state conflict policy for purely personal data is not redesigned into new multi-device sync.

### G. Diet

Publish meal/portion/note copies to two clients; revise one and verify isolation/update date. Client edits deny. No diet shows empty/contact state. Viewing never creates adherence/check-in data.

### H. Progress and feedback

Compare counts against completed, partial, empty, missed, extra, and unsynced fixtures. Test Monday/year boundaries, zone mismatch, daylight-saving boundary, and downtime >28 days. Historical denominators stay stable after catch-up/revisions.

Submit/edit all four adherence options with optional weight/notes: one weekly row. Respond, edit client report, and verify needs-review with previous dated response. Response against stale check-in conflicts. Missing is labeled, not zero. Personal-sync/assigned-result receipts differ from device clock; weight sources do not duplicate personal entries.

### I. Contact and mobile

Contact opens WhatsApp only by user action, without sending/prefilling health/payment information. Copy-number works even if opening fails; absent number shows unavailable.

At 320px, 390px, tablet, and desktop, test navigation/search/forms/logger with keyboard/diet/check-in/response/fees. No page overflow; focus/dialog behavior works. Test physical iPhone Safari and Android Chrome on HTTPS. Prototype viewport checks do not certify this unbuilt integration or actual devices.

### J. Fees

Create valid fee; invalid fields/hosts prevent publication. Open/cancel/revisit checkout and simulate success-looking return URL: remains unpaid. Client/unrelated confirmation denies. Trainer confirms verified receipt; retry creates no duplicate event.

Correct with reason, inspect retained author/time/history, reconfirm with fresh mutation ID. Void an incorrect unpaid fee and recreate it without rewriting history. Test due-day midnight in business zone. Overdue/checkout failures never block training. Test links suffice; no real money movement is required.

### K. Migration and restore

Migrate a copy of legacy data, restart, compare IDs/history. Kill test API during write: recover committed transaction or rollback, no partial fee/relationship. Invalid migration stops startup without replacing database.

Stop test API, back up entire data directory, restore into another isolated directory, and confirm sign-in, relationships, targets/results, personal history, and fee audit. Replay pending client results into restored instance. Database-only backup is not a complete product backup.

### L. Errors and performance

Exercise 401, revoked 404, version 409, invalid/oversized requests, throttling, network failure, and SQLite contention. Preserve inputs and show accurate retry/save states. No endpoint/cache leaks between accounts.

With ten clients and representative histories, measure p95 <=500ms ordinary API and <=2-second mobile workspace targets on intended host/network. Exclude external checkout/passkey durations and intentional contention from ordinary timings; report those errors separately.

### M. Catalog-backed authoring and plan reuse

As the trainer, open a client with no assignment and verify the editor offers Blank, Saved templates, My personal plan, Starter Push/Pull/Legs, and Recent assignments. Load each source, modify its draft, and prove the source and another client's assignment remain unchanged. Save as a new template, update it with the expected version, archive it, and verify only the owner can list it.

Add one built-in reps exercise, one built-in cardio exercise, one explicitly timed exercise, and one manual custom exercise. Verify search/filter/preview uses the existing catalog; the client sees built-in animations by catalog ID; custom metadata survives without a catalog entry; and all target modes, unit, per-exercise rest, and notes reach the logger. Confirm no workflow eagerly downloads the complete media library.

### N. Personal journey for assigned work

Publish an occurrence for the relationship's current business date. Without opening Coaching first, sign in as the client and verify Personal Home shows the assignment, Personal Plan shows only the detailed read-only coach plan and schedule, and the center Start action offers only the assigned session. Seed a same-day personal routine first and verify it, Build/New/share controls, AI Coach, direct `/plan/r/:id`, and Freestyle are unavailable while the coach plan is active, without deleting the saved personal data.

Start assigned work online, then disconnect, complete it, and verify Personal History shows one Coach-assigned entry waiting to sync. Reconnect and verify the same entry becomes synced and appears once in Stats. Revise the trainer plan after start and prove the active/completed snapshot is unchanged. Repeat with device and relationship zones on different dates, stale versions, offline start, and an existing active personal session.

### O. Schedule reconciliation and recovery

Publish Monday and Friday, then revise to Friday only: mutable future Mondays become plan-removed/canceled while past and started rows remain frozen. Re-add Monday and verify plan-removed rows return without duplicating IDs; explicitly canceled rows stay canceled until Restore.

Move a future row, verify its stable ID and override, then Reset it to the original date. Cancel with confirmation, verify it remains visible under Canceled, and Restore it on an available date. Test stale versions, occupied dates, no-op moves, far-future natural recurrence collisions, duplicate weekday ownership, ended relationships, unrelated users, and business-zone midnight. The current all-canceled `test_1` assignment must be recoverable entirely through the UI, without editing SQLite.

Finally run the Safari trainer and Firefox client journey on `http://localhost:8080`: load a prior source, choose a catalog exercise, publish, observe it in Personal, start/finish/sync, revise, move/reset, cancel/restore, and confirm both browsers agree after focus refresh.

## Pilot acceptance measurements

Collect task timings/assistance with proposed one trainer and 5–10 clients. Automated tests alone do not establish these user outcomes.

- SC-001: >=90% accept/reach home unassisted in <3 minutes.
- SC-002: trainer assigns existing workout+diet in <5 minutes combined, excluding authoring.
- SC-003: >=90% start today within two home actions and log unassisted.
- SC-004: trainer identifies incomplete work, missing/unreviewed check-ins, overdue fees across ten clients in <2 minutes.
- SC-005: >=90% find diet and check in unassisted in <3 minutes.
- SC-006: every unrelated/revoked access test denies; revision/sync loses no completed session, original prescription, or fee audit history. Assigned authority is protected even against stale personal uploads; purely personal sync retains its existing policy.
- SC-007: every checkout-open/cancel/return stays unpaid until confirmation; trainer records verified receipt in <1 minute.
- SC-008: over two weeks, >=80% complete applicable invite/plan-view/log/check-in/fee-link steps unassisted; trainer can review/respond.

Run authorization, data-integrity, and payment-invariance scenarios before admitting pilot clients. Record physical-device results and a successful restore. Configure provider/contact/currency before fee use. Do not substitute viewport emulation or automated tests for operational checks.
