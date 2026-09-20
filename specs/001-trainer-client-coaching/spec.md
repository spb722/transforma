# Feature Specification: Trainer–Client Coaching MVP

**Feature Branch**: `codex/001-trainer-client-coaching`

**Created**: 2026-09-06

**Status**: MVP implemented; refinement planning updated 2026-09-12 from hands-on trainer/client validation.

**Input**: Convert the individual tracker into a simple coaching product. Trainers invite clients, assign workouts and diets, review progress, and collect fees. Clients follow plans, log sessions, submit check-ins, and pay. Keep the workout logger, add role-specific screens, and use WhatsApp for conversation plus one trainer response per weekly check-in. Prioritize a quick launch. Application code changes are not authorized at this stage.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Invite and manage linked clients (Priority: P1)

A trainer shares an invitation. The client joins or signs into an existing account and confirms the relationship. Trainer home lists clients; each client workspace contains Workouts, Diet, Progress, and Fees. Client home shows today's workout, My diet, Weekly check-in, and outstanding fees.

**Why this priority**: Coaching requires an explicit, private trainer–client relationship.

**Independent Test**: Invite new and existing users, verify both role experiences, and attempt access from an unrelated trainer and client.

**Acceptance Scenarios**:

1. **Given** a trainer account, **When** an invitation is created, **Then** the trainer receives a copyable, single-use link that expires after seven days and can be revoked before redemption.
2. **Given** a valid invitation, **When** an authenticated client confirms the named trainer and the disclosed sharing of workout/weight history and coaching records, **Then** one relationship is created and both parties see the corresponding home experience. Existing client data is preserved.
3. **Given** an invalid, expired, revoked, or used invitation, **When** another account tries to redeem it, **Then** no relationship is created and the user is told to request a new invitation. Repeat visits by the successful recipient open their existing coaching home.
4. **Given** an unrelated trainer or client, **When** they try to view or modify another client's records, including via a direct link, **Then** access is denied. Trainer status grants no app-wide administration powers and cannot be self-assigned.
5. **Given** an active relationship, **When** either party ends it, **Then** trainer access is revoked and the client retains personal history and copies of received plans, check-ins, and fee records.
6. **Given** a trainer with no clients or a client with no assignments, **When** home is opened, **Then** clear empty states show Invite client or explain what has not yet been assigned.

### User Story 2 - Assign a plan and log workouts (Priority: P1)

A trainer reuses a weekly workout template and customizes a copy for a client. The client opens today's assignment in the existing workout logger.

**Why this priority**: Assigned training and recorded performance are the central product value.

**Independent Test**: With a linked client, assign a plan, log a session, publish a revision, and verify the original session retains its targets and results.

**Acceptance Scenarios**:

1. **Given** a reusable workout plan, **When** a trainer customizes and assigns a copy, **Then** the client sees exercise order, applicable set/repetition/time/load targets, rest instructions, and notes on their weekly schedule. Other clients and the original template remain unchanged.
2. **Given** today's assignment, **When** the client completes it, **Then** the familiar logger records actual performance against assigned targets for both client and trainer review. Deviations in actual performance do not edit the prescribed plan.
3. **Given** an active coach plan with no workout today, **When** home is opened, **Then** the rest state is clear and personal workout creation/start controls remain hidden. With no active coach plan, personal workout tools return.
4. **Given** completed or in-progress sessions, **When** the trainer revises the plan, **Then** the revision applies to future session starts and preserves original targets and actual results for completed and in-progress sessions.
5. **Given** an older client copy of a plan, **When** workout results synchronize, **Then** results are preserved without replacing the latest trainer assignment.
6. **Given** trainer-managed assignments, **When** a client edits a personal plan or receives an automated suggestion, **Then** the assignment remains unchanged unless the trainer explicitly publishes a revision.
7. **Given** a trainer authoring a workout, **When** they choose a source, **Then** they can start from a saved coaching template, one of their personal weekly routines, the built-in starter plan, or a previously published plan they own; the selected source becomes an isolated draft and never changes its source.
8. **Given** the exercise catalog is available, **When** the trainer adds an exercise, **Then** they can search and filter the same catalog used by the personal app, see its animation and training type, and select it without retyping its name; a manual custom exercise remains available when no catalog entry fits.
9. **Given** an active coaching assignment, **When** the client opens Personal Home, Plan, or Start, **Then** only the dated read-only trainer plan and schedule are offered. Personal plan creation/editing, AI plan generation, personal routine starts, and freestyle remain hidden until no coach plan is active; existing personal data is preserved.
10. **Given** a future unstarted occurrence, **When** the trainer moves, resets, cancels, restores, or changes the recurring plan, **Then** the resulting schedule is visible to both parties, retains stable occurrence identity, rejects collisions, and preserves past or started prescriptions.
11. **Given** today's assigned session was started successfully but the browser later loses its local active-workout state, **When** the client returns to Home or Start, **Then** the server-started session is shown as in progress and can be resumed with its frozen prescription. Selecting another week or day updates Home to that occurrence, and explicit cancellations are labeled instead of appearing as missing assignments.
12. **Given** a today/future unstarted occurrence, **When** the trainer edits only that workout, reschedules it, gives the client a day off, restores it, or returns it to the recurring prescription/date, **Then** both parties see the effective dated workout and status while the recurring plan, reusable template, other dates, and started/completed prescriptions remain unchanged.

### User Story 3 - Publish and follow a simple diet (Priority: P2)

The trainer assigns a reusable meal plan with meals, portions, and notes. The client reads their current diet without logging individual foods.

**Why this priority**: Diet assignment completes the coaching service without requiring a nutrition database.

**Independent Test**: With a linked client and no workout plan, publish and revise a diet and verify current content and isolation from another client's diet.

**Acceptance Scenarios**:

1. **Given** a reusable diet, **When** a trainer customizes and publishes a copy, **Then** the client sees meals, portions, notes, and last-updated date. The client cannot edit the trainer-authored diet.
2. **Given** an assigned diet, **When** the trainer revises it, **Then** the revision becomes current without changing other clients' diets.
3. **Given** no diet, **When** My diet is opened, **Then** it explains that no diet is assigned and provides Contact trainer, rather than generated dietary advice.
4. **Given** a client opening a diet, **When** progress is calculated, **Then** viewing it never counts as adherence; adherence requires an explicit self-report.

### User Story 4 - Review progress and check-in feedback (Priority: P2)

The trainer reviews workout completion, strength, weight, and weekly check-ins, and leaves one response per check-in. Longer conversations take place through WhatsApp.

**Why this priority**: Progress evidence and a lightweight feedback loop let trainers adjust coaching.

**Independent Test**: With a linked client and example history, submit and respond to a check-in, review progress, and verify the contact action and fallback.

**Acceptance Scenarios**:

1. **Given** assignments and logged results, **When** Progress is opened, **Then** both parties can see completed versus scheduled assignments for a selected week, last workout, existing strength trends, weight trends, and last sync. Extra personal sessions appear separately.
2. **Given** an active client, **When** a weekly check-in is submitted, **Then** it records the week, optional current weight, diet adherence as Mostly / Partly / Not followed / Not applicable, and optional notes. Resubmission updates the same weekly check-in instead of duplicating it.
3. **Given** an unreviewed check-in, **When** the trainer responds, **Then** the client can read one editable trainer response with a timestamp and the review indicator clears. There is no conversation thread.
4. **Given** a reviewed check-in, **When** the client updates it, **Then** it needs review again and the previous response remains visible with its timestamp.
5. **Given** a configured trainer contact number, **When** Contact trainer is selected, **Then** WhatsApp opens without automatically sending a message or including health/payment data. If opening fails, the client can copy the number.
6. **Given** missing contact details, **When** contact is displayed, **Then** the app explains it is unavailable instead of offering a broken destination.
7. **Given** missing weigh-ins, workouts, or check-ins, **When** progress is viewed, **Then** missing data is labeled rather than shown as zero weight or successful adherence.

### User Story 5 - Pay fees and record verified receipt (Priority: P2)

The trainer creates a fee with an amount, currency, covered period, due date, and payment link. The client opens external checkout; the trainer verifies receipt externally and marks the fee paid.

**Why this priority**: This completes the commercial flow without automated billing for the pilot.

**Independent Test**: With a linked client, create a fee, open checkout, verify it remains unpaid, then confirm receipt as the trainer and verify both views.

**Acceptance Scenarios**:

1. **Given** a linked client, **When** a trainer creates a fee with a positive amount, currency, covered period, due date, and secure payment link, **Then** the client sees it in Fees and on home while unpaid. Invalid or missing required details prevent publication with a field-specific explanation.
2. **Given** an unpaid fee, **When** Pay now is selected or the client returns from checkout, **Then** the fee stays unpaid until trainer confirmation. A checkout visit never proves payment.
3. **Given** externally verified receipt, **When** the trainer marks the fee paid, **Then** both parties see the amount, paid date, confirming trainer, and confirmation time. Repeated confirmation creates no duplicate record; clients cannot confirm payment themselves.
4. **Given** an unpaid fee past its due date, **When** either party views it, **Then** it is overdue without blocking workouts or history.
5. **Given** an erroneous confirmation, **When** the trainer corrects it with a reason, **Then** both parties see the corrected status and retained change history with author and time.
6. **Given** canceled or unavailable checkout, **When** the client returns, **Then** fee details remain available and unpaid, and the client can retry or contact the trainer.

### Edge Cases

- A client already linked to a trainer cannot join another until the current relationship ends. Ending coaching does not disable their account. Rejoining requires a fresh invitation and sharing confirmation.
- Revocation denies trainer access on subsequent requests, including from already-open client pages. Information legitimately viewed before revocation cannot be recalled.
- Published schedule changes must not retroactively change past completion counts. Moving an upcoming assignment changes its scheduled day without creating another assignment; completion counts at most once per assignment.
- Existing offline workout logging remains available. Invitations, plan publication, check-in submissions, and fee changes require connectivity and must not claim success before saving. Trainer progress shows last sync so unsynced activity is not represented as current.
- New trainer plans preserve existing personal routines and history but hide personal planning/start controls while the coach plan is active. Individual users and clients without an assigned coach plan retain the personal workflow.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Provide role-specific home screens and trainer client workspaces. Trainer home shows clients with weekly workout completion, last activity/sync, missing or unreviewed check-ins, and unpaid/overdue fees. Client home shows today's workout, My diet, Weekly check-in, and outstanding fees. Acceptance: Story 1 and progress/fee scenarios.
- **FR-002**: Support copyable, revocable, single-use trainer invitations with a seven-day lifetime, authenticated acceptance, and explicit confirmation of the trainer and data sharing. Acceptance: Story 1.1–1.3.
- **FR-003**: Enforce one active trainer per client and deny unrelated access and trainer self-promotion to administrator. Acceptance: Story 1.4 and relationship edge cases.
- **FR-004**: Allow either party to end coaching, revoke trainer access, and preserve client access to personal history and received records. Acceptance: Story 1.5 and revocation/rejoining edge cases.
- **FR-005**: Support reusable workout sources and separate client copies with one active weekly plan, targets, and notes per client. Sources include saved coaching templates, the trainer's personal routines, the built-in starter plan, and trainer-owned previously published plans. Acceptance: Story 2.1 and 2.7.
- **FR-006**: Use the existing exercise catalog and animations in trainer authoring, with catalog-derived identity/type and a manual custom fallback. Open assigned workouts in the existing logger, surface their schedule throughout the client's Personal Home/Plan/Start journey, and record actual performance separately from prescribed targets. While an active coach plan exists, hide personal plan creation/editing, AI plan generation, personal routine starts, and freestyle; preserve that personal data and restore its controls when the coach plan is absent. Lock assigned exercise/set structure while still allowing actual performance to be logged. Acceptance: Story 2.2–2.3 and 2.8–2.9.
- **FR-007**: Preserve started-session targets and completed results across revisions, synchronization, and personal or automated plan edits. Today/future unstarted occurrences support a one-day prescription override, reset to the current recurring prescription, move/reset date, day off, and restore; recurring-plan reconciliation removes obsolete dates, adds new dates, preserves valid overrides, and rejects collisions. Acceptance: Story 2.4–2.6, 2.10–2.12, and schedule edge cases.
- **FR-008**: Support reusable diet templates and one current client-specific diet with meals, portions, notes, and revision date. Only the trainer can change the assignment. Acceptance: Story 3.1–3.3.
- **FR-009**: Show assigned-session completion, existing strength and weight trends, last workout, and last sync to both client and linked trainer. Label missing data and separate unscheduled workouts. Acceptance: Story 4.1, 4.7 and completion-count edge cases.
- **FR-010**: Support one editable check-in per client per week with self-reported diet adherence and optional weight/notes; viewing a plan does not imply adherence. Acceptance: Stories 3.4 and 4.2.
- **FR-011**: Support one editable trainer response per check-in, timestamps, and review state that resets when a reviewed check-in changes. Acceptance: Story 4.3–4.4.
- **FR-012**: Let trainers configure their contact number and provide a client-initiated WhatsApp contact action with a copy-number fallback and no automatic message sending or private-data inclusion. Acceptance: Story 4.5–4.6.
- **FR-013**: Let trainers publish fee records with amount/currency, covered period, due date, and an external payment link; clients see their own fees and Pay now action. Acceptance: Story 5.1–5.2.
- **FR-014**: Keep payment confirmation trainer-only and manual, retain confirmation/correction history, and never infer payment from checkout activity. Acceptance: Story 5.2–5.3, 5.5.
- **FR-015**: Label overdue fees, allow retry/contact after checkout failure, and preserve workout/history access regardless of fee status. Acceptance: Story 5.4, 5.6.
- **FR-016**: Preserve the individual experience and existing data, and distinguish saved, unsynced, and failed operations. Acceptance: Story 1.2 and offline/existing-user edge cases.

### Key Entities *(include if feature involves data)*

- **Trainer profile**: Coaching identity and contact number, separate from application administration.
- **Client relationship**: Trainer/client, sharing confirmation, start/end dates, and active/ended status.
- **Invitation**: Trainer, expiry, revocation, and authenticated recipient upon redemption.
- **Workout template and assignment**: Reusable source, published client-specific versions, weekly schedule, dated session identities, prescriptions, and notes.
- **Workout session**: Existing logged performance and original assigned prescription when applicable.
- **Diet template and assignment**: Reusable meals/portions/notes and published client-specific versions.
- **Weekly check-in**: Client/week, self-reported adherence, optional weight/notes, timestamps, review state, and one trainer response.
- **Fee record**: Trainer/client, amount/currency, covered period, due date, payment destination, status, confirmation, and correction history. It records fees; it is not a tax invoice or payment processor.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: At least 90% of pilot clients can accept an invitation and reach their coaching home without assistance in under three minutes, in a pilot with one trainer and 5–10 clients.
- **SC-002**: The pilot trainer can assign an existing workout template and diet template to a client in under five minutes combined, excluding time spent authoring new content.
- **SC-003**: At least 90% of pilot clients can start today's assigned workout within two actions from home and complete logging without assistance.
- **SC-004**: The trainer can identify clients with incomplete scheduled workouts, missing/unreviewed check-ins, and overdue fees across ten client profiles in under two minutes.
- **SC-005**: At least 90% of pilot clients can find their diet and submit a weekly check-in without assistance in under three minutes.
- **SC-006**: All unrelated-user and revoked-trainer access acceptance tests deny access. No completed session, original prescription, or payment correction history is lost in the revision and synchronization scenarios.
- **SC-007**: All checkout-open, canceled-checkout, and checkout-return tests leave fees unpaid until trainer confirmation. A trainer can record a verified receipt in under one minute.
- **SC-008**: Over a two-week pilot, at least 80% of participating clients complete the applicable invitation, plan-viewing, logging, check-in, and fee-link steps without assistance; the trainer can review and respond through the product.

## Assumptions

- **Proposed pilot default, not an explicit user decision**: Start with the user's coaching business, one trainer, and 5–10 clients. Independent trainer self-signup and a marketplace are deferred. The operator may provision additional trainers with identical access restrictions.
- WhatsApp contact and one trainer response per check-in are agreed scope. Full chat, attachments, typing indicators, unread-message counts, and message notifications are excluded.
- Seven-day invitation expiry, Monday–Sunday check-in weeks, and the trainer's configured business time zone are proposed defaults. A fee becomes overdue after its due date ends in that time zone. A current-week check-in is missing until submitted; past missing weeks remain identifiable.
- The trainer supplies a valid WhatsApp contact and externally created payment links, and verifies receipts externally. Provider, launch country, and currency are operational choices before the pilot. Automatic confirmation and payment-credential storage are excluded.
- Fees are created individually. Recurring billing, partial payments, in-app refunds, tax invoicing, platform commissions, and collection on behalf of multiple trainers are excluded. Refunds and disputes are handled externally.
- Progress uses existing workout, strength, and weight data plus check-ins. Food databases, daily calorie logging, body measurements, progress photos, appointments, and new AI features are deferred.
- Trainer prescriptions govern assigned workouts. Personal progression or optional AI must not silently revise them; broader AI integration is deferred.
- Reuse the existing mobile-friendly product, account access, logging, and history. New app-store releases and a wholesale logger redesign are excluded.
- Joining explicitly discloses access to existing workout/weight history and coaching records. Granular sharing controls and automated trainer transfers are deferred.
- Launch must respect existing repository licensing and separate exercise-media terms. These constraints were raised during discussion; no proprietary relicensing or new media rights are assumed.
- The project constitution is an unfilled template with no substantive additional principles. This specification defines scope; screen design, technical planning, and implementation are subsequent work.
