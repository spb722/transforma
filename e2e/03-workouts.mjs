/* Trainer publishes a catalog-backed assignment, the client finds it in Personal,
 * completes it in the existing logger, and the trainer exercises schedule recovery. */
import fs from 'node:fs';
import { launch, newIdentity, signIn, apiCall, importCredentials, nextSignCount, ok, uuid } from './lib.mjs';

const stateFile = new URL('./.state.json', import.meta.url);
const state = JSON.parse(fs.readFileSync(stateFile));
const relationship = JSON.parse(fs.readFileSync(new URL('./.relationship.json', import.meta.url)));
const signCount = nextSignCount(state);
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
const browser = await launch();

async function resume(role) {
  const identity = await newIdentity(browser, role);
  await importCredentials(identity, state[role].credentials, signCount);
  await signIn(identity);
  return identity;
}

try {
  const trainer = await resume('trainer');
  const client = await resume('client');
  const weekdayName = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Kolkata', weekday: 'short' }).format(new Date());
  const weekday = ({ Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 })[weekdayName];
  const content = { name: 'E2E Coach Plan', unit: 'lb', days: [{ id: 'e2e-day', name: 'Coach Squat Day', weekdays: [weekday], exercises: [{ entryId: 'e2e-entry', exerciseId: '0043', name: 'Barbell squat', mode: 'reps', sets: [{ reps: 5, weight: 45 }], restSec: 45, notes: 'Keep your knees tracking over your toes.' }] }] };
  const published = await apiCall(trainer, '/api/coaching/plans/publish', { method: 'POST', body: { mutationId: uuid(), relationshipId: relationship.relationshipId, kind: 'workout', expectedVersion: 0, content } });
  ok('trainer published a catalog-backed assignment', published.status === 200, `HTTP ${published.status}`);

  await trainer.page.goto(`/#/studio/clients/${relationship.relationshipId}/workout`);
  await trainer.page.getByRole('heading', { name: 'Schedule manager' }).waitFor();
  ok('active assignments lead with the current plan and schedule', await trainer.page.getByText('Current plan', { exact: true }).isVisible());
  await trainer.page.getByRole('button', { name: 'Edit recurring plan' }).click();
  const sourceHeading = trainer.page.getByRole('heading', { name: 'Start from a plan' });
  await sourceHeading.waitFor();
  const editorVisibleAfterRecurring = await sourceHeading.evaluate(element => { const box = element.getBoundingClientRect(); return box.top >= 0 && box.top < window.innerHeight; });
  ok('Edit recurring plan reveals its editor in the viewport', editorVisibleAfterRecurring);
  await trainer.page.getByRole('button', { name: 'Close editor' }).click();
  await trainer.page.getByRole('button', { name: 'Use another plan' }).click();
  const editorVisibleAfterSource = await sourceHeading.evaluate(element => { const box = element.getBoundingClientRect(); return box.top >= 0 && box.top < window.innerHeight; });
  ok('Use another plan reveals its source picker in the viewport', editorVisibleAfterSource);
  const sourceOptions = await trainer.page.getByLabel('Plan source').locator('option').allTextContents();
  ok('composer offers reusable starting points', sourceOptions.some(text => text.includes('Blank plan')) && sourceOptions.some(text => text.includes('Current client assignment')) && sourceOptions.some(text => text.includes('My personal plan')) && sourceOptions.some(text => text.includes('Starter PPL')), sourceOptions.join(' | '));
  await trainer.page.getByRole('button', { name: 'Add exercise' }).click();
  await trainer.page.getByLabel('Search exercises').fill('squat');
  ok('catalog search preloads matching exercises and media rows', await trainer.page.locator('.coaching-catalog-results .item').count() > 1);
  await trainer.page.getByRole('button', { name: 'Close', exact: true }).click();
  ok('grouped schedule manager is visible', await trainer.page.getByRole('heading', { name: 'Schedule manager' }).isVisible());

  await client.page.reload();
  await client.page.goto('/#/home');
  await client.page.getByText('Coach assigned', { exact: false }).first().waitFor({ timeout: 15000 });
  ok('Personal Home shows the coach assignment', await client.page.getByText('Coach Squat Day', { exact: false }).first().isVisible());
  ok('coached Home hides personal plan creation and overlap', await client.page.getByText('Build my own plan', { exact: true }).count() === 0 && await client.page.getByText('My personal plan', { exact: true }).count() === 0);
  await client.page.getByRole('button', { name: 'Next week' }).click();
  const selectedWeekCard = client.page.locator('.trainer-block').first();
  const selectedWeekText = await selectedWeekCard.textContent();
  ok('week navigation selects and displays that week’s coach workout', selectedWeekText.includes('Coach Squat Day') && selectedWeekText.includes('Coach assigned'), selectedWeekText);
  await client.page.getByRole('button', { name: 'Previous week' }).click();
  await client.page.goto('/#/plan');
  await client.page.getByText('Coach-assigned plan', { exact: true }).waitFor({ timeout: 15000 });
  ok('Personal Plan shows only the detailed read-only coach plan', await client.page.getByText('Read only', { exact: true }).isVisible() && await client.page.getByRole('heading', { name: 'Training plan' }).isVisible() && await client.page.getByRole('button', { name: 'New' }).count() === 0 && await client.page.getByText('Week schedule', { exact: true }).count() === 0);
  await client.page.goto('/#/workout');
  await client.page.getByText("Today's coach assignment", { exact: true }).waitFor({ timeout: 15000 });
  ok('Start shows only the coach assignment', await client.page.getByText('Freestyle workout (pick as you go)', { exact: true }).count() === 0 && await client.page.getByText("Today's plan", { exact: false }).count() === 0);
  await client.page.getByRole('button', { name: 'Start coach assignment' }).click();
  await client.page.getByText('Keep your knees tracking over your toes.').waitFor({ timeout: 15000 });
  ok('existing logger shows coach notes and assignment units while locking structure', await client.page.getByText('Weight (lb)', { exact: true }).isVisible() && await client.page.getByRole('button', { name: 'Add exercise' }).count() === 0 && await client.page.getByRole('button', { name: 'Add set' }).count() === 0 && await client.page.getByRole('button', { name: 'Remove set' }).count() === 0);
  await client.page.evaluate(async () => {
    const current = await fetch('/api/data').then(response => response.json())
    const state = { ...current.state, active: null }
    await fetch('/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ state }) })
    localStorage.setItem('gym_state_v1', JSON.stringify(state))
  });
  await client.page.reload();
  await client.page.getByText('Coach workout in progress', { exact: true }).waitFor({ timeout: 15000 });
  await client.page.getByRole('button', { name: 'Resume coach workout' }).click();
  await client.page.getByText('Keep your knees tracking over your toes.').waitFor({ timeout: 15000 });
  ok('a server-started workout recovers when local active state is missing', await client.page.getByText('Coach assigned', { exact: false }).first().isVisible());
  await client.page.getByRole('checkbox').click();
  await client.page.locator('#modal-root').getByRole('button', { name: 'Finish workout', exact: true }).click();
  await client.page.getByRole('button', { name: 'Nice!' }).click();
  await client.page.goto('/#/history');
  await client.page.getByText('Coach assigned', { exact: false }).first().waitFor({ timeout: 15000 });
  ok('Personal History labels the completed assignment', true);

  await trainer.page.reload();
  let futureRow = trainer.page.locator('.coaching-schedule-group').filter({ has: trainer.page.getByRole('heading', { name: 'Upcoming' }) }).locator('.coaching-occurrence-list > div').first();
  await futureRow.getByRole('button', { name: 'Manage' }).click();
  await futureRow.getByRole('button', { name: 'Edit this workout' }).click();
  await trainer.page.getByLabel('Workout name').fill('One-day Coach Squat');
  await trainer.page.getByLabel('Weight', { exact: true }).first().fill('50');
  await trainer.page.getByRole('button', { name: 'Save this workout only' }).click();
  await trainer.page.getByText('This workout was customized for one day', { exact: true }).waitFor();
  futureRow = trainer.page.locator('.coaching-schedule-group').filter({ has: trainer.page.getByRole('heading', { name: 'Upcoming' }) }).locator('.coaching-occurrence-list > div').filter({ hasText: 'One-day Coach Squat' }).first();
  ok('trainer edits only one upcoming workout', await futureRow.getByText('Customized', { exact: true }).isVisible());
  await client.page.reload();
  await client.page.goto('/#/plan');
  await client.page.getByText('One-day Coach Squat', { exact: true }).waitFor({ timeout: 15000 });
  ok('client sees the dated one-day workout override', await client.page.getByText('One-day Coach Squat', { exact: true }).isVisible() && await client.page.getByText('Customized', { exact: true }).isVisible());

  await futureRow.getByRole('button', { name: 'Manage' }).click();
  const originalDate = await futureRow.locator('input[type=date]').inputValue();
  await futureRow.locator('input[type=date]').fill((() => { const date = new Date(`${originalDate}T12:00:00Z`); date.setUTCDate(date.getUTCDate() + 2); return date.toISOString().slice(0, 10); })());
  await futureRow.getByRole('button', { name: 'Save new date' }).click();
  await trainer.page.getByText('Workout rescheduled', { exact: true }).waitFor();
  const movedRow = trainer.page.locator('.coaching-schedule-group').filter({ has: trainer.page.getByRole('heading', { name: 'Upcoming' }) }).locator('.coaching-occurrence-list > div').filter({ hasText: 'moved from' }).first();
  await movedRow.getByRole('button', { name: 'Manage' }).click();
  await movedRow.getByRole('button', { name: 'Return to original date' }).click();
  await trainer.page.getByText('Workout returned to its original date', { exact: true }).waitFor();
  const resetRow = trainer.page.locator('.coaching-schedule-group').filter({ has: trainer.page.getByRole('heading', { name: 'Upcoming' }) }).locator('.coaching-occurrence-list > div').first();
  await resetRow.getByRole('button', { name: 'Manage' }).click();
  await resetRow.getByRole('button', { name: 'Give day off' }).click();
  await trainer.page.getByRole('button', { name: 'Give day off' }).last().click();
  await trainer.page.getByText('Day off saved', { exact: true }).waitFor();
  await client.page.reload();
  await client.page.goto('/#/plan');
  await client.page.getByRole('heading', { name: 'Days off' }).waitFor({ timeout: 15000 });
  ok('client schedule exposes days off instead of silently omitting dates', await client.page.getByText('Day off', { exact: true }).first().isVisible());
  const canceledRow = trainer.page.locator('.coaching-schedule-group').filter({ has: trainer.page.getByRole('heading', { name: 'Days off' }) }).locator('.coaching-occurrence-list > div').first();
  await canceledRow.getByRole('button', { name: 'Manage' }).click();
  await canceledRow.getByRole('button', { name: 'Restore on this date' }).click();
  await trainer.page.getByText('Workout restored', { exact: true }).waitFor();
  const restoredRow = trainer.page.locator('.coaching-schedule-group').filter({ has: trainer.page.getByRole('heading', { name: 'Upcoming' }) }).locator('.coaching-occurrence-list > div').filter({ hasText: originalDate }).first();
  ok('trainer rescheduled, reset, gave a day off, and restored through Manage', await restoredRow.isVisible() && (await restoredRow.textContent()).includes('Customized') && !(await restoredRow.textContent()).includes('moved from'));
  await restoredRow.getByRole('button', { name: 'Manage' }).click();
  await restoredRow.getByRole('button', { name: 'Return workout to plan' }).click();
  await trainer.page.getByRole('button', { name: 'Return to plan' }).click();
  await trainer.page.getByText('Workout returned to the recurring plan', { exact: true }).waitFor();
  const revertedRow = trainer.page.locator('.coaching-schedule-group').filter({ has: trainer.page.getByRole('heading', { name: 'Upcoming' }) }).locator('.coaching-occurrence-list > div').filter({ hasText: originalDate }).first();
  ok('one-day override resets to the recurring workout', (await revertedRow.textContent()).includes('Coach Squat Day') && !(await revertedRow.textContent()).includes('Customized'));

  await trainer.page.getByRole('button', { name: 'Use another plan' }).click();
  await trainer.page.getByLabel('Plan source').selectOption('starter');
  await trainer.page.getByRole('button', { name: 'Load source' }).click();
  ok('Starter PPL loads as the named replacement draft', await trainer.page.getByLabel('Plan name').inputValue() === 'Starter PPL');
  await trainer.page.getByRole('button', { name: 'Publish to client' }).click();
  // Publishing a replacement recurring plan now confirms first (FR-013, added in the
  // responsive-ui-redesign feature) — the dialog's own "Publish" button is exact-matched
  // so it can't collide with the "Publish to client" trigger above.
  await trainer.page.getByRole('button', { name: 'Publish', exact: true }).click();
  await trainer.page.getByText('Published to client', { exact: true }).waitFor();
  const replacementSchedule = trainer.page.locator('.coaching-schedule-group').filter({ has: trainer.page.getByRole('heading', { name: 'Upcoming' }) });
  const replacementText = await replacementSchedule.textContent();
  ok('publishing another plan replaces the old future schedule', !replacementText.includes('Coach Squat Day') && replacementText.includes('Push Day') && replacementText.includes('Pull Day') && replacementText.includes('Leg Day'));
  ok('plan-removed rows stay out of the operational Days off list', await trainer.page.locator('.coaching-schedule-group').filter({ has: trainer.page.getByRole('heading', { name: 'Days off' }) }).getByText('No upcoming days off.').isVisible());
  await client.page.reload();
  await client.page.goto('/#/plan');
  await client.page.getByText('Starter PPL', { exact: true }).waitFor({ timeout: 15000 });
  ok('client receives the replacement plan and schedule', await client.page.getByText('Coach Squat Day', { exact: true }).count() === 0 && await client.page.getByText('Push Day', { exact: true }).first().isVisible());

  await trainer.page.screenshot({ path: new URL('./shot-workout-composer.png', import.meta.url).pathname, fullPage: true });
  await client.page.screenshot({ path: new URL('./shot-personal-assignment.png', import.meta.url).pathname, fullPage: true });
} finally {
  await browser.close();
}
