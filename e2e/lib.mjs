/* Shared Playwright helpers for the coaching end-to-end flows.
 *
 * The app authenticates with WebAuthn only, so each identity gets its own browser context
 * *and* its own CDP virtual authenticator. That is what makes a real passkey registration and
 * a real discoverable-credential sign-in possible without a human touching a sensor — and it
 * keeps the two identities in genuinely separate cookie jars, so trainer and client can be
 * driven side by side rather than by swapping a cookie.
 */
import { chromium } from 'playwright';

export const BASE = process.env.E2E_BASE || 'http://localhost:8080';

export async function launch() {
  return chromium.launch({ headless: process.env.E2E_HEADED ? false : true });
}

/** A browser context with a virtual authenticator already attached. */
export async function newIdentity(browser, label) {
  const context = await browser.newContext({ baseURL: BASE });
  const page = await context.newPage();
  page.on('console', m => { if (m.type() === 'error') console.log(`   [${label} console] ${m.text()}`); });
  await page.goto('/');
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable', { enableUI: false });
  const { authenticatorId } = await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      ctap2Version: 'ctap2_1',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true
    }
  });
  return { label, context, page, cdp, authenticatorId };
}

/** Drive the real "Create new profile" sheet: name -> Create passkey. */
export async function register(identity, name) {
  const { page } = identity;
  await page.goto('/');
  await page.getByRole('button', { name: 'Create new profile' }).click();
  await page.getByPlaceholder('Your name').fill(name);
  await page.getByRole('button', { name: 'Create passkey' }).click();
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('gym_user') || 'null'), null, { timeout: 20000 });
  return page.evaluate(() => JSON.parse(localStorage.getItem('gym_user')));
}

/** Drive the real "Sign in with passkey" button (discoverable credential, no allowCredentials). */
export async function signIn(identity) {
  const { page } = identity;
  await page.goto('/');
  await page.getByRole('button', { name: 'Sign in with passkey' }).click();
  await page.waitForFunction(() => !!JSON.parse(localStorage.getItem('gym_user') || 'null'), null, { timeout: 20000 });
  return page.evaluate(() => JSON.parse(localStorage.getItem('gym_user')));
}

/** Call the app's own API from inside the page, so it carries that context's real cookie. */
export function apiCall(identity, path, { method = 'GET', body } = {}) {
  return identity.page.evaluate(async ({ path, method, body }) => {
    const r = await fetch(path, {
      method,
      credentials: 'same-origin',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body)
    });
    let payload = null;
    try { payload = await r.json(); } catch { /* non-JSON */ }
    return { status: r.status, payload };
  }, { path, method, body });
}

export const uuid = () => crypto.randomUUID();

export function ok(label, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL';
  console.log(`   ${mark}  ${label}${detail ? ' — ' + detail : ''}`);
  if (!condition) process.exitCode = 1;
  return condition;
}

/* ---------- credential persistence ----------
 * A virtual authenticator dies with its browser context, which would make every phase script
 * re-register a new account. CDP can export and re-import the private key, so a passkey created
 * once is reusable across runs — the same property a real device gives you.
 */
export async function exportCredentials(identity) {
  const { credentials } = await identity.cdp.send('WebAuthn.getCredentials', { authenticatorId: identity.authenticatorId });
  return credentials;
}

export async function importCredentials(identity, credentials, signCount) {
  for (const credential of credentials) {
    await identity.cdp.send('WebAuthn.addCredential', {
      authenticatorId: identity.authenticatorId,
      credential: signCount === undefined ? credential : { ...credential, signCount }
    });
  }
  return credentials.length;
}

/**
 * WebAuthn refuses a sign-count that does not advance, and the server keeps the highest count
 * it has seen. A credential restored from disk therefore has to come back with a count above
 * whatever the last run left behind — so the base only ever moves forward, and a run that
 * crashes half way through cannot strand the passkey below the server's counter.
 */
export function nextSignCount(state) {
  state.signCountBase = (state.signCountBase || 0) + 100;
  return state.signCountBase;
}
