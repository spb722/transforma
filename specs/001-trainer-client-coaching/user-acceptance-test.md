# User acceptance test journey: Trainer–Client Coaching

This guide lets a non-technical tester verify the complete coaching product from the trainer and client points of view. Follow the tests in order because later tests use records created by earlier ones.

The **Expected result** describes what the product must do. Record what actually happened even when it differs. Do not help the tester unless a test says that operator help is allowed.

## What counts as pass or fail

- **Pass**: every expected result is visible and understandable without help.
- **Fail**: the result is wrong, data is missing or duplicated, the tester gets stuck, or the screen does not explain what happened.
- **Blocked**: setup outside the tester's control is unavailable, such as payment configuration or a second physical device.
- **Severity 1, release blocker**: another person's data is exposed, data is lost, checkout marks a fee paid, or the core invite/assign/log flow cannot finish.
- **Severity 2, high**: a major feature fails but there is no privacy, payment, or data-loss risk.
- **Severity 3, normal**: confusing text, layout, accessibility, or a recoverable usability problem.

For every failure, record:

```text
Test ID:
Device and browser:
Account used:
Step that failed:
What I expected:
What actually happened:
Screenshot or screen recording:
Could I continue? Yes / No
Severity: 1 / 2 / 3
```

## Test setup

Use a test installation and fake payment links. Do not use production client data or real money.

Prepare these separate accounts in separate browser profiles or devices:

- **Trainer A, Asha**: trainer capability enabled, no administrator capability required.
- **Trainer B, Ravi**: trainer capability enabled, used to test privacy and isolation.
- **Client A, Maya**: an existing transforma user with at least one personal routine, one completed personal workout, and one weigh-in.
- **Client B, Noah**: a new user who will register from an invitation.
- **Unlinked user, Priya**: an ordinary signed-in user with no trainer relationship.

The operator must provide:

- The test URL over HTTPS for passkey and physical-device tests.
- A supported business time zone, for example `Asia/Kolkata`.
- A test WhatsApp number that the tester is allowed to open.
- One approved fake or provider test checkout URL.
- Configured test currencies, including the correct number of decimal places.
- A way to identify each browser profile so accounts are never accidentally mixed.

Use this sample content so every tester sees the same results:

- Workout: **Starter Strength**, unit **kg**.
- Training day: **Full Body**, scheduled for today and one future weekday.
- Exercise 1: **Goblet Squat**, reps, 3 sets, 8 reps, 20 kg, 90 seconds rest, note `Keep chest tall`.
- Exercise 2: **Plank**, timed, 2 sets, 30 seconds, 45 seconds rest.
- Exercise 3: **Treadmill Walk**, cardio, 1 set, 20 minutes.
- Diet: **Balanced Day**, note `Drink water with every meal`.
- Breakfast: Oats, 60 g; Eggs, 2.
- Lunch: Rice, 1 bowl; Paneer, 150 g.
- Fee: **INR 1,500**, current monthly period, due today, approved test checkout link.

Before starting, confirm that Client A's personal workout and weigh-in are visible. Write down their names, dates, and values. These are checked again after joining and after ending coaching.

## Part 1: First-time and empty-state journey

### UAT-01: Ordinary individual remains an individual

**Tester:** Priya

1. Sign in as Priya and open Home, Plan, Start, Stats, Exercises, and Settings.
   - **Expected result:** the normal personal workout app works. Priya sees no trainer's clients, plans, fees, or check-ins.
2. Try to open the Trainer Studio URL from another tester's copied address.
   - **Expected result:** Priya is returned to the personal app or shown an access-denied message. No trainer controls or client data appear.
3. Open the Coaching URL without accepting an invitation.
   - **Expected result:** the screen says **No active trainer** and offers access to personal workouts.

**Pass when:** the personal experience remains usable and no coaching authority can be self-selected.

### UAT-02: Trainer empty state and studio setup

**Tester:** Asha

1. Sign in as Asha, open **Settings**, then select **Trainer Studio**.
   - **Expected result:** **Client overview** opens. It shows zero active clients, no outstanding fees, and a prompt to complete the studio profile.
2. Select **Invite client** before saving a studio profile.
   - **Expected result:** invitation creation is unavailable and the screen explains that a studio profile is required.
3. Open **Studio settings**. Enter `Asha Fitness`, the provided business time zone, and the provided WhatsApp number in international format. Select **Save settings**.
   - **Expected result:** the screen says **Saved**. Refreshing the page keeps the same values.
4. Return to the normal personal app and then reopen **Trainer Studio** from Settings.
   - **Expected result:** both modes remain available. Trainer capability did not turn Asha into an administrator and did not remove personal workout features.

**Pass when:** the trainer identity persists and the empty studio clearly leads to inviting the first client.

## Part 2: Invitation, registration, and consent journey

### UAT-03: Create, copy, and revoke an invitation

**Tester:** Asha, then Maya

1. In Trainer Studio, open **Invitations** and select **New invitation**.
   - **Expected result:** one copyable link appears with an expiry about seven days in the future. The page explains that the link is shown only now.
2. Select **Copy link**, paste it into a temporary note, then refresh Invitations.
   - **Expected result:** invitation history shows a pending invitation, but the secret link is not revealed again.
3. Select **Revoke**. Open the copied link in Maya's browser.
   - **Expected result:** Maya sees that the invitation is invalid or unavailable and cannot join.
4. Create a replacement invitation and keep its link for UAT-04.
   - **Expected result:** the old entry remains revoked and a new pending invitation exists.

**Pass when:** lost links cannot be recovered, revoked links cannot connect a client, and a replacement can be created.

### UAT-04: Existing user accepts with informed consent

**Tester:** Maya

1. While signed in as Maya, open the new invitation link.
   - **Expected result:** the page names **Asha Fitness** and explains which workout, weight, and coaching records will be shared.
2. Do not select the consent checkbox.
   - **Expected result:** **Join coaching** remains disabled.
3. Select the consent checkbox and choose **Join coaching** once.
   - **Expected result:** Maya reaches her private client workspace. Exactly one active relationship is created.
4. Refresh the original invitation link.
   - **Expected result:** Maya returns to the same coaching relationship or is told it was already accepted. A second relationship is not created.
5. Check Maya's personal History and Stats.
   - **Expected result:** the personal workout and weigh-in recorded before joining are unchanged.

**Pass when:** consent is required, the correct trainer is named, acceptance is single-use, and existing personal data survives.

### UAT-05: New invited user creates an account

**Tester:** Asha, then Noah

1. Asha creates another invitation. Open it in Noah's signed-out browser.
   - **Expected result:** Noah sees the trainer identity and consent explanation, plus the option to sign in or create a passkey profile.
2. Create Noah's passkey profile from this page.
   - **Expected result:** a separate signup code is not requested when invite-only registration is enabled. After registration, Noah returns to the same invitation.
3. Accept the sharing statement and join.
   - **Expected result:** Noah reaches his own coaching workspace. Asha now sees both Maya and Noah in **Your clients**.
4. Sign out and sign back in with Noah's passkey.
   - **Expected result:** Noah can return to Coaching and the same active relationship. He never sees Maya's records.

**Pass when:** the invitation survives account creation and the returning client can find Coaching again from visible navigation. If a returning client needs a saved deep link or manual URL, record a failure.

### UAT-06: Invitation protections

**Testers:** Asha, Ravi, Maya, and Priya

1. Try to accept Noah's already-used link as Priya.
   - **Expected result:** no relationship is created and the app asks for a new invitation.
2. While Maya is still linked to Asha, open a valid invitation from Ravi.
   - **Expected result:** Maya cannot join Ravi until the current relationship ends.
3. Have Asha create an invitation and try to accept it while signed in as Asha.
   - **Expected result:** self-invitation is rejected.
4. Operator-assisted: use an invitation whose seven-day expiry has passed.
   - **Expected result:** it is rejected without creating or sharing anything.

**Pass when:** used, expired, self-issued, and second-trainer invitation attempts create no extra relationship.

## Part 3: Trainer and client workspace journey

### UAT-07: Trainer overview and account isolation

**Tester:** Asha, then Ravi

1. Asha opens **Client overview**.
   - **Expected result:** Maya and Noah appear with weekly session, check-in, and fee summaries. Search can find either client by name.
2. Search for a name that does not exist.
   - **Expected result:** a clear **No matching clients** state appears.
3. Open Maya's workspace and copy its browser address.
   - **Expected result:** the workspace starts empty for assignments and clearly shows the available sections.
4. Open that address while signed in as Ravi.
   - **Expected result:** Ravi sees no part of Maya's identity, history, plan, diet, check-in, progress, or fee records. The app redirects or shows a clear denial.
5. Open the same address as Priya.
   - **Expected result:** Priya sees no coaching data and no trainer actions.

**Pass when:** Asha can manage only her clients, and direct links never bypass access control.

## Part 4: Workout assignment and logging journey

### UAT-08: Author and publish a workout

**Tester:** Asha

1. Open Maya's workspace and select **Assign plan** under Workout plan.
   - **Expected result:** the workout editor opens for Maya.
2. Enter the sample **Starter Strength** plan. Add the reps, timed, and cardio exercises in that order, with their rest periods and notes. Select today and one future weekday.
   - **Expected result:** all fields accept the appropriate values. Exercise order can be changed with the up and down controls.
3. Enter `Starter Strength Template` under **Template name** and select **Save template**.
   - **Expected result:** the screen says **Template saved** and the template appears in **Choose template**.
4. Select **Publish to client**.
   - **Expected result:** the screen says **Published**. Maya's workspace now names the plan and shows dated scheduled sessions.
5. Return to the editor, change an unsaved field, refresh, and check the published client view.
   - **Expected result:** an un-published change does not alter Maya's live plan. Only explicit publication changes it.

**Pass when:** all three exercise modes publish correctly and the client receives a dated, client-specific copy.

### UAT-09: Reuse a workout template without cross-client changes

**Tester:** Asha

1. Open Noah's workspace, choose the saved workout template, change its name to `Noah Starter`, and change Goblet Squat to 15 kg.
   - **Expected result:** Noah's draft contains the copied template and can be customized.
2. Publish it to Noah.
   - **Expected result:** Noah sees 15 kg. Maya still sees 20 kg and the reusable source has not been silently changed.
3. Reopen Maya's plan.
   - **Expected result:** Maya's exercise order, notes, targets, and schedule are unchanged.

**Pass when:** each client receives an independent copy.

### UAT-10: Client starts and completes today's assigned workout

**Tester:** Maya

1. Open Coaching, open the workspace, and select **Start today's workout**.
   - **Expected result:** the existing workout logger opens within two actions from Coaching home. Starting requires a live connection so the server can freeze the assigned targets.
   - **Expected result:** Personal Home, Plan, and Start do not offer personal plan creation/editing, AI plan generation, personal routine starts, or Freestyle while this coach plan is active.
2. Confirm the logger shows Goblet Squat 3 × 8 at 20 kg, Plank 2 × 30 seconds, Treadmill Walk 20 minutes, plus the notes and rest instructions.
   - **Expected result:** the prescription matches Asha's published plan. Maya can record actual performance but cannot add/remove exercises or sets.
3. Log actual Goblet Squat results as 20 kg for 8, 8, and 6 reps. Complete Plank as prescribed. Leave Treadmill Walk unchecked.
   - **Expected result:** actual values can differ from targets without changing the displayed prescription.
4. Select **Finish workout** and accept the early-finish warning.
   - **Expected result:** the session is saved as partial because at least one prescribed item was skipped. History labels it as assigned and synced after upload.
5. Asha opens Maya's Progress.
   - **Expected result:** the result is visible once, the session is partial, the original targets remain visible, and the skipped exercise is still part of the prescription.

**Pass when:** actual performance is saved separately, partial work is honest, and no prescribed target is lost.

### UAT-11: Completion, zero-result, and extra-attempt counting

**Tester:** Maya and Asha

1. On another scheduled occurrence, complete every prescribed set and finish.
   - **Expected result:** Progress increases **Completed** by one and does not increase **Partial sessions** for this attempt.
2. On a test occurrence, finish without checking any set and confirm **Finish anyway**.
   - **Expected result:** the attempt remains visible but does not count as a completed scheduled session.
3. Start a distinct second attempt for the same occurrence where the test setup permits it, and complete it.
   - **Expected result:** both attempts remain in history, but the scheduled occurrence counts at most once in the completed/scheduled total.
4. Complete an ordinary personal workout outside the assignment.
   - **Expected result:** it appears as an extra/personal workout and does not increase the scheduled denominator.

**Pass when:** completed, partial, empty, and extra sessions are labeled and counted according to what happened.

### UAT-12: Revise, move, and cancel future workouts

**Tester:** Asha and Maya

1. After Maya has started or finished a session, Asha changes Goblet Squat to 22.5 kg and publishes the plan again.
   - **Expected result:** future unstarted sessions use 22.5 kg. The earlier session still shows its original 20 kg target and actual results.
2. In **Upcoming schedule**, move a future session to another date, including a date in the next week if available.
   - **Expected result:** one session moves. The old date does not keep a duplicate.
3. Cancel another future session.
   - **Expected result:** it is labeled canceled and no longer counts as scheduled work to complete.
4. Try to move or cancel a past or started session.
   - **Expected result:** the change is rejected and the existing record remains unchanged.

**Pass when:** future changes work without rewriting history or double-counting a moved session.

### UAT-13: Offline finish, retry, and account separation

**Tester:** Maya, then Noah

1. While online, Maya starts an assigned workout and logs at least one set.
   - **Expected result:** the workout starts with a server-approved frozen prescription.
2. Turn on airplane mode or set the browser network to Offline. Finish the workout, then reload the app.
   - **Expected result:** the workout remains in Maya's local history as **Assigned · waiting to sync**. The app does not claim that the trainer has received it.
3. While still offline, try to start a new assigned workout.
   - **Expected result:** starting is refused with a connection-related message. Starting and logging a personal workout remains available offline.
4. Sign out of Maya and sign in as Noah before reconnecting.
   - **Expected result:** Maya's pending result is never displayed in or uploaded from Noah's account.
5. Sign out of Noah, return to Maya, and reconnect.
   - **Expected result:** the pending result uploads once and changes to **Assigned · synced**. Asha sees one result, even after another refresh or retry.

**Pass when:** no offline result is lost, duplicated, falsely marked synced, or shown under the wrong account.

## Part 5: Diet journey

### UAT-14: Publish, read, and revise a diet

**Tester:** Asha and Maya

1. Before assigning a diet, Maya opens the Diet section.
   - **Expected result:** it says **No diet assigned**, suggests contacting the trainer, and does not invent meal advice.
2. Asha opens Maya's workspace, selects **Assign diet**, enters the sample **Balanced Day** meals, portions, and note, then selects **Publish to client**.
   - **Expected result:** the screen says **Published**.
3. Maya opens **View diet**.
   - **Expected result:** meal order, food names, portions, general note, and last-updated date match the published diet. No edit controls appear.
4. Maya views and refreshes the diet several times, then opens the weekly check-in.
   - **Expected result:** viewing the diet does not create or change an adherence answer.
5. Asha changes Maya's lunch rice portion to `1/2 bowl` and publishes again.
   - **Expected result:** Maya sees the revised portion and new update date. Noah's diet, if any, is unchanged.

**Pass when:** the diet is trainer-authored, read-only to the client, independently revised, and never treated as adherence merely because it was viewed.

## Part 6: Weekly check-in and trainer response journey

### UAT-15: Submit and edit one weekly check-in

**Tester:** Maya

1. Open **Weekly check-in**. Choose **Mostly**, enter a valid optional weight, and write `Energy was good, last session felt hard.` Select **Save check-in**.
   - **Expected result:** the screen says **Saved**. One report exists for the current Monday-to-Sunday week.
2. Refresh and open it again.
   - **Expected result:** the same adherence, weight, unit, and notes appear.
3. Change adherence to **Some**, edit the note, and save again.
   - **Expected result:** the existing weekly row is updated. A duplicate weekly check-in is not created.
4. Repeat with no weight in an operator-provided clean fixture.
   - **Expected result:** weight is shown as missing, not as zero.

**Pass when:** the client owns one editable report per week and optional data stays optional.

### UAT-16: Trainer reviews and responds

**Tester:** Asha and Maya

1. Asha opens Client overview after Maya submits the check-in.
   - **Expected result:** Maya is marked as needing review and the **Needs attention** total increases. A new, unanswered report must not look fully reviewed.
2. Open Maya, choose **Review check-in**, and enter `Good work. Keep the squat load steady next week.` Select **Save response**.
   - **Expected result:** the response is saved with an update time and the review indicator clears.
3. Maya opens her check-in.
   - **Expected result:** she sees exactly one trainer response and its timestamp. There is no chat thread, typing indicator, or automatic message.
4. Maya changes her note and saves again.
   - **Expected result:** the old trainer response stays visible, but the report returns to **needs review**.
5. Asha edits the response and saves.
   - **Expected result:** the one response is updated with a new timestamp rather than creating a conversation.

**Pass when:** the feedback loop is one editable report and one editable trainer response, with correct review state.

## Part 7: Progress journey

### UAT-17: Trainer and client see the same progress truth

**Tester:** Maya and Asha

1. Both users open Maya's **Progress** page for **4 weeks**.
   - **Expected result:** both see the same completed/scheduled total, partial count, extra workout count, latest activity, strength entries, weight entries, and sync information.
2. Change the range to **12 weeks**, then **24 weeks**.
   - **Expected result:** the date range changes without errors or duplication. Older data appears only when it belongs in the selected range.
3. Compare the totals with UAT-10 through UAT-13.
   - **Expected result:** moved or canceled sessions do not inflate the denominator, multiple attempts count the occurrence once, and personal sessions appear as extra.
4. Check Strength and Weight.
   - **Expected result:** strength shows exercise, load, unit, reps, date, and source. Weight shows value, unit, date, and source. A check-in weight does not silently duplicate a personal weigh-in.
5. Open Progress for Noah with no relevant data.
   - **Expected result:** the app says strength or weight data is missing and sync has not been received yet. Missing values are not displayed as zero.

**Pass when:** both roles see the same explainable counts and missing information is explicit.

## Part 8: Contact journey

### UAT-18: Client initiates WhatsApp contact

**Tester:** Maya

1. In the client workspace, select **Open WhatsApp**.
   - **Expected result:** WhatsApp or its web page opens only after the tap. The destination uses Asha's configured number.
2. Inspect the opened message area.
   - **Expected result:** no health, workout, check-in, or payment information is prefilled and no message is sent automatically.
3. Return to transforma and select **Copy number**.
   - **Expected result:** the button changes to **Copied** and the clipboard contains the configured number.
4. Operator-assisted: temporarily remove Asha's WhatsApp number and reopen Maya's workspace.
   - **Expected result:** the app says the trainer has not added a contact number. It does not show a broken contact button.

**Pass when:** contact is always client-initiated and no private content is placed into WhatsApp.

## Part 9: Fee and external checkout journey

### UAT-19: Publish and validate a fee

**Tester:** Asha

1. Open Maya's **Manage fees** page.
   - **Expected result:** amount, currency, period start, period end, due date, and external payment link fields appear when the server is configured.
2. Try zero or negative amount, an end date before the start date, an HTTP link, and an unapproved checkout hostname one at a time.
   - **Expected result:** each invalid fee is rejected and no fee appears in history.
3. Enter the sample INR 1,500 fee with valid dates and the approved HTTPS test link. Select **Publish fee**.
   - **Expected result:** the screen says **Fee published**. The amount, period, due date, checkout host, unpaid status, and audit history are retained.
4. Return to Client overview.
   - **Expected result:** outstanding totals and Maya's outstanding-fee count update in the correct currency.

**Pass when:** only valid configured fees publish and values are displayed without currency rounding mistakes.

### UAT-20: Checkout never confirms payment

**Tester:** Maya

1. Open **View fees** and select **Pay now**.
   - **Expected result:** the approved external checkout opens in a separate context. The transforma fee remains **unpaid**.
2. Cancel or close checkout and return to transforma.
   - **Expected result:** the same fee remains unpaid and **Pay now** is still available.
3. If the provider has a fake success screen, complete its test flow and return to transforma.
   - **Expected result:** the fee still remains unpaid until Asha verifies receipt outside the app.
4. Try to find a client control that marks the fee paid.
   - **Expected result:** none exists. A direct client request to confirm, if tested by an operator, is denied.
5. Start or view a workout while the fee is unpaid or overdue.
   - **Expected result:** training and history stay available.

**Pass when:** checkout activity never changes payment status and fees never block training.

### UAT-21: Trainer confirms, corrects, and voids with audit history

**Tester:** Asha and Maya

1. After verifying the fake receipt externally, Asha selects **Confirm receipt**.
   - **Expected result:** the fee becomes **paid** for both users. A confirmation event with trainer and time is retained, and **Pay now** disappears.
2. Refresh and try to confirm the same receipt again if the control or retry path is available.
   - **Expected result:** no duplicate confirmation event or duplicate fee is created.
3. Select **Correct**, enter `Test confirmation was entered by mistake`, and submit.
   - **Expected result:** the fee returns to unpaid. The original confirmation and correction reason remain in **Audit history**.
4. Confirm it again after fake external verification.
   - **Expected result:** a new confirmation event is appended; earlier events remain unchanged.
5. Create a second unpaid test fee, select **Void**, and enter `Duplicate test fee`.
   - **Expected result:** it becomes void, its audit history remains, and it cannot be paid or edited as an active fee.
6. Create a fee with yesterday as the due date.
   - **Expected result:** it is labeled **overdue** according to Asha's business time zone but still does not block workouts.

**Pass when:** only the trainer changes fee status and every correction remains auditable.

## Part 10: Ending and rejoining journey

### UAT-22: Client ends coaching

**Tester:** Maya, then Asha

1. Maya selects **End coaching** and confirms the warning.
   - **Expected result:** the active relationship ends immediately and Maya returns to Coaching home.
2. Maya opens her archived coaching record from visible navigation, then checks personal History and Stats.
   - **Expected result:** her personal history remains. Received plans, check-ins, responses, and fee history remain readable, with edit, checkout, and coaching actions disabled. Record a failure if the records exist but Maya has no visible way to reach them.
3. Asha refreshes Maya's already-open workspace and Client overview.
   - **Expected result:** Asha loses access on the next request. Private client records do not remain visible from cached trainer screens.
4. Retry an old trainer action from the previous page, such as publishing or responding.
   - **Expected result:** it is denied and changes nothing.
5. Open the old invitation link.
   - **Expected result:** it does not reactivate coaching.

**Pass when:** trainer access stops and the client keeps her own history and received records.

### UAT-23: Trainer ends coaching and client rejoins later

**Tester:** Asha and Noah

1. Asha ends Noah's coaching relationship and confirms.
   - **Expected result:** Noah disappears from Asha's active-client list and Asha cannot reopen his private workspace.
2. Noah signs in.
   - **Expected result:** his account and personal workout features still work. Archived received records remain read-only.
3. Asha creates a fresh invitation. Noah opens it, reviews consent again, and accepts.
   - **Expected result:** a new active relationship is created. The ended relationship is not rewritten or silently resumed.

**Pass when:** ending does not delete the account and rejoining requires a new invitation and consent.

## Part 11: Personal-feature regression journey

### UAT-24: Existing personal workouts remain independent

**Tester:** Maya

1. Create or edit a personal routine, start a personal workout, log it offline, and finish it.
   - **Expected result:** the established personal workflow still works and does not alter the trainer's assigned plan.
2. Open personal History and delete a personal workout created for this test.
   - **Expected result:** the personal entry can be deleted.
3. Open a synchronized assigned workout in History.
   - **Expected result:** it is labeled assigned and read-only so trainer and client keep the same canonical record.
4. Export a backup, then import it into an isolated test profile or restore fixture.
   - **Expected result:** personal data and assigned identifiers/snapshots survive, but imported data cannot manufacture a trainer relationship or assignment.
5. If automated workout suggestions are enabled, accept or edit a personal suggestion.
   - **Expected result:** it changes only personal planning. Asha's published assignment remains unchanged.

**Pass when:** coaching adds shared records without breaking or taking authority over personal tools.

## Part 12: Mobile, accessibility, and recovery journey

### UAT-25: Responsive layout on four sizes

**Tester:** Asha and Maya

Run the core Home, workspace, workout editor/logger, diet, check-in, progress, and fees screens at:

- 320 × 720 phone viewport.
- 390 × 844 phone viewport.
- 768 × 1024 tablet viewport.
- 1440 × 900 desktop viewport.

For each size:

1. Scroll from top to bottom and use every visible primary action.
   - **Expected result:** no content is cut off, no horizontal page scrolling is needed, and buttons do not overlap text or browser controls.
2. Open forms and type into the last field while the on-screen keyboard is visible on a phone.
   - **Expected result:** the active field and Save/Publish action can still be reached.
3. Rotate a physical phone between portrait and landscape during a form and workout.
   - **Expected result:** entered data and the active workout remain intact.
4. Use physical iPhone Safari and Android Chrome over HTTPS.
   - **Expected result:** passkey sign-in, navigation, forms, workout logging, external links, and clipboard actions work on both. Browser emulation does not replace this step.

**Pass when:** all four sizes work without hidden content or lost input, and both physical mobile browsers pass.

### UAT-26: Keyboard, focus, and readable status

**Tester:** any tester using desktop

1. Use only Tab, Shift+Tab, Enter, Space, Escape, and arrow keys where appropriate.
   - **Expected result:** every link, button, field, selector, consent checkbox, and confirmation dialog can be reached and operated in a sensible order.
2. Watch the focused item while tabbing.
   - **Expected result:** focus is always visibly indicated.
3. Trigger a destructive confirmation such as **End coaching** or personal workout deletion, then cancel it.
   - **Expected result:** the dialog traps focus appropriately, cancel closes it, and no data changes.
4. Save or publish while using a slow connection.
   - **Expected result:** **Saving**, **Publishing**, **Saved**, **Published**, waiting-to-sync, or a clear error accurately describes the current state. Repeated taps do not create duplicates.

**Pass when:** the product is operable without a mouse and never hides whether a change was saved.

### UAT-27: Network and stale-page errors

**Tester:** Asha and Maya

1. Disconnect before publishing a workout, diet, check-in, response, or fee.
   - **Expected result:** the app does not claim success and the typed content remains recoverable where the screen supports drafts.
2. Open the same editable record in two trainer tabs. Save a change in tab 1, then save the older version in tab 2.
   - **Expected result:** tab 2 receives a conflict or reload instruction instead of silently overwriting tab 1.
3. Let the signed-in session expire, then try to save.
   - **Expected result:** the change is not falsely marked saved. The user is asked to sign in again without another account seeing the pending data.
4. Enter very long or invalid text and numbers into fields.
   - **Expected result:** invalid input is refused with a useful explanation. The server remains responsive and private request content is not exposed in an error.

**Pass when:** failures are truthful, recoverable, and never overwrite newer data silently.

## Part 13: Operator-assisted release checks

These tests need someone who can control the test server. Everyday pilot participants should not be asked to perform them.

### UAT-28: Restart, migration, backup, and restore

1. Stop the test server, copy the complete data directory, and restart using the same directory.
   - **Expected result:** accounts, relationships, personal history, plans, session snapshots/results, check-ins/responses, and fee audit events remain.
2. Restore that complete backup into a separate test location and start the app against it.
   - **Expected result:** restored users can sign in and see the same records.
3. Replay a client result that was waiting to sync when the backup was taken.
   - **Expected result:** it uploads exactly once without changing its frozen prescription.
4. Test a migration failure on an isolated copy.
   - **Expected result:** startup stops clearly. The application does not replace the database with an empty one.

**Pass when:** restart and whole-data restore preserve both personal and coaching truth.

### UAT-29: Security and privacy boundary sweep

For every copied client URL and each action below, repeat once as Trainer B, Priya, and the wrong client:

- View workspace, plan, diet, check-in, progress, or fees.
- Publish or revise a plan.
- Move or cancel an occurrence.
- Submit or respond to a check-in.
- Confirm, correct, or void a fee.
- Replay a previously valid action after the relationship ends.

**Expected result:** every request is denied without exposing whether private data exists. No cached page, service worker response, browser-account switch, or retry displays the previous account's trainer workspace.

**Pass when:** all unrelated and ended-relationship attempts reveal no private records and make no changes. Any failure is Severity 1.

### UAT-30: Ten-client performance and trainer scan

1. Prepare ten clients with representative plans, results, check-ins, weights, and fees.
2. Open Trainer Studio and time how long Asha takes to identify every client with an incomplete workout, missing or changed check-in, and overdue fee.
   - **Expected result:** the overview loads on the intended mobile network in 2 seconds or less and Asha finishes the scan in under 2 minutes.
3. Measure ordinary API requests on the intended pilot host and network.
   - **Expected result:** ordinary p95 server response time is 500 ms or less. External checkout and passkey-provider time are recorded separately.

**Pass when:** the ten-client overview is responsive and the trainer can act from its summaries without opening every client.

## Pilot usability journey

After UAT-01 through UAT-30 pass, run the product with one trainer and 5–10 real pilot clients for 14 days. Record assistance and time, not just whether a server request succeeded.

- At least 90% accept an invitation and reach Coaching without help in under 3 minutes.
- The trainer assigns an existing workout and diet to one client in under 5 minutes, excluding authoring time.
- At least 90% start today's workout within two actions from Coaching home and log it without help.
- The trainer finds incomplete sessions, missing or changed check-ins, and overdue fees across ten clients in under 2 minutes.
- At least 90% find their diet and submit a weekly check-in without help in under 3 minutes.
- Every unrelated or revoked access test is denied, with no lost completed session, original prescription, or fee audit event.
- Every checkout-open, checkout-cancel, and checkout-return test remains unpaid until trainer confirmation. Confirmation takes under 1 minute.
- At least 80% complete all applicable invite, plan view, workout log, check-in, and fee-link steps without help during the 14 days.

## Release decision

The coaching MVP is ready for pilot only when:

- UAT-03, UAT-04, UAT-07 through UAT-10, UAT-13, UAT-20 through UAT-22, UAT-28, and UAT-29 have no open failures.
- Both physical-device checks in UAT-25 pass.
- Backup restore succeeds before real clients are admitted.
- Payment currency, checkout hostname, trainer contact, and business time zone match the launch configuration.
- Every remaining Severity 2 or 3 issue has an owner and a decision to fix before pilot or knowingly defer.
