/* Phase 2: trainer sets up the studio, invites, and the client accepts — all through the UI.
 *
 * Both identities are live at the same time in separate browser contexts, so this is the real
 * two-party handoff rather than one session pretending to be two. The script is re-runnable:
 * it ends any relationship left over from a previous run before starting.
 */
import fs from 'node:fs';
import { launch, newIdentity, register, signIn, apiCall, importCredentials, exportCredentials, nextSignCount, ok, uuid, BASE } from './lib.mjs';

const stateFile = new URL('./.state.json', import.meta.url);
const state = JSON.parse(fs.readFileSync(stateFile));
// Reserve a fresh sign-count window for this run and persist it before touching the browser.
const signCount = nextSignCount(state);
fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
const browser = await launch();

async function resume(role) {
  const id = await newIdentity(browser, role);
  await importCredentials(id, state[role].credentials, signCount);
  const user = await signIn(id);
  ok(`${role} signed in with the stored passkey`, user?.id === state[role].uid, `${user?.name} (${user?.id})`);
  return id;
}

/** Leave no active relationship behind, so the invite path is exercised from a clean start. */
async function endExisting(client) {
  const boot = await apiCall(client, '/api/coaching/bootstrap');
  const active = (boot.payload?.data?.relationships || []).find(r => r.status === 'active');
  if (!active) return null;
  const res = await apiCall(client, '/api/coaching/relationships/end', {
    method: 'POST', body: { mutationId: uuid(), relationshipId: active.id, expectedVersion: active.version }
  });
  ok('left-over relationship ended before the run', res.payload?.data?.status === 'ended', active.id);
  return active.id;
}

try {
  console.log('\n== sign in both parties ==');
  const trainer = await resume('trainer');
  const client = await resume('client');

  const caps = await apiCall(trainer, '/api/me');
  ok('trainer now carries the trainer capability', caps.payload?.user?.capabilities?.trainer === true,
    JSON.stringify(caps.payload?.user?.capabilities));

  await endExisting(client);

  console.log('\n== trainer: studio profile ==');
  await trainer.page.goto('/#/studio/settings');
  await trainer.page.getByRole('button', { name: 'Save settings' }).waitFor();
  await trainer.page.getByLabel('Display or business name').fill('E2E Strength Studio');
  await trainer.page.getByLabel('Business time zone').fill('Asia/Kolkata');
  await trainer.page.getByRole('button', { name: 'Save settings' }).click();
  await trainer.page.getByRole('status').filter({ hasText: 'Saved' }).waitFor({ timeout: 15000 });
  ok('studio profile saved through the form', true, 'E2E Strength Studio / Asia/Kolkata');

  console.log('\n== trainer: create the invitation ==');
  await trainer.page.goto('/#/studio/invitations');
  await trainer.page.getByRole('button', { name: 'New invitation' }).click();
  const shareBlock = trainer.page.locator('.coaching-share strong');
  await shareBlock.waitFor({ timeout: 15000 });
  const shareUrl = (await shareBlock.textContent()).trim();
  ok('one-time invitation link shown', shareUrl.startsWith(`${BASE}/#/join/`), shareUrl);
  const token = shareUrl.split('/join/')[1];

  console.log('\n== client: open the link and accept ==');
  await client.page.goto(`/#/join/${token}`);
  // The h1 renders immediately with a placeholder; the preview is what we are waiting for.
  await client.page.locator('.join-consent').waitFor({ timeout: 15000 });
  const headingText = (await client.page.getByRole('heading', { level: 1 }).textContent()).trim();
  ok('invitation preview names the trainer', headingText.includes('E2E Strength Studio'), headingText);

  const consentText = (await client.page.locator('.join-consent p').first().textContent()).trim();
  ok('consent text is disclosed before joining', consentText.length > 0, consentText.slice(0, 80) + '…');

  const joinButton = client.page.getByRole('button', { name: 'Join coaching' });
  ok('join is blocked until consent is ticked', await joinButton.isDisabled());

  await client.page.getByRole('checkbox').click();
  await joinButton.click();
  await client.page.waitForFunction(() => location.hash.startsWith('#/coaching/'), null, { timeout: 20000 });
  const relationshipId = (await client.page.evaluate(() => location.hash)).replace('#/coaching/', '');
  ok('client landed in the coaching workspace', /^[0-9a-f-]{36}$/.test(relationshipId), relationshipId);

  console.log('\n== both sides agree the link exists ==');
  const clientBoot = await apiCall(client, '/api/coaching/bootstrap');
  const rel = (clientBoot.payload?.data?.relationships || []).find(r => r.id === relationshipId);
  ok('client sees the relationship as active', rel?.status === 'active',
    `trainer=${rel?.trainerId} tz=${rel?.timeZone}`);

  await trainer.page.goto('/#/studio');
  await trainer.page.getByText('E2E Client').waitFor({ timeout: 20000 });
  const overview = await apiCall(trainer, '/api/coaching/overview');
  const item = (overview.payload?.data?.items || []).find(x => x.relationship.id === relationshipId);
  ok('trainer roster shows the client', item?.client?.name === 'E2E Client',
    `active clients=${overview.payload?.data?.items?.length}`);

  console.log('\n== invariants ==');
  // Documented recovery path: the same recipient re-opening the link gets the same relationship,
  // not an error and not a duplicate (api/coaching/invitations.js accept()).
  const revisit = await apiCall(client, '/api/coaching/invitations/accept', {
    method: 'POST', body: { mutationId: uuid(), token, consentVersion: 1, confirmSharing: true }
  });
  ok('same recipient re-accepting is idempotent', revisit.status === 200 && revisit.payload?.data?.id === relationshipId,
    `HTTP ${revisit.status} id=${revisit.payload?.data?.id}`);

  // A different account must not be able to redeem an already-accepted token.
  const stranger = await newIdentity(browser, 'stranger');
  const strangerUser = await register(stranger, 'E2E Stranger');
  const steal = await apiCall(stranger, '/api/coaching/invitations/accept', {
    method: 'POST', body: { mutationId: uuid(), token, consentVersion: 1, confirmSharing: true }
  });
  ok('a used token cannot be redeemed by anyone else', steal.status === 404,
    `HTTP ${steal.status} ${steal.payload?.error?.code || ''}`);

  // One active trainer per client: a second, still-pending invitation must be refused.
  const second = await apiCall(trainer, '/api/coaching/invitations', { method: 'POST', body: { mutationId: uuid() } });
  const secondToken = second.payload?.data?.token;
  ok('trainer can issue a second invitation', !!secondToken, `state=${second.status}`);
  const doubleLink = await apiCall(client, '/api/coaching/invitations/accept', {
    method: 'POST', body: { mutationId: uuid(), token: secondToken, consentVersion: 1, confirmSharing: true }
  });
  ok('an already-linked client cannot join a second trainer', doubleLink.status === 409,
    `HTTP ${doubleLink.status} ${doubleLink.payload?.error?.code || ''}`);

  // Consent is enforced server-side, not just by the disabled button.
  const noConsent = await apiCall(stranger, '/api/coaching/invitations/accept', {
    method: 'POST', body: { mutationId: uuid(), token: secondToken, consentVersion: 1, confirmSharing: false }
  });
  ok('accepting without consent is refused by the server', noConsent.status === 422,
    `HTTP ${noConsent.status} ${noConsent.payload?.error?.code || ''}`);

  // A stranger must not see the relationship at all — denial reads as 404, never 403.
  const peek = await apiCall(stranger, `/api/coaching/workspace?relationshipId=${relationshipId}`);
  ok('an unrelated account cannot read the workspace', peek.status === 404,
    `HTTP ${peek.status} ${peek.payload?.error?.code || ''}`);

  fs.writeFileSync(new URL('./.relationship.json', import.meta.url),
    JSON.stringify({ relationshipId, trainer: state.trainer.uid, client: state.client.uid }, null, 2));
  state.stranger = { uid: strangerUser.id, name: strangerUser.name, credentials: await exportCredentials(stranger) };
  fs.writeFileSync(stateFile, JSON.stringify(state, null, 2));
  await trainer.page.screenshot({ path: new URL('./shot-trainer-roster.png', import.meta.url).pathname });
  await client.page.screenshot({ path: new URL('./shot-client-workspace.png', import.meta.url).pathname });
  console.log(`\nrelationship ${relationshipId} recorded in e2e/.relationship.json`);
} finally {
  await browser.close();
}
