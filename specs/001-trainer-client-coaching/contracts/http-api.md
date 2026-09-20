# Coaching HTTP contract

Status: baseline routes implemented; 2026-09-12 refinement routes and behavior remain proposed. Base path: `/api/coaching`. See `../data-model.md` for payload fields and invariants.

## Common behavior

Reuse the existing `gymsid` session and same-origin JSON transport. Do not create a second authentication system. Require `Content-Type: application/json` and the configured application Origin for mutations; reject mismatched/missing browser mutation origins. Do not enable cross-origin access. Public invite preview and registration remain bounded and rate-limited. All responses use `Cache-Control: no-store`; the service worker continues bypassing `/api/`.

Authenticate before object lookup. Scope every query to the user and permitted relationship, including mutation retries. Never trust body-supplied trainer/client IDs as authority. Unknown and unrelated object IDs both return 404. A valid account without a required capability gets 403 on capability-wide operations. Archived owner reads remain available; ended-trainer reads/mutations are denied.

Success envelope: `{ "data": ..., "serverTime": "UTC ISO timestamp" }`. Errors: `{ "error": { "code": "...", "message": "...", "fields": { "field": "explanation" } } }`. Field errors are optional. Never return SQL, secrets, tokens, or raw personal state in errors/logs.

Status codes: 200 read/update/replay; 201 create; 400 malformed input; 401 missing/expired session; 403 forbidden capability/origin; 404 unavailable resource/invite; 409 stale version or conflicting state/ID; 413 request too large; 422 field validation; 429 throttled; 503 transient database/storage failure. 429/503 include `Retry-After` seconds. Preserve unsaved input for every failed mutation.

Every online coaching mutation carries a UUID `mutationId`, except session start/results, which use `sessionId` as their idempotency identity. Identical retries return the recorded result without another effect. Invitation creation is the one secret-bearing exception: retry returns safe creation metadata without the token. Reused IDs with different content return `IDEMPOTENCY_CONFLICT`. Replay requires current access; a former trainer cannot recover records using an old mutation ID. Check replay before expected-version comparison to allow a successful request to be retried after its version advanced.

Expected versions are mandatory on edits, publication, response, and fee-state changes. Creating an absent assignment/check-in uses `expectedVersion: 0`. Conflict response code `VERSION_CONFLICT` tells the UI to reload before resubmission; never silently apply last-write-wins.

List endpoints accept opaque `cursor` and `limit` (default 50, maximum 100) and return `{items,nextCursor}`. Client workspace/progress accepts `weekStart` (Monday, default current business week); history accepts `from`, `to`, and pagination, maximum 366-day range per request. No unrestricted cross-user export endpoint is added.

## Identity and onboarding

`GET /api/me` retains its existing `{user:{id,name,admin}}` shape and additively includes `capabilities:{trainer,client}`. `GET /api/coaching/bootstrap` returns trainer profile/setup status, current relationship summary, owned archived relationship summaries, supported currency metadata, server time, and allowed navigation modes. It never returns invitation tokens or all users.

- `PUT /profile`: trainer only. Body `{mutationId, expectedVersion, displayName, businessTimeZone, whatsAppNumber}`. Normalizes contact or stores null. Initial profile creation uses version 0.
- `POST /invitations`: configured trainer only. Body `{mutationId}`. Returns `{id,shareUrl,expiresAt}` once. Store only safe creation metadata in the mutation receipt. If the response/link is lost, replay returns `{id,expiresAt,linkUnavailable:true}` without creating a second invitation; the UI can revoke it and generate a replacement with a new mutation ID. Lists never expose tokens.
- `GET /invitations`: owner-only list of IDs, state, expiry, acceptance summary, and creation dates.
- `POST /invitations/revoke`: owner only. Body `{mutationId,invitationId}`. Pending -> revoked; repeat revoke is safe. Accepted invitations cannot be revoked to end an existing relationship; use end below.
- `POST /invitations/preview`: public bounded lookup. Body `{token}`. Returns trainer display name, expiry, consent text/version, and whether authentication is required. No client data. Invalid/expired/revoked/used tokens return a generic unavailable result; an authenticated successful recipient may receive their original relationship summary.
- `POST /invitations/accept`: authenticated user. Body `{mutationId,token,consentVersion,confirmSharing:true}`. Returns relationship plus next route. Validate current consent text version, trainer availability, expiry, one active trainer, and not self-invitation. Atomically insert relationship and consume token. `ALREADY_LINKED` is a 409 with the caller's own current relationship summary. Successful recipient revisits return the original relationship, never silently reactivate an ended one.
- `POST /relationships/end`: either party. Body `{mutationId,relationshipId,expectedVersion}`. Returns ended summary. Client records remain accessible. Replay is allowed for the party that ended it but returns only the non-sensitive ending receipt, not revoked records.

### Existing registration integration

`POST /api/register/options` gains optional `coachingToken`. A valid token can satisfy invite-only admission; ordinary admin signup-code behavior remains supported. Bind its hash to the existing registration challenge. `POST /api/register/verify` rechecks invitation validity and one-account admission before saving the new account, credential, and SignupAdmission together. Never accept client-supplied consent as part of WebAuthn verification.

After successful registration, return the normal signed-in user and resume the pending join screen. Relationship acceptance is a separate authenticated request. If the process stops after account persistence, that account can sign in and retry. If the invitation becomes unavailable before acceptance, the account remains unlinked and keeps its own data. An already-admitted token does not create another account; instruct the user to sign in. Rate-limit both invitation lookups and passkey admission; proposed per-IP limits are 30 previews/minute and 10 registration attempts/10 minutes, with a further five registration attempts/token/10 minutes. Apply trusted proxy configuration when deriving client IP; never trust arbitrary forwarded headers.

## Trainer overview and client workspace

- `GET /overview?weekStart=...`: trainer only. Paginated own active client summaries: display name, completed/scheduled counts, partial/extra sessions, last workout, personal/assigned sync timestamps, missing/needs-review check-in, unpaid/overdue fee count and totals grouped by currency. Empty list is valid. No global administrator data.
- `GET /workspace?relationshipId=...&weekStart=...`: linked trainer or owning client. Catch up the relationship schedule before returning relationship, received current plans, dated occurrences, weekly check-in/response, fee summary, and contact availability. Ended relationships return owner-only archived data with actions disabled.
- `GET /progress?relationshipId=...&from=...&to=...`: same read rule. Scheduled/completed counts, partial/extra sessions, existing strength series, weight series labeled by source/unit, last workout, sync times, and explicit missing-data flags. Do not count diet reads as adherence. Never add totals across currencies or compare loads without compatible units.
- `GET /history?relationshipId=...&from=...&to=...`: authorized, paginated minimal workout details and frozen assigned targets. Combine personal entries and canonical assigned entries by session ID; omit unrelated personal-state fields. Archived client can still read their own history; trainer cannot.

## Templates and publication

- `GET /templates?kind=workout|diet`: trainer-owned templates only.
- `GET /plan-sources?kind=workout&limit=20`: trainer only. Returns bounded current/recent published workout revisions owned through that trainer's relationships, with source/revision ID, plan name, client display label, publication time, and immutable content. It returns no results, check-ins, weights, fees, or another trainer's plans. Saved templates remain available through `/templates`; personal and starter sources are client-side adapters.
- `POST /templates`: `{mutationId,kind,name,content}` creates a reusable template.
- `PUT /templates`: `{mutationId,templateId,expectedVersion,name,content,archived}` edits or archives the owner's template. Existing received copies are unaffected.
- `POST /plans/publish`: `{mutationId,relationshipId,kind,expectedVersion,sourceTemplateId?,content}`. Only active linked trainer. Validate submitted client-specific copy; insert immutable revision and return assignment/current revision and updated occurrences. Initial publication uses version 0. Publishing another workout source replaces the mutable future schedule in the same assignment, including when the source uses new day IDs; it does not append a second operational schedule. Template existence never substitutes for ownership checks. One current assignment per kind.
- `POST /occurrences/move`: `{mutationId,occurrenceId,expectedVersion,scheduledDate}`. Active trainer only; today/future unstarted occurrence and destination only. Retain ID and recurrence identity, set date override, return updated row. Reconcile destination window before saving to prevent duplicate generation.
- `POST /occurrences/cancel`: `{mutationId,occurrenceId,expectedVersion}`. Active trainer only; today/future unstarted occurrence only. Retain canceled row and its change event. A locked/past occurrence returns `OCCURRENCE_LOCKED`.
- `POST /occurrences/restore`: `{mutationId,occurrenceId,expectedVersion,scheduledDate?}`. Active trainer only; explicitly canceled today/future unstarted occurrence only. Restore the same ID on its retained date or supplied valid future date, reject an occupied or naturally conflicting date, increment the version, and append a `restored` event. Plan-removed rows are controlled by recurrence reconciliation rather than this action.
- `POST /occurrences/customize`: `{mutationId,occurrenceId,expectedVersion,prescription}`. Active trainer only; today/future unstarted occurrence only. A validated workout prescription replaces the effective prescription for this occurrence only. `prescription:null` clears the one-day override and returns the occurrence to the latest recurring prescription. The mutation retains occurrence identity/date, increments the version only for a real change, and appends `customized` or `customization_reset` history.

Workout plan content uses separate stable `entryId` and catalog/custom `exerciseId`. Built-in metadata is resolved by shipped catalog ID. Custom content includes bounded copied display metadata. During transition the server normalizes legacy entries containing only `id` and `name`; it never performs fuzzy name matching to invent catalog identity.

Publication catches up elapsed rows under the previous revision, rejects duplicate weekday ownership, then reconciles the current business date through +28 days. It matches mutable rows by original business date so a source with fresh day IDs can replace the old schedule in place, retires obsolete active rows before inserting newly desired dates, updates desired base prescriptions, and may reactivate rows previously canceled only because the recurrence was removed. Relevant date and one-day prescription overrides are retained and rebased to the replacement plan; explicit cancellations survive only while their recurring day identity remains. Past rows and started/completed snapshots are preserved. Repeated reads do not change occurrence versions. An unchanged Move returns the existing row without an event/version bump; `scheduledDate:null` resets a date override to its original date.

The template/publication UI supplies an explicit reset when changing an occurrence date override back to recurrence; `move` accepts `scheduledDate:null` for this purpose after validating the resulting day is still mutable. Client plan edits through these routes are always forbidden.

## Assigned sessions

`POST /sessions/start`, client owner only:

```json
{
  "sessionId": "client-generated-uuid",
  "occurrenceId": "server-occurrence-id",
  "expectedOccurrenceVersion": 3
}
```

Requires connection and active relationship. Transactionally validate/current-version-check the occurrence, freeze its prescription/date if first start, and insert the started session. Only occurrences scheduled today in the relationship zone can start in this release; personal workouts remain available on other dates. Return `{sessionId,state,startedAt,occurrenceId,revisionId,prescriptionSnapshot,scheduledDate,timeZone,unit}`. A repeated identical start returns the original snapshot. If start succeeded but response was lost, retry this same ID before creating another attempt. A stale occurrence prompts refresh, not a silent start from old targets.

`PUT /sessions/result`, client owner only:

```json
{
  "sessionId": "same-client-generated-uuid",
  "state": "finished",
  "clientFinishedAt": "2026-09-07T07:15:00.000Z",
  "actualWorkout": {
    "id": "same-client-generated-uuid",
    "unit": "kg",
    "entries": [
      {"id": "0001", "sets": [{"w": 20, "r": 10, "done": true}]}
    ]
  }
}
```

Example abbreviates the existing workout fields described in the data model. No submitted prescription/target value changes the server snapshot. Validate finite nonnegative actual quantities, supported modes, and request bounds. Compute summary values from accepted actuals. `state:"abandoned"` omits actual workout. Return canonical session, `receivedAt`, and completion classification. A finished empty workout is retained and classified as zero completed sets. The owner may upload an already-started session after unlinking without reopening trainer access.

`GET /sessions?relationshipId=...&cursor=...` returns owner's or active trainer's started/terminal sessions for recovery/history. A server start record preserves targets, not unsent actual sets from another device; do not imply cross-device live-workout synchronization.

No generic assigned-result edit/delete route exists. The UI preserves unsynced conflicting local payloads instead of dropping them. Multiple attempts with different IDs remain visible and count at most once per occurrence.

## Check-ins

- `PUT /check-ins`: client only. `{mutationId,relationshipId,weekStart,expectedVersion,adherence,weightValue?,weightUnit?,notes}`. Upserts exactly one weekly record, returns new version plus existing response and `needsReview`. An unchanged retry does not increment version twice.
- `PUT /check-ins/response`: active trainer only. `{mutationId,checkInId,expectedVersion,reviewedCheckInVersion,text}`; expectedVersion is response version (0 for first response). Check that the submitted reviewed version is still current, then save one response. Stale client edits or concurrent trainer responses return 409.

Check-in retrieval is part of workspace/progress. It exposes self-report values and response timestamps, never a chat thread. Editing after review retains the previous response and resets review state.

## Fees

- `GET /fees?relationshipId=...`: own active/archived client or active trainer; paginated fees with derived overdue status and audit events.
- `POST /fees`: active trainer only. `{mutationId,relationshipId,amountMinor,currency,periodStart,periodEnd,dueDate,paymentUrl}`. Uses configured currency exponent and relationship zone; returns new unpaid fee.
- `POST /fees/confirm`: `{mutationId,feeId,expectedVersion,paidDate,receiptVerified:true}`. Active trainer explicitly attests to external full receipt. Atomically record event and paid state. Already paid with the same recorded paid date returns the current confirmation without duplicating it; a different proposed date requires a correction.
- `POST /fees/correct`: `{mutationId,feeId,expectedVersion,reason}`. Active trainer; paid -> unpaid with retained event history. No silent replacement of prior confirmation.
- `POST /fees/void`: `{mutationId,feeId,expectedVersion,reason}`. Active trainer; unpaid -> void. Commercial fields cannot be silently rewritten. Correct details by voiding and creating a replacement.

There is no checkout-success endpoint, provider webhook, automatic recurring charge, or client payment-confirmation endpoint. Visiting any arbitrary return URL changes nothing. Fee state is never part of workout authorization.

## Existing personal data contract

Keep `GET /api/data` and `PUT /api/data` request/response compatibility. Ignore incoming attempts to set roles/coaching authority. Preserve the existing device `_ts` behavior for personal state. On GET, merge server-owned assigned results into returned `state.workouts` by ID, with canonical values winning. On PUT, incoming copies cannot alter the SQLite result or frozen target. The updated frontend also reconciles canonical results independently even when its personal `_ts` wins.

After successful personal persistence, record a server receipt and expose it through coaching progress. Assigned-result receipt is separately labeled so unsynced personal weight/history is not implied fresh. Imports/exports preserve assigned identifiers/snapshots; importing an assignment-looking object never manufactures an authorized relationship or server result.

## External browser actions

WhatsApp: normalize the configured international number, open an external chat URL only on client action, omit message text, and provide copy-number fallback. Opening failures cannot always be detected, so the fallback remains visible.

Checkout: client explicitly opens the validated fee URL in a new tab with opener/referrer isolation. Show the external hostname before leaving. Keep fee unpaid until trainer confirmation; on return refresh the record without a success assumption. Archived, paid, or void records do not offer Pay now. Never include medical information in URL parameters generated by the app.
