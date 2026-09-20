# Research: Trainer–Client Coaching MVP

Date: 2026-09-07. Scope: design decisions for `specs/001-trainer-client-coaching/spec.md`, not application implementation.

## 1. Reuse the application and approved visual direction

**Decision:** Extend the existing React 19 / Vite 8 / React Router 7 / Zustand 5 frontend and Node 22 HTTP API. Adapt the approved prototype's ink navigation, white surfaces, green actions, responsive cards, and trainer/client information architecture to existing JSX/CSS components.

**Rationale:** `frontend/src/App.jsx` already provides authentication, routing, preferences, the workout screen, timers, and sheets. `design/coaching-prototype/DESIGN.md` records the accepted design and its simulated behavior. The prototype is a separate deployment, not the production application.

**Alternatives considered:** Replacing the app with the prototype's framework would duplicate authentication, logging, persistence, and deployment work. A new mobile app or wholesale logger redesign is outside scope. Do not copy the demo role switch or fictional data into production.

## 2. Durable coaching storage

**Decision:** Add `DATA_DIR/coaching.sqlite` with `better-sqlite3` pinned to **13.0.3** at implementation, alongside existing `db.json` identities and `state-<uid>.json` personal data. Keep one API process on a persistent local disk. No new database service or ORM.

**Rationale:** Transactions and uniqueness constraints are needed for single-use invitations, one active trainer, frozen workout prescriptions, retry-safe results, and fee audit events. Source inspection found `PUT /api/data` replaces an entire client-controlled JSON document. Coaching authority cannot live in that document.

The pinned package supports Node >=22 and includes Linux musl x64/arm64 targets; upstream builds use Node 22 Alpine. Implementation must still prove native import, write, reopen, and container startup on the deployment architecture. Node 22's built-in SQLite API remains experimental in its documentation.

Use one connection, prepared statements, short synchronous transactions, `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=FULL`, and a 5,000ms busy timeout. Use immediate transactions for read/validate/write operations. Do not await network work or write identity JSON inside a SQLite transaction. A busy database returns a retryable error; it must not acknowledge an unsaved write.

**Alternatives considered:** Another JSON file would require custom transactional recovery and uniqueness enforcement. PostgreSQL adds deployment work unnecessary for the proposed 5–10-client pilot. Built-in `node:sqlite` would introduce an experimental API dependency on the retained runtime.

Sources: [pinned package](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/package.json), [Alpine build workflow](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/.github/workflows/build.yml), [database API](https://github.com/WiseLibs/better-sqlite3/blob/v13.0.3/docs/api.md), [Node 22 SQLite](https://nodejs.org/docs/latest-v22.x/api/sqlite.html), [SQLite WAL](https://www.sqlite.org/wal.html), [synchronization modes](https://www.sqlite.org/pragma.html#pragma_synchronous).

## 3. Roles, invitations, and consent

**Decision:** Use existing passkeys and signed sessions. Add operator-controlled `TRAINER_UIDS`, independent of `ADMIN_UIDS`. A trainer configures their display name, business time zone, and optional WhatsApp number. An account may have trainer and client capabilities; navigation only exposes capabilities returned by the server. Self-invitation is rejected.

Use a 32-byte random invitation token, store its hash, expire it seven days after creation, and share `/#/join/<token>`. A preview reveals only trainer identity and consent text. Explicit authenticated acceptance creates the relationship and consumes the invitation in one SQLite transaction.

For invite-only deployments, a valid coaching token may admit one new passkey account without a separate admin signup code. Persist its admission hash and created UID atomically with that account and credential in existing `db.json`. Admission is not coaching consent and does not consume the coaching invitation. Recheck validity at registration verification and acceptance. An interrupted flow leaves a recoverable unlinked account; the user signs in and confirms sharing. Never promise a transaction across JSON and SQLite.

**Rationale:** Existing signup consumes admin invitations in the same JSON save as the account (`api/server.js`). Keeping coaching acceptance separate preserves explicit consent and supports existing accounts. Token hashes and body-only lookup avoid token logging in request URLs.

**Alternatives considered:** Turning trainers into administrators exposes app-wide user data. Self-assigned roles are unsafe. Auto-linking on registration omits consent and makes partial failures difficult to recover.

## 4. Workout starts, offline results, and personal history

**Decision:** An assigned session starts online, in a transaction that selects the current occurrence revision and freezes its complete prescription. Continuing and finishing that session work offline. Personal workouts can still start offline. A client with no connection and no already-started assigned session sees a clear reconnect action and can use personal logging.

This deliberately avoids guessing whether an offline start happened before a trainer revision. The full snapshot includes skipped exercises and target values, while actual entries use the existing logger format. Bypass automatic progression for assigned targets; additional exercises and adjusted loads are actual deviations.

Finish writes a durable, authenticated-UID-scoped outbox entry before clearing the active session. A stable session ID identifies upload retries. The server owns the snapshot and accepts actual results only. Reusing an ID with identical data returns the stored result; different data conflicts. Reload and login recover pending uploads. Account switching never replays another user's queue.

SQLite is authoritative for assigned results. Merge its records into personal history by workout ID on server reads and frontend reconciliation, with one entry per session. Legacy JSON uploads and imports cannot edit, delete, or replace authoritative assigned records. Retain current personal workout editing/import behavior for unassigned records. Existing personal whole-state conflict resolution is not redesigned; this feature's stronger preservation guarantee applies to assigned sessions and coaching records.

**Rationale:** `useStore.js` selects whole state by device `_ts`; `sheets.jsx` applies personal progression on start and removes wholly skipped exercises on finish. A separate snapshot and result authority close those specific gaps without rewriting the logger.

**Alternatives considered:** Offline starts from cached prescriptions cannot guarantee the latest trainer instructions. Storing completed results only in the personal blob lets a stale device erase them. A full migration of all personal state is unnecessary for this release.

## 5. Stable schedule and time semantics

**Decision:** One current recurring weekly workout plan per relationship, with stable slot IDs and immutable published revisions. Materialize dated occurrences for today through the next 28 days. Before relevant reads, starts, or publication, extend from the last materialized date, including missed dates after downtime, before applying new changes. This preserves the version that governed elapsed days without requiring a new worker service.

An occurrence's ID remains stable when an upcoming session moves. Future unstarted occurrences may change; past dates and started sessions are frozen. Removing an upcoming occurrence marks it canceled rather than deleting it. Explicit date moves are occurrence overrides and survive general plan edits unless explicitly reset. The recurrence key remains the original week and slot, even when the scheduled date moves across weeks.

Use Monday–Sunday weeks and the relationship's time-zone snapshot. Existing relationships retain that zone if the trainer later changes their profile. Clients see the business date/zone when it differs from device local time. Count each occurrence at most once, only after a submitted session contains at least one completed set. A partial completion is labeled; zero-set finishes do not satisfy completion. Personal sessions and extra attempts are separate.

**Alternatives considered:** Recalculating historical schedules from only the current plan changes past completion counts. Requiring a trainer to republish every week adds recurring work. Push reminders should resolve an assigned occurrence first and avoid duplicating the existing personal reminder.

## 6. Progress, check-ins, and contact

**Decision:** Read personal workout/weight history through a narrow authorized adapter, combine it with canonical assigned sessions, and reuse existing strength calculations. Return only necessary history fields, never account credentials, AI settings, or the entire personal-state document. Track successful personal-sync receipt time on the server separately from device timestamps and assigned-result receipt time.

Use one check-in per relationship/week with a monotonically increasing version. One editable response records the exact check-in version reviewed. Editing the check-in makes the response stale without deleting it. Weight in a check-in is a separate source, never silently duplicated into the editable personal weigh-in log.

WhatsApp remains a user-initiated external link with no message prefill, plus a visible copy-number fallback. No in-app chat, background messaging, or conversation notifications.

**Alternatives considered:** Reusing administrator routes exposes unrelated users. Treating diet views as adherence or missing weight as zero produces false progress. Chat infrastructure and food logging are deferred by the agreed scope.

## 7. Fees and operational choices

**Decision:** Record positive integer minor-unit amounts with currency metadata, covered dates, due date, and an HTTPS checkout URL. The pilot operator configures supported currencies and payment-link hostnames for the trainer's chosen provider before launch. Reject URLs containing credentials or unapproved hosts. Never fetch checkout URLs on the server.

Configuration: `TRAINER_UIDS` is a comma-separated list of existing account IDs; `COACHING_PAYMENT_HOSTS` is a comma-separated list of exact lowercase DNS hostnames without wildcards, paths, or ports; `COACHING_CURRENCIES` is a JSON object mapping uppercase three-letter currency codes to integer minor-unit exponents 0–3. Validate configured entries at startup. Missing payment configuration disables fee creation with a setup explanation, not the rest of coaching. The operator must verify currency/exponent values for the selected provider; this is configuration, not currency conversion.

Fee creation fixes its commercial details for this release. Incorrect unpaid fees can be voided with a reason and recreated; receipt errors use explicit audited corrections. Only the active linked trainer can confirm externally verified full receipt. An immutable fee event records each confirmation/correction/void with author and server time. Clients retain read access after unlinking, but archived fees have no actionable checkout link and no further trainer mutation.

**Rationale:** This completes collection tracking without storing card details or building a provider integration. Opening or returning from checkout never updates payment state. Fees cannot block training.

**Alternatives considered:** Webhooks, subscriptions, partial payments, refunds, tax invoices, and platform commissions expand the release. Provider, country, actual currency, contact number, and licensing/media verification are pilot setup inputs, not unresolved architecture decisions.

## 8. Deployment and recovery

**Decision:** Version coaching migrations and run them before serving requests. Fail on migration/corruption errors, never silently replace a database. Add new module/migration copies to `api/Dockerfile`, which currently copies only `server.js` and `coach/`. Preserve existing runtime isolation and optional AI behavior.

Back up before migrations and daily during the pilot. For a consistent whole-app backup, stop the API briefly and copy the complete persistent data directory, including identities, states, secret, SQLite, and sidecars. Keep backups protected and exercise a restore before enrolling clients. Database-only live backups use the SQLite backup API; copying only a live main database file is insufficient with WAL. No network filesystem or horizontal API replicas for this pilot.

**Alternatives considered:** A live single-file copy can omit committed WAL data. Rolling back just application code after accepting new coaching writes can hide newer data. Restore the full backup only with an explicit understanding that it discards changes since that backup; prefer fixing forward.

## 9. Reusable plan sources and exercise identity refinement

**Decision:** Present one source chooser with saved coaching templates, locally converted trainer personal routines, the built-in starter plan, and a bounded list of trainer-owned recent assignment revisions. Loading always produces an isolated draft. Do not auto-save every client-specific publication as a reusable template, because that would silently mix client customization into the trainer's library.

Use separate stable entry identity and catalog/custom exercise identity in new workout content. Built-in exercises resolve their names, metadata, thumbnails, and GIFs from the shipped catalog by ID. Custom/manual exercises copy bounded descriptive metadata into the immutable revision. The catalog index is immediately searchable, but media remains lazy-loaded; eagerly fetching the approximately 140MB media library is unnecessary and harmful.

**Rationale:** The personal app already contains the catalog, filters, animation components, custom-exercise path, personal routines, and starter PPL. The coaching editor currently creates a random ID beside a typed name, so even typing an exact catalog name cannot resolve media on the client. Saved coaching templates work only when the trainer explicitly created one, while a previously published plan is otherwise inaccessible from another client's editor.

**Alternatives considered:** Automatically creating a reusable template on every publish would clutter the library and blur template versus client-copy ownership. Sending image/GIF files or URLs in every plan revision duplicates static media and creates stale references. Using a name match as identity is ambiguous and breaks history/progress grouping.

## 10. Personal and coaching presentation refinement

**Decision:** Project the active server-owned assignment into Personal Home, Plan, and Start as a read-only overlay. Never copy it into `gym_state_v1`, `S.routines`, `S.week`, or `S.dayPlan`. Load bootstrap plus the active own workspace through one account-scoped refresh action on mount, focus, and every 30 seconds. Cached content may be read offline, but assigned start remains online-only.

When assigned and personal work share a date, show both and prioritize the assigned action without hiding the personal routine. An existing active workout always resumes first. Assigned completion continues through the current durable outbox and canonical history merge, with visible assigned/sync labels in personal history.

**Rationale:** The assigned logger and personal History/Stats integration already exist. The break is entirely before start: personal surfaces read only the personal Zustand store, while scheduled occurrences are loaded only on coaching routes. A read-only projection closes the navigation gap while retaining trainer authority and the client's independent plan.

**Alternatives considered:** Importing each assignment into the personal week would make trainer revisions indistinguishable from client edits and expose it to whole-state conflict resolution. Replacing Personal with Coaching would remove the default app journey and still leave the central Start behavior inconsistent.

## 11. Reversible occurrence operations and reconciliation refinement

**Decision:** Treat recurrence publication and one-off operations as separate layers. Publication reconciles the desired future recurrence set: add new rows, update mutable desired rows, and cancel obsolete rows with a reason while preserving past/started/completed data. Explicit moves retain the occurrence ID and override; Reset clears the override; explicit cancellation remains until the trainer chooses Restore. A plan-removed row may be reactivated when the same recurrence returns.

Add a trainer-only Restore mutation, surface canceled rows, make unchanged moves no-ops, and reject both already-materialized and predictable future-date collisions. Validate that no two plan days claim the same weekday. Catch up schedule state before publication, workspace reads, and assigned starts.

**Rationale:** Live validation found all nine `test_1` occurrences canceled and therefore absent from the editor's controls. Republishing could not recover them because reconciliation updates only scheduled rows. The same algorithm also leaves removed weekdays scheduled and can silently skip a natural occurrence after a far-future override collision.

**Alternatives considered:** Deleting canceled rows loses audit/stable identity. Automatically restoring explicit cancellations on every republish makes Cancel unreliable. Relying on the six-hour maintenance interval leaves reads and starts observably stale.

## Research completion

The original source review and research agents covered storage/runtime and auth/sync integration. The 2026-09-12 refinement added three focused source reviews plus live Safari and SQLite inspection of the trainer/client pilot state. Current baseline tests pass (83 API and 221 frontend), but the missing refinement scenarios are not covered yet.

All architectural unknowns are resolved above. Pilot configuration inputs and implementation validation remain explicitly listed in `quickstart.md`.
