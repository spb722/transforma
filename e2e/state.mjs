#!/usr/bin/env node
/* Print the coaching state the server actually holds — accounts, who is a trainer, live
 * relationships, pending invitations. Read-only. Run it before and after each manual step to
 * see exactly what your clicking changed.
 *
 * Usage:  node e2e/state.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const require_ = createRequire(path.join(root, 'api', 'package.json'));
const Database = require_('better-sqlite3');

const db = JSON.parse(fs.readFileSync(path.join(root, 'data', 'db.json'), 'utf8'));
const env = fs.readFileSync(path.join(root, '.env'), 'utf8');
const trainerIds = new Set((env.match(/^TRAINER_UIDS=(.*)$/m)?.[1] || '').split(',').map(s => s.trim()).filter(Boolean));
const name = id => db.users.find(u => u.id === id)?.name || id;

const sql = new Database(path.join(root, 'data', 'coaching.sqlite'), { readonly: true });
const profiles = new Map(sql.prepare('SELECT * FROM trainer_profiles').all().map(p => [p.user_id, p]));

console.log('\nACCOUNTS');
for (const u of db.users) {
  const tags = [
    trainerIds.has(u.id) ? 'TRAINER' : null,
    profiles.has(u.id) ? `studio:"${profiles.get(u.id).display_name}"` : null,
    u.disabled ? 'DISABLED' : null,
    db.creds.some(c => c.userId === u.id) ? null : 'NO-PASSKEY'
  ].filter(Boolean);
  console.log(`  ${u.id}  ${u.name.padEnd(14)} ${tags.join(' ')}`);
}

console.log('\nRELATIONSHIPS');
const rels = sql.prepare('SELECT * FROM client_relationships ORDER BY started_at').all();
if (!rels.length) console.log('  (none)');
for (const r of rels) {
  console.log(`  ${r.status.toUpperCase().padEnd(6)} ${name(r.trainer_id)} -> ${name(r.client_id)}  v${r.version}  tz=${r.time_zone}  ${r.id}`);
}

console.log('\nINVITATIONS');
const now = Date.now();
const invites = sql.prepare('SELECT * FROM invitations ORDER BY created_at DESC').all();
if (!invites.length) console.log('  (none)');
for (const i of invites) {
  const state = i.accepted_by ? `accepted by ${name(i.accepted_by)}`
    : i.revoked_at ? 'revoked'
      : Date.parse(i.expires_at) <= now ? 'expired' : 'PENDING';
  console.log(`  ${state.padEnd(28)} from ${name(i.trainer_id)}   expires ${i.expires_at.slice(0, 16).replace('T', ' ')}`);
}

console.log('\nASSIGNED WORK');
const assignments = sql.prepare(`SELECT a.kind, a.relationship_id, count(o.id) AS occurrences
  FROM plan_assignments a LEFT JOIN workout_occurrences o ON o.assignment_id = a.id GROUP BY a.id`).all();
if (!assignments.length) console.log('  (no plans published)');
for (const a of assignments) {
  const r = rels.find(x => x.id === a.relationship_id);
  console.log(`  ${a.kind.padEnd(8)} for ${r ? name(r.client_id) : a.relationship_id}   occurrences=${a.occurrences}`);
}
const checkIns = sql.prepare('SELECT count(*) AS n FROM weekly_check_ins').get().n;
const fees = sql.prepare('SELECT count(*) AS n FROM fees').get().n;
console.log(`  check-ins=${checkIns}  fees=${fees}`);
console.log();
