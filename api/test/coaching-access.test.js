import test from 'node:test';
import assert from 'node:assert/strict';
import { jsonRequest, testUsers } from './coaching-helpers.mjs';
import { tempCoachingData, identityAuthority, testMutationId } from './coaching-helpers.mjs';
import { openCoachingDb } from '../coaching/db.js';
import { relationshipHandlers } from '../coaching/routes.js';
import { workspaceService } from '../coaching/workspaces.js';

const access = await import('../coaching/access.js');
const validation = await import('../coaching/validation.js');
const { loadCoachingConfig } = await import('../coaching/config.js');

test('cookie-authenticated mutation boundaries require the configured origin and JSON', () => {
  const valid = jsonRequest({ user: testUsers.clientA });
  assert.doesNotThrow(() => access.validateMutationRequest(valid, { origin: 'http://localhost:8080', maxBytes: 500_000 }));
  assert.throws(() => access.validateMutationRequest(jsonRequest({ user: testUsers.clientA, origin: 'https://evil.example' }), { origin: 'http://localhost:8080' }), error => error.status === 403);
  assert.throws(() => access.validateMutationRequest(jsonRequest({ user: testUsers.clientA, headers: { 'content-type': 'text/plain' } }), { origin: 'http://localhost:8080' }), error => error.status === 415);
  assert.throws(() => access.validateMutationRequest({ ...valid, contentLength: 500_001 }, { origin: 'http://localhost:8080', maxBytes: 500_000 }), error => error.status === 413);
});

test('authentication, trainer capability, and relationship access are independent', () => {
  assert.throws(() => access.requireUser(null), error => error.status === 401);
  assert.throws(() => access.requireUser({ ...testUsers.clientA, disabled: true }), error => error.status === 401);
  assert.equal(access.requireTrainer(testUsers.trainerA, new Set([testUsers.trainerA.id])).id, testUsers.trainerA.id);
  assert.throws(() => access.requireTrainer({ ...testUsers.clientA, admin: true }, new Set([testUsers.trainerA.id])), error => error.status === 403);

  const active = { id: 'r1', trainer_id: testUsers.trainerA.id, client_id: testUsers.clientA.id, status: 'active' };
  assert.equal(access.authorizeRelationship(testUsers.trainerA, active, 'read').id, 'r1');
  assert.equal(access.authorizeRelationship(testUsers.clientA, active, 'write-client').id, 'r1');
  assert.throws(() => access.authorizeRelationship(testUsers.clientB, active, 'read'), error => error.status === 404);
  assert.throws(() => access.authorizeRelationship(testUsers.clientA, active, 'write-trainer'), error => error.status === 404);
  const ended = { ...active, status: 'ended' };
  assert.equal(access.authorizeRelationship(testUsers.clientA, ended, 'read').id, 'r1');
  assert.throws(() => access.authorizeRelationship(testUsers.trainerA, ended, 'read'), error => error.status === 404);
});

test('pagination, date ranges, versions, and public errors stay bounded', () => {
  assert.deepEqual(validation.pageInput({ limit: '500', cursor: 'opaque' }), { limit: 100, cursor: 'opaque' });
  assert.throws(() => validation.dateRange('2025-01-01', '2026-09-07'), error => error.status === 422);
  assert.equal(validation.expectedVersion(0), 0);
  assert.throws(() => validation.expectedVersion(-1), error => error.status === 422);
  const conflict = validation.publicError(new validation.HttpError(409, 'VERSION_CONFLICT', 'Reload', { version: 'changed' }));
  assert.deepEqual(conflict, { status: 409, body: { error: { code: 'VERSION_CONFLICT', message: 'Reload', fields: { version: 'changed' } } } });
  const hidden = validation.publicError(new Error('SQL and private body text'));
  assert.deepEqual(hidden, { status: 500, body: { error: { code: 'INTERNAL', message: 'Server error' } } });
});

test('trainer and fee configuration is strict and independently scoped', () => {
  const config = loadCoachingConfig({
    ORIGIN: 'https://gym.example.com',
    TRAINER_UIDS: 'trainer-a, trainer-b',
    COACHING_PAYMENT_HOSTS: 'checkout.example.com',
    COACHING_CURRENCIES: '{"INR":2,"JPY":0}'
  });
  assert.deepEqual([...config.trainerIds], ['trainer-a', 'trainer-b']);
  assert.equal(config.allowedPaymentHosts.has('checkout.example.com'), true);
  assert.equal(config.supportedCurrencies.get('INR'), 2);
  assert.equal(config.feeSetupReady, true);
  assert.equal(loadCoachingConfig({ TRAINER_UIDS: 'trainer-a' }).feeSetupReady, false);
  assert.throws(() => loadCoachingConfig({ COACHING_PAYMENT_HOSTS: '*.example.com' }), /Invalid/);
  assert.throws(() => loadCoachingConfig({ COACHING_CURRENCIES: '{"inr":2}' }), /Invalid/);
});

test('an idempotent replay rechecks current relationship access', () => {
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities: identityAuthority() });
  store.insertRelationship({ id: 'replay-rel', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'yes', now: '2026-09-07T00:00:00Z' });
  const handlers = relationshipHandlers({
    store,
    plans: { publish: () => ({ id: 'assignment-id', version: 1 }) },
    config: { trainerIds: new Set([testUsers.trainerA.id]) }
  });
  const body = { mutationId: testMutationId('replay-access'), relationshipId: 'replay-rel', kind: 'workout', expectedVersion: 0, content: {} };
  const first = handlers['POST /api/coaching/plans/publish']({ user: testUsers.trainerA, body });
  assert.equal(first.id, 'assignment-id');
  store.db.prepare("UPDATE client_relationships SET status='ended' WHERE id='replay-rel'").run();
  assert.throws(() => handlers['POST /api/coaching/plans/publish']({ user: testUsers.trainerA, body }), error => error.status === 404);
  store.close();
});

test('ended archives remain client-owned across diet, check-in, and fee resources', () => {
  const identities = identityAuthority();
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities });
  store.insertRelationship({ id: 'archive-rel', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'yes', now: '2026-09-01T00:00:00Z' });
  store.db.prepare("INSERT INTO plan_assignments(id,relationship_id,kind,version,created_at,updated_at) VALUES('archive-diet','archive-rel','diet',1,'x','x')").run();
  store.db.prepare("INSERT INTO plan_revisions(id,assignment_id,revision_number,content_json,published_by,published_at) VALUES('archive-diet-v1','archive-diet',1,?,'trainer-a','x')").run(JSON.stringify({ name: 'Archive diet', meals: [] }));
  store.db.prepare("UPDATE plan_assignments SET current_revision_id='archive-diet-v1' WHERE id='archive-diet'").run();
  store.db.prepare("INSERT INTO weekly_check_ins(id,relationship_id,week_start,adherence,version,created_at,updated_at) VALUES('archive-check','archive-rel','2026-09-07','mostly',1,'x','x')").run();
  store.db.prepare("INSERT INTO fees(id,relationship_id,amount_minor,currency,exponent,period_start,period_end,due_date,time_zone,payment_url,payment_host,status,version,created_by,created_at,updated_at) VALUES('archive-fee','archive-rel',1000,'INR',2,'2026-09-01','2026-09-30','2026-09-07','UTC','https://pay.example.test/f','pay.example.test','unpaid',1,'trainer-a','x','x')").run();
  store.db.prepare("UPDATE client_relationships SET status='ended',ended_at='2026-09-08T00:00:00Z',ended_by='client-a',version=2 WHERE id='archive-rel'").run();
  const workspaces = workspaceService(store, { config: { trainerIds: new Set([testUsers.trainerA.id]), supportedCurrencies: new Map() }, identities });
  const archive = workspaces.get(testUsers.clientA, 'archive-rel');
  assert.equal(archive.diet.content.name, 'Archive diet');
  assert.equal(archive.checkIn.adherence, 'mostly');
  assert.equal(archive.fees[0].relationshipStatus, 'ended');
  assert.throws(() => workspaces.get(testUsers.trainerA, 'archive-rel'), error => error.status === 404);
  assert.throws(() => workspaces.get(testUsers.unlinked, 'archive-rel'), error => error.status === 404);
  assert.throws(() => workspaces.get({ ...testUsers.clientA, disabled: true }, 'archive-rel'), error => error.status === 401);
  store.close();
});
