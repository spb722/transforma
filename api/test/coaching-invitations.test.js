import test from 'node:test';
import assert from 'node:assert/strict';
import { tempCoachingData, identityAuthority, fixedClock, testUsers } from './coaching-helpers.mjs';

const { openCoachingDb } = await import('../coaching/db.js');
const { profileService } = await import('../coaching/profiles.js');
const { invitationService, CONSENT_VERSION } = await import('../coaching/invitations.js');
const { relationshipService } = await import('../coaching/relationships.js');
const { workspaceService } = await import('../coaching/workspaces.js');

function fixture(now = '2026-09-07T06:30:00.000Z') {
  const identities = identityAuthority();
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities });
  const clock = fixedClock(now);
  const config = { trainerIds: new Set([testUsers.trainerA.id, testUsers.trainerB.id]) };
  const profiles = profileService(store, { config, now: clock });
  profiles.save(testUsers.trainerA.id, { expectedVersion: 0, displayName: 'Coach A', businessTimeZone: 'Asia/Kolkata', whatsAppNumber: '+919999999999' });
  profiles.save(testUsers.trainerB.id, { expectedVersion: 0, displayName: 'Coach B', businessTimeZone: 'UTC', whatsAppNumber: null });
  return {
    store, identities, config, profiles,
    invitations: invitationService(store, { config, now: clock }),
    relationships: relationshipService(store, { now: clock }),
    workspaces: workspaceService(store, { config, identities, readPersonalState: () => null, now: clock })
  };
}

test('a seven-day invitation is secret-hashed, revocable, and single-use under concurrent acceptance', () => {
  const fx = fixture();
  const issued = fx.invitations.create(testUsers.trainerA.id);
  assert.match(issued.token, /^[A-Za-z0-9_-]{43}$/);
  assert.equal(fx.store.db.prepare('SELECT token_hash FROM invitations WHERE id = ?').get(issued.id).token_hash.includes(issued.token), false);
  assert.equal(Date.parse(issued.expiresAt) - Date.parse(issued.createdAt), 7 * 86_400_000);
  assert.equal(fx.invitations.preview(issued.token).trainer.displayName, 'Coach A');

  const accepted = fx.invitations.accept(issued.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true });
  assert.equal(accepted.clientId, testUsers.clientA.id);
  assert.equal(fx.invitations.accept(issued.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true }).id, accepted.id);
  assert.throws(() => fx.invitations.accept(issued.token, testUsers.clientB.id, { consentVersion: CONSENT_VERSION, confirmSharing: true }), error => error.status === 404);
  assert.equal(fx.store.db.prepare('SELECT count(*) AS n FROM client_relationships').get().n, 1);

  const revoked = fx.invitations.create(testUsers.trainerA.id);
  fx.invitations.revoke(testUsers.trainerA.id, revoked.id);
  assert.throws(() => fx.invitations.preview(revoked.token), error => error.status === 404);
  fx.store.close();
});

test('acceptance validates consent, expiry, self-linking, and one active trainer', () => {
  const fx = fixture();
  const invite = fx.invitations.create(testUsers.trainerA.id);
  assert.throws(() => fx.invitations.accept(invite.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: false }), error => error.status === 422);
  assert.throws(() => fx.invitations.accept(invite.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION + 1, confirmSharing: true }), error => error.code === 'CONSENT_CHANGED');
  const selfInvite = fx.invitations.create(testUsers.trainerA.id);
  assert.throws(() => fx.invitations.accept(selfInvite.token, testUsers.trainerA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true }), error => error.status === 422);

  fx.invitations.accept(invite.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true });
  const second = fx.invitations.create(testUsers.trainerB.id);
  assert.throws(() => fx.invitations.accept(second.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true }), error => error.code === 'ALREADY_LINKED');
  fx.store.close();

  const expiredFx = fixture('2026-09-15T06:30:01.000Z');
  const at = '2026-09-07T06:30:00.000Z';
  expiredFx.store.db.prepare(`INSERT INTO invitations (id, trainer_id, token_hash, created_at, expires_at)
    VALUES ('expired','trainer-a',? ,?,?)`).run(expiredFx.invitations.hashToken('expired-token'), at, '2026-09-14T06:30:00.000Z');
  assert.throws(() => expiredFx.invitations.preview('expired-token'), error => error.status === 404);
  expiredFx.store.close();
});

test('ending immediately removes trainer access while preserving the client archive and requires a fresh invite to rejoin', () => {
  const fx = fixture();
  const invite = fx.invitations.create(testUsers.trainerA.id);
  const relationship = fx.invitations.accept(invite.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true });
  assert.equal(fx.workspaces.get(testUsers.trainerA, relationship.id).relationship.status, 'active');
  const ended = fx.relationships.end(testUsers.clientA, relationship.id, relationship.version);
  assert.equal(ended.status, 'ended');
  assert.throws(() => fx.workspaces.get(testUsers.trainerA, relationship.id), error => error.status === 404);
  assert.equal(fx.workspaces.get(testUsers.clientA, relationship.id).relationship.status, 'ended');
  assert.equal(fx.invitations.accept(invite.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true }).status, 'ended');

  const fresh = fx.invitations.create(testUsers.trainerA.id);
  const rejoined = fx.invitations.accept(fresh.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true });
  assert.notEqual(rejoined.id, relationship.id);
  assert.equal(rejoined.status, 'active');
  fx.store.close();
});

test('trainer capability is independent of administration and bootstrap exposes only owned modes', () => {
  const fx = fixture();
  const trainerBootstrap = fx.workspaces.bootstrap({ ...testUsers.trainerA, admin: false });
  assert.equal(trainerBootstrap.capabilities.trainer, true);
  assert.equal(trainerBootstrap.capabilities.admin, false);
  assert.throws(() => fx.profiles.save(testUsers.clientA.id, { expectedVersion: 0, displayName: 'Self promoted', businessTimeZone: 'UTC' }), error => error.status === 403);
  const clientBootstrap = fx.workspaces.bootstrap(testUsers.clientA);
  assert.equal(clientBootstrap.capabilities.trainer, false);
  assert.deepEqual(clientBootstrap.relationships, []);
  fx.store.close();
});

test('disabled trainers invalidate pending invitations and invitation retries never reveal the token', () => {
  const fx = fixture();
  const mutationId = '44444444-4444-4444-8444-444444444444';
  const issued = fx.invitations.create(testUsers.trainerA.id, mutationId);
  assert.ok(issued.token);
  const replay = fx.invitations.create(testUsers.trainerA.id, mutationId);
  assert.equal(replay.linkUnavailable, true);
  assert.equal('token' in replay, false);
  fx.identities.users.get(testUsers.trainerA.id).disabled = true;
  assert.throws(() => fx.invitations.preview(issued.token), error => error.status === 404);
  assert.throws(() => fx.invitations.accept(issued.token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true }), error => error.status === 404);
  fx.store.close();
});
