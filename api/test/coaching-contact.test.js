import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { contactService } from '../coaching/contact.js';
import { openCoachingDb } from '../coaching/db.js';
import { tempCoachingData, identityAuthority, testUsers } from './coaching-helpers.mjs';
const request = (patch = {}) => ({ mutationId: randomUUID(), expectedVersion: 0, enabled: true, whatsAppNumber: '+919876543210', ...patch });
function fixture(t) {
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities: identityAuthority() });
  t.after(() => store.close());
  store.insertRelationship({ id: 'r', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'yes', now: '2026-09-01T00:00:00Z' });
  return { store, service: contactService(store) };
}
test('contact is opt-in, manually confirmed, idempotent and revocable', t => {
  const { service } = fixture(t);
  const input = request();
  assert.equal(service.get(testUsers.trainerA, 'r').enabled, false);
  assert.throws(() => service.confirm(testUsers.trainerA, 'r', request({ confirmedSent: true, scheduledDate: '2026-10-02' })), e => e.code === 'CONTACT_NOT_SHARED');
  const shared = service.savePreference(testUsers.clientA, 'r', input);
  assert.deepEqual(service.savePreference(testUsers.clientA, 'r', input), shared);
  const confirm = request({ expectedVersion: 1, confirmedSent: true, scheduledDate: '2026-10-02' });
  const sent = service.confirm(testUsers.trainerA, 'r', confirm);
  assert.equal(sent.contacts.length, 1);
  assert.deepEqual(service.confirm(testUsers.trainerA, 'r', confirm), sent);
  const revoked = service.savePreference(testUsers.clientA, 'r', request({ expectedVersion: 1, enabled: false }));
  assert.equal(revoked.whatsAppNumber, null);
  assert.equal(revoked.contacts.length, 1);
  assert.throws(() => service.confirm(testUsers.trainerA, 'r', confirm), e => e.code === 'VERSION_CONFLICT');
  assert.throws(() => service.savePreference(testUsers.clientA, 'r', input), e => e.code === 'VERSION_CONFLICT');
});
test('unrelated accounts and incorrect roles cannot use contact', t => {
  const { service } = fixture(t);
  for (const user of [testUsers.clientB, testUsers.trainerB]) {
    assert.throws(() => service.get(user, 'r'), e => e.status === 404);
    assert.throws(() => service.savePreference(user, 'r', request()), e => e.status === 404);
    assert.throws(() => service.confirm(user, 'r', request()), e => e.status === 404);
  }
  assert.throws(() => service.savePreference(testUsers.trainerA, 'r', request()), e => e.status === 404);
  assert.throws(() => service.confirm(testUsers.clientA, 'r', request()), e => e.status === 404);
});
test('ending coaching blocks contact writes and trainer reads and replays', t => {
  const { store, service } = fixture(t);
  service.savePreference(testUsers.clientA, 'r', request());
  const confirm = request({ expectedVersion: 1, confirmedSent: true, scheduledDate: '2026-10-02' });
  service.confirm(testUsers.trainerA, 'r', confirm);
  store.db.prepare("UPDATE client_relationships SET status='ended' WHERE id='r'").run();
  assert.throws(() => service.confirm(testUsers.trainerA, 'r', confirm), e => e.status === 404);
  assert.throws(() => service.get(testUsers.trainerA, 'r'), e => e.status === 404);
  assert.throws(() => service.savePreference(testUsers.clientA, 'r', request({ expectedVersion: 1, enabled: false })), e => e.status === 404);
  assert.equal(service.get(testUsers.clientA, 'r').enabled, false);
});
test('invalid phone, consent, version, dates and implicit sending are rejected', t => {
  const { service } = fixture(t);
  for (const patch of [{ whatsAppNumber: '9876543210' }, { whatsAppNumber: '+01234567' }, { enabled: 'yes' }, { expectedVersion: undefined }]) {
    assert.throws(() => service.savePreference(testUsers.clientA, 'r', request(patch)), e => e.status === 422);
  }
  service.savePreference(testUsers.clientA, 'r', request());
  for (const patch of [{ confirmedSent: false }, { scheduledDate: '2026-02-30' }, { scheduledDate: '' }]) {
    assert.throws(() => service.confirm(testUsers.trainerA, 'r', request({ expectedVersion: 1, confirmedSent: true, scheduledDate: '2026-10-02', ...patch })), e => e.status === 422);
  }
  assert.throws(() => service.confirm(testUsers.trainerA, 'r', request({ expectedVersion: 1, confirmedSent: true, scheduledDate: '2026-10-02', occurrenceId: 'someone-elses-workout' })), e => e.status === 404);
});
