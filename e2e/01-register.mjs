/* Phase 1: register the two accounts with real passkeys, and prove sign-in works.
 *
 * Trainer capability comes from the TRAINER_UIDS environment variable, which the API reads at
 * boot — so this phase only creates the accounts and reports their uids. Granting the trainer
 * role and restarting the API is a separate, deliberate step.
 */
import fs from 'node:fs';
import { launch, newIdentity, register, signIn, apiCall, ok, exportCredentials } from './lib.mjs';

const browser = await launch();
try {
  const out = {};
  for (const [role, name] of [['trainer', 'E2E Trainer'], ['client', 'E2E Client']]) {
    console.log(`\n== ${role}: register "${name}" ==`);
    const id = await newIdentity(browser, role);
    const user = await register(id, name);
    ok('registered via passkey', !!user?.id, `uid=${user.id} name=${user.name}`);

    // Prove the credential is discoverable: clear the session cookie and sign back in.
    await id.context.clearCookies();
    const back = await signIn(id);
    ok('signed back in with the same passkey', back?.id === user.id, `uid=${back?.id}`);

    const me = await apiCall(id, '/api/me');
    ok('/api/me agrees', me.payload?.user?.id === user.id,
      `capabilities=${JSON.stringify(me.payload?.user?.capabilities)}`);

    out[role] = { uid: user.id, name: user.name, credentials: await exportCredentials(id) };
    await id.context.close();
  }
  fs.writeFileSync(new URL('./.state.json', import.meta.url), JSON.stringify(out, null, 2));
  console.log('\nUIDS ' + JSON.stringify({ trainer: out.trainer.uid, client: out.client.uid }));
  console.log('credentials saved to e2e/.state.json (reusable by later phases)');
} finally {
  await browser.close();
}
