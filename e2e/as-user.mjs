#!/usr/bin/env node
/* Print a paste-ready browser-console snippet that signs a browser in as an existing account,
 * without a passkey prompt.
 *
 * This is a local testing shortcut, not a back door: it re-implements exactly what the server
 * already does on a successful passkey login (HMAC-SHA256 over `uid:expiry:sessionVersion`,
 * keyed on ./data/secret), so it only works for someone who can already read ./data — which is
 * the machine's owner. Use it when a browser cannot create a platform passkey; prefer the real
 * "Sign in with passkey" button whenever it works.
 *
 * Usage:  node e2e/as-user.mjs "E2E Client"
 */
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const query = process.argv[2];
if (!query) { console.error('usage: node e2e/as-user.mjs "<account name or uid>"'); process.exit(1); }

const db = JSON.parse(fs.readFileSync(path.join(root, 'data', 'db.json'), 'utf8'));
const user = db.users.find(u => u.id === query)
  || db.users.find(u => u.name === query)
  || db.users.filter(u => u.name.toLowerCase().includes(query.toLowerCase()))[0];
if (!user) {
  console.error(`no account matching "${query}". Known accounts:`);
  for (const u of db.users) console.error(`  ${u.name}  (${u.id})`);
  process.exit(1);
}

const secret = fs.readFileSync(path.join(root, 'data', 'secret'), 'utf8').trim();
const origin = (fs.readFileSync(path.join(root, '.env'), 'utf8').match(/^ORIGIN=(.*)$/m)?.[1] || 'http://localhost:8080').trim();
const payload = `${user.id}:${Date.now() + 86_400_000}:${user.sv || 0}`;
const cookie = `${payload}.${crypto.createHmac('sha256', secret).update(payload).digest('base64url')}`;

console.log(`\nSign in as: ${user.name}  (${user.id})   valid 24h`);
console.log(`\n1. Open ${origin} in the browser you want to use.`);
console.log('2. Open the developer console (Safari: ⌥⌘C, Firefox: ⌥⌘K) and paste this one line:\n');
console.log(`document.cookie='gymsid=${cookie}; path=/'; location.href='${origin}/#/home'; location.reload()`);
console.log('\n3. The app reloads already signed in as that account.\n');
