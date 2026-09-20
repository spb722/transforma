# Data model: Trainer–Client Coaching MVP

Related documents: `spec.md`, `research.md`, `contracts/http-api.md`.

## Ownership and conventions

Existing account IDs and credentials remain in `db.json`; personal state remains in `state-<uid>.json`. The new entities below live in `coaching.sqlite` unless stated otherwise. Account IDs are validated against the existing identity store; SQLite foreign keys cover only coaching entities. No credential, session secret, or role comes from client personal state.

Use server-generated UUIDs for resources, client-generated UUIDs for retryable session/mutation IDs, UTC ISO timestamps, and `YYYY-MM-DD` business dates. Versioned records begin at version 1. Updates use an expected version and increment it atomically. Immutable JSON payloads are schema-validated and serialized consistently before comparing retry payloads. Money uses safe integer minor units plus currency/exponent; exercise loads and weigh-ins carry explicit units.

Operational bounds: names 1–100 characters, notes/responses at most 4,000 characters, at most 50 exercises per session, 50 sets per exercise, 20 weekly slots, 20 diet meals, and 500KB per coaching request. These are engineering defaults, not nutritional/training recommendations. Reject invalid values with field errors. Existing legacy data is not retroactively subjected to these new bounds.

## TrainerProfile

- `userId` primary key; `displayName`, `businessTimeZone` (valid IANA zone), nullable `whatsAppNumber` in normalized international form; `version`, `createdAt`, `updatedAt`.
- Trainer capability derives from operator `TRAINER_UIDS` and an enabled account. This row alone grants no privilege. Admin capability remains independent.
- Profile setup is required before creating invitations. Only this trainer edits the profile. Changing the zone affects new relationships, not existing week/date interpretation.

## Invitation and SignupAdmission

- Invitation: `id`, `trainerId`, unique `tokenHash`, `createdAt`, `expiresAt`, nullable `revokedAt`, `acceptedBy`, `acceptedAt`, `relationshipId`.
- Expiry is creation plus seven 24-hour days. Store no reusable plaintext token. Return the share link once; if lost, create another invitation and optionally revoke the old one.
- State is derived: pending, expired, revoked, or accepted. Pending can become revoked or accepted. An accepted invitation cannot be reused to create another relationship.
- A repeat acceptance by `acceptedBy` returns the original relationship, including its ended status; it never reactivates it. Others receive a generic invalid-invite response.
- SignupAdmission is an added collection in existing `db.json`: unique `tokenHash`, `createdUserId`, `createdAt`. Save with the new account and credential in one existing atomic JSON write. A coaching token admits at most one new account; an admitted user can sign in if acceptance is interrupted. This record grants neither sharing nor trainer status.

## ClientRelationship

- `id`, `trainerId`, `clientId`, `status` active/ended, `timeZone`, `consentVersion`, `consentTextSnapshot`, `consentedAt`, `startedAt`, nullable `endedAt`, `endedBy`, `version`.
- Partial unique index on `clientId` where status is active. Trainer and client cannot be the same account.
- Acceptance transaction validates enabled trainer/client, token state and expiry, and absence of another active trainer; then creates this row and marks the invitation accepted.
- End transaction materializes elapsed schedule first, records the ending, and cancels future unstarted occurrences. Trainer authorization ends immediately. Client ownership persists for received revisions, sessions, check-ins, and fees.
- New coaching edits require active status. The client may still submit results for their own previously started session after ending. Archived templates belonging to a trainer are not exposed; only client-delivered copies are retained.
- Rejoining creates a new relationship ID. The new trainer sees personal history under fresh consent, but never another relationship's private diets, check-in text, fee history, or contact details.

## PlanTemplate

- `id`, `trainerId`, `kind` workout/diet, `name`, validated `content`, `version`, timestamps, nullable `archivedAt`.
- A workout template contains stable `slotId` values, weekday 1–7, title, ordered exercises, targets, rest, and notes. Each exercise has a stable `entryId` distinct from `exerciseId`, where `exerciseId` identifies a built-in catalog or trainer custom exercise. It also carries copied name, mode reps/time/cardio, applicable targets, rest, notes, and bounded custom metadata when the exercise is not in the shipped catalog.
- A diet template contains ordered meals, portion text, and notes. It has no adherence or calorie-calculation behavior.
- Edit or archive affects future copies only. Never share a mutable template reference as the client's received plan. Custom exercise descriptions are copied into delivered content so another user's local exercise catalog is not required.

### WorkoutPlanSource projection

This is a read model, not a new authority table. It gives the trainer editor a common source shape:

- `sourceType`: `saved_template`, `personal_plan`, `starter_plan`, or `recent_assignment`.
- `sourceId`: template/revision ID or a client-generated local key; `name`; optional `clientLabel`; optional `publishedAt`; normalized workout `content`.
- Saved templates and recent assignments are returned only to their owning trainer. Recent assignments contain prescription content and display metadata only, never client results, check-ins, weights, or fees.
- Personal/starter sources are converted locally. Conversion generates fresh slot/entry IDs, maps JavaScript Sunday `0` to ISO weekday `7`, resolves built-in catalog IDs, copies custom metadata, and applies explicit unit/rest defaults.
- Loading a source deep-clones it into a draft. Only a saved-template source can set `sourceTemplateId` when publishing; editing or publishing never mutates the source.

## PlanAssignment and PlanRevision

- Assignment: `id`, `relationshipId`, `kind` workout/diet, nullable `sourceTemplateId`, `currentRevisionId`, `version`, timestamps.
- Unique `(relationshipId, kind)` gives one current workout plan and one current diet. Revision history retains previous received content.
- Revision: `id`, `assignmentId`, increasing `revisionNumber`, immutable `content`, `publishedBy`, `publishedAt`.
- Publishing copies and validates all content, inserts a revision, updates the current pointer, and reconciles future workout occurrences in one transaction. Replacing the recurring source is an update of the current assignment: mutable future rows are matched by their stable original business date even when the new source has different day IDs, obsolete rows are retired before new rows are inserted, and only the replacement schedule remains operational. A stale expected assignment version conflicts, rather than overwriting another edit.
- Initial workout publication takes effect today for unstarted sessions. Existing started sessions and past business dates retain their original content. Diet publication changes the current view immediately, displaying `publishedAt`.

## WorkoutOccurrence

- `id`, `assignmentId`, `relationshipId`, `slotId`, `originWeekStart`, `scheduledDate`, `revisionId`, `status` scheduled/canceled, nullable `dateOverride`, nullable `prescriptionOverride`, `overrideUpdatedAt`, `lockedAt`, `canceledAt`, `version`. Existing implementations may encode the same recurrence identity as `dayId:originalDate`; normalization must preserve existing IDs.
- Unique `(assignmentId, slotId, originWeekStart)` is the recurrence identity. A move changes scheduled date, never ID or recurrence identity. Keep a lightweight append-only occurrence change record with old/new date, revision, status, actor, and time.
- Materialize through today + 28 days. Track `materializedThrough` on workout assignments. Extend all missing elapsed dates using the previously current plan before processing a publication or ending. Publish reconciles only today/future unstarted rows. No read can recalculate a past row from the latest template.
- The first online start locks the date and prescription revision. Later attempts on that occurrence use that frozen prescription. Moves/cancellation/revision of locked or past occurrences return a conflict. Removed future slots are canceled with a `plan_removed` event; added slots receive new identities. A recurrence canceled because it was removed may return to scheduled when that same slot returns in a later revision. An explicitly trainer-canceled row remains canceled until Restore.
- Move retains the same ID, sets `dateOverride`, and records old/new dates. Reset clears the override and returns to `originalDate`. Restore retains the same canceled occurrence ID and returns it to scheduled on its retained or explicitly chosen future date after version, relationship, mutability, and collision checks. Every state change is audited; an unchanged move is not a state change.
- A one-day edit stores a validated `prescriptionOverride` on the occurrence without changing the recurring assignment or reusable template. Reads and session start expose/freeze the override as the effective prescription. Publishing a new recurring revision updates the underlying prescription while preserving the one-day override; **Return workout to plan** clears only that override and immediately uses the latest recurring prescription. Day off, restore, and date changes retain the override. Started, completed, and past rows cannot be customized or reset.
- When a replacement source changes day IDs, future moves and one-day prescription overrides that still belong to a replacement date remain on the reused occurrence and are rebased to the new plan/day identity. Explicit days off remain only when their recurring day identity still exists; obsolete cancellations become internal `plan_removed` history. Completed, started, and past occurrences are never rewritten to resemble the new plan.
- Publication and on-demand catch-up reject duplicate weekday ownership and date collisions rather than silently omitting an occurrence. A destination outside the materialized horizon is checked against the current recurrence before a move is accepted.
- Denominator for a selected week counts noncanceled occurrences by their stored scheduled date. Numerator counts distinct occurrence IDs with at least one finished session containing a completed set. Partial sessions are visibly partial; extra attempts never inflate the count. A rest day has no occurrence; a missing plan is a separate UI state.

## AssignedSession

- `id` supplied once by the client, `clientId`, `relationshipId`, `occurrenceId`, `revisionId`, immutable `prescriptionSnapshot`, `scheduledDateSnapshot`, `timeZone`, `unit`, `startedAt` server time, `state` started/finished/abandoned.
- Snapshot contains the complete ordered prescription, exercise names/references, applicable targets, rest, and notes. It survives deleted templates/catalog entries and includes wholly skipped exercises.
- Nullable terminal fields: `clientFinishedAt`, `receivedAt`, `actualWorkout`, canonical `resultHash`. Actual workout uses existing `id`, `d`, `start`, `end`, `name`, `bw`, `entries`, `prs`, and `vol` shape, with explicit unit. Treat client time and calculated values as reported data; compute summary totals on the server.
- Online start checks the active relationship and current occurrence in one transaction. Identical start-ID retries return the existing snapshot. A start ID cannot be rebound to another occurrence/user. The client does not supply trusted prescription targets.
- Client submits actual sets or abandons the session. First terminal submission wins; identical repeats return it, conflicting reuse returns 409. Trainer cannot write actuals. Terminal results and snapshots are immutable in this release.
- History projections prefer this canonical record over a same-ID personal JSON entry. Removing an assigned entry from a legacy upload does not delete it. Existing history delete/edit controls apply only to personal entries; assigned records are labeled read-only after synchronization.
- Distinct session IDs represent distinct attempts. Keep all received results; count the occurrence once. Zero-set finish remains visible without counting as completed.

## Client-local coaching envelope

Browser storage, not SQLite: `coaching_v1_<authenticated UID>` contains a bounded own-plan cache and durable pending finish/abandon operations. The existing active workout retains its session ID and full snapshot. No trainer-wide client list/history is persisted in this envelope.

Persist the terminal operation before clearing active or updating the personal history projection. Recover projections from the outbox after a crash. Remove a queued operation only after matching server acknowledgement. A storage failure leaves the active session intact and explains that it has not been saved. A 401 pauses retry until the same owner signs in; 409 preserves the local payload for explicit resolution. Do not discard pending work automatically on logout. Never render or upload another account's envelope.

## WeeklyCheckIn and CheckInResponse

- Check-in: `id`, `relationshipId`, `clientId`, `weekStart`, `adherence` mostly/partly/not_followed/not_applicable, nullable `weightValue` and `weightUnit`, `notes`, `version`, `submittedAt`, `updatedAt`.
- Unique `(relationshipId, weekStart)`. Week start must be Monday in the relationship zone; allow this week and earlier weeks during the relationship, never future weeks. Write only while the relationship is active. Weight, when supplied, must be finite and positive with a supported unit; blank remains missing.
- Response: `checkInId` primary key, `trainerId`, `text`, `reviewedCheckInVersion`, `version`, `createdAt`, `updatedAt`.
- `needsReview = no response OR reviewedCheckInVersion != checkIn.version`. Updating a check-in preserves the previous response and makes it stale. Responding to a stale check-in version returns a conflict so an unseen update cannot be marked reviewed.
- Check-in weight stays its own source. Progress can display both sources but does not average conflicting same-day reports or insert duplicate personal weigh-ins.

## Fee and FeeEvent

- Fee: `id`, `relationshipId`, `trainerId`, `clientId`, `amountMinor`, `currency`, `currencyExponent`, `periodStart`, `periodEnd`, `dueDate`, `timeZone`, `paymentUrl`, `status` unpaid/paid/void, `version`, `createdAt`.
- Validate positive safe integer amount; supported configured currency; period end >= start; valid calendar dates; approved HTTPS hostname without credentials; URL <=2,048 characters. Date strings are interpreted in the stored zone.
- FeeEvent: `id`, `feeId`, `actorId`, `kind` created/confirmed/corrected/voided, `previousStatus`, `newStatus`, nullable `paidDate`, `reason`, immutable fee amount/currency snapshot, `recordedAt`, unique `mutationId` scoped to actor.
- Unpaid -> paid requires explicit trainer confirmation and paid date no later than the current business date. Paid -> unpaid requires a nonblank reason. Unpaid -> void requires a nonblank reason. To correct an erroneous paid date, reverse with a reason and confirm again. No direct event edits or deletion.
- Repeating an identical mutation returns its recorded result; reusing the ID with changed content conflicts. Confirming an already-paid fee returns the existing confirmation without another event. New confirmation after a reversal requires a new mutation ID and current fee version.
- Fee row update, event insertion, and idempotency receipt are one transaction. Clients can never confirm, correct, void, or change commercial details.
- Overdue is derived only for unpaid fees when business date > dueDate. Opening checkout has no state transition. Ended relationships retain ledger history with archived actions disabled; refunds/disputes and further settlement happen externally.

## SyncReceipt and MutationReceipt

- SyncReceipt: `clientId` primary key, nullable `personalStateReceivedAt`, `assignedResultReceivedAt`. Set from server time after successful corresponding persistence. If JSON succeeds but sync-metadata persistence fails, the request is not acknowledged as fully successful; retry is safe. Never use client `_ts` as a server receipt.
- Migration initializes unavailable personal receipt times as null, displayed as unknown. Do not invent a fresh sync time merely by reading old files.
- MutationReceipt: `(actorId, mutationId)` unique, operation/resource identity, canonical request hash, saved response, `createdAt`. Record with relevant SQLite mutation. Invitation creation saves only safe metadata, never its token/share URL; replay instructs replacement if the original link was lost. Check current authorization before returning a replayed response, particularly after relationship ending.

## Access, migration, and recovery invariants

Every resource query scopes by authenticated identity and relationship. An active linked trainer can read necessary personal history and that relationship's coaching records. A client reads only their own records, including ended relationships. Templates remain owner-only. Administrator capability does not implicitly make an account a trainer.

Migrations create new tables/indexes and lazily create profiles; do not rewrite existing personal workouts, credentials, or account IDs. The registration admission collection is additive and defaults empty on older identity files. Schema versions are recorded transactionally; any migration failure prevents serving requests. Restore validation covers identities, sessions, personal history, frozen targets, pending-result replay, and fee events together.
