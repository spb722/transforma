# UI and synchronization contract

Reference: approved `design/coaching-prototype/DESIGN.md`; implement in existing `frontend/`, not the standalone prototype.

## Navigation and layout

Retain the existing HashRouter and personal logging routes. Add public `/#/join/:token`, trainer `/#/studio` and `/#/studio/clients/:relationshipId`, and client `/#/coaching`. Trainer template/check-in/fee sections live under studio; client workout/diet/progress/fee sections live under coaching. Exact section components may share the client workspace, but authorization is always server-side.

Trainer home leads with client review needs and Invite client. Client coaching home leads with today's assigned workout, then diet, weekly check-in, and outstanding fees. The active assignment is also projected into Personal Home, Plan, and Start so the client does not have to discover a second silo before training. While a coach plan is active, these surfaces offer only its read-only plan and schedule; personal planning, AI plan generation, routine starts, and freestyle are hidden while personal history and settings remain reachable. Personal data is preserved and its controls return when no coach plan is active. A person with both server-granted capabilities may choose studio or their own coach-managed training; no demo-style arbitrary role switch.

Adapt the prototype's appearance to existing preference/theme infrastructure. Use consistent focus styles, semantic buttons, labeled inputs, readable error text, and at least 44px primary tap targets. At 320px and 390px, stack dashboard cards and use compact navigation; no page-level horizontal overflow. Keep primary workout actions accessible with the mobile keyboard open. Tables become cards where necessary. Dialogs trap focus, restore it on close, and remain scrollable on short screens.

## Joining and ending

Preserve join intent through passkey sign-in/registration using same-tab session storage. Display trainer name and the exact sharing disclosure before acceptance: existing workout/weight history plus records for this coaching relationship. A checked consent control and Join action trigger the authenticated save. Never display linked success before its response.

On an expired/used/revoked link, explain how to request a new one. On an interrupted new-account flow, offer sign-in with the newly created passkey. Existing history must be visible after acceptance. Ending coaching is an explicit action by either party with a concise explanation of trainer access removal and retained client records. The client can open archived records afterward.

Trainer client data is held in memory only. Revalidate on focus/navigation and every 30 seconds while a workspace is visible. On access denial remove the displayed data and route to the appropriate home. Server denial applies immediately on every request; already rendered information cannot be recalled from a previously authorized viewer.

## Workout flow and save states

1. Client opens today's occurrence and selects Start. Fetch/freeze the current prescription online before constructing active state. From home this is at most two actions in the normal path. If disconnected, explain that assigned starts need a connection; do not offer a personal replacement while the coach plan is active.
2. Build the existing workout logger from the complete returned snapshot. Personal progression and prior loads do not replace targets. Keep target and actual distinct, including rest/time/cardio modes and added/skipped exercises.
3. Continue logging in existing local active state while offline. Finish first writes the result to the UID-scoped durable outbox; only then clear active and display the local history entry. A storage failure keeps active work and an actionable error.
4. Show **Saved on this device, waiting to sync** until the server acknowledges that session. Only then show **Synced** and its receipt time. Network errors keep a retry action; authentication expiry requests same-owner sign-in without discarding results.
5. Reconcile acknowledged results and existing history by ID. A reload between any two steps must recover one history entry, not lose the workout or duplicate completion. A conflicting payload stays locally recoverable with a clear error.

Handle zero-set finish as an empty recorded attempt and partial finish as partial. Neither can display all targets completed. Do not apply fee restrictions to any logger/history path. Synchronized assigned sessions are read-only; personal-session controls retain their existing behavior.

## Trainer workout composer

The empty editor begins with a **Choose a starting point** control: Saved templates, My personal plan, Starter Push/Pull/Legs, Recent assignments, or Blank plan. Each option shows a compact preview before replacing the current draft; replacing a dirty draft requires confirmation. A loaded source is copied, and changes remain local until the trainer explicitly saves a template or publishes to the client.

**Add exercise** opens the shared catalog picker used by the personal app: search, body-part filter, equipment filter, thumbnail, animation/detail preview, and trainer custom exercises. Choosing a catalog entry preserves catalog identity and derives its default mode; Timed remains an explicit option. **Custom/manual exercise** is always available when nothing fits. Do not eagerly download all exercise media.

Saved templates support Save as new, Update, and Archive with version-conflict handling. Recent assignments are trainer-owned prescription sources only; their client history is never shown in the picker. The editor preserves plan unit, exercise order, targets, per-exercise rest, and notes. Client logging renders the assigned unit, rest, and notes rather than silently falling back to personal settings.

## Assigned schedule in Personal

- Home: today's eligible trainer assignment is the primary scheduled card with trainer/source labeling; assigned markers appear in the week strip. Resume an existing active session before offering any new start.
- Plan: show the complete read-only **Coach-assigned plan**, exercise prescriptions, and dated upcoming schedule. Hide the personal weekly schedule, routines, creation/share tools, and direct personal routine editor routes.
- Start: show today's assigned occurrence only. On a coach rest day, explain that no workout is scheduled and link to the coach schedule; do not offer personal routines or Freestyle.
- History/Stats: finished assigned work appears once with **Coach assigned** and `waiting to sync` or `synced`; synchronized entries remain read-only.

The assigned logger keeps actual weight/reps/time editable for honest performance tracking, but hides Add exercise, Add set, and Remove set. Leaving an assigned session preserves it for Resume instead of discarding its frozen prescription.

Assigned business dates use the relationship zone, while personal dates use the device zone. When they differ, display the business date and zone instead of silently treating them as the same day. Cached assignment content may render offline with a freshness label; starting a new assigned session still requires a server snapshot.

## Schedule management

When a workout assignment exists, lead with a compact **Current plan** summary and the schedule manager. Keep recurring-plan editing collapsed until the trainer chooses **Edit recurring plan** or **Use another plan**. Group the rolling horizon into Upcoming, Days off, and Past/locked.

- Each mutable upcoming row exposes one **Manage** control. Its actions are **Edit this workout**, **Reschedule**, **Give day off**, **Return to original date** when moved, and **Return workout to plan** when customized.
- **Edit this workout** reuses the exercise catalog/manual fallback and prescription fields, but removes recurrence controls and clearly states that only the selected business date changes.
- Future Days off rows expose **Restore date** and optional restore-on-selected-date. Past canceled rows are read-only.
- Disable only the row with an active save. Disable Move until the date changes. Preserve the attempted date and unsaved plan draft on 409/422, refresh the authoritative row version, and place the error beside that row.
- Publication explains its effect on future unstarted sessions. Choosing another source and publishing it replaces the old future schedule; only the new plan appears under Upcoming and on the client's assigned Plan. Customized, Rescheduled, and explicit Day off states use trainer-facing labels consistently across trainer and client views. Rows retained only as `plan_removed` audit history are not shown as operational Days off or as a workout for that date.
- Client views select relevant upcoming/history rows instead of blindly slicing the first database rows, so old or canceled entries cannot hide current work.

## Plans, check-ins, and fees

Trainer edits happen in a local draft. Publish is an online, explicit save with version conflict handling. Reusable template edits cannot change another client's copy. Publishing explains that future unstarted workouts change and already-started targets remain fixed. Display current diet update time and truthful no-plan states.

Check-in save is online. Use the four named adherence options, optional weight, and optional notes. Missing is not zero. A prior trainer response stays visible with its date when a client edit makes the check-in need review again. One editable response is the entire feedback interface; Contact trainer opens WhatsApp separately.

Fees show amount/currency, covered period, due date, and current status. Checkout leaves the app and has no automatic success state. Trainer confirmation explicitly asks whether receipt was verified externally. Corrections require a reason and retain visible history. Overdue highlights never obscure or disable training actions.

## Refresh, cache, and failure boundaries

Invitation acceptance, publication, check-in writes, and fee mutations require connectivity. Do not show optimistic persisted success. Own cached plan/diet views may remain readable offline with their last-refresh timestamp, but cannot start a new assigned session or authorize writes.

Keep all API responses out of service-worker caches. Key the own coaching envelope by authenticated UID; clear in-memory displays and pending invitation state on account changes. A single `refreshOwnCoaching()` loads bootstrap plus the active own workspace on mount, focus, and every 30 seconds, and clears stale workspace data when there is no active relationship or access is denied. Preserve unsynced workouts under their original owner rather than replaying or deleting them. Clear ordinary own-plan caches on logout; keep only pending result data needed for recovery. Show a pending-results notice before logout so the user understands what remains on this device.

Do not add trainer client histories to analytics, browser diagnostic logs, or error payloads. No background chat, payment inference, or health-data URL prefill is introduced.
