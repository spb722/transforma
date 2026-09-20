import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const TEST_NOW = new Date('2026-09-07T06:30:00.000Z');

export const testUsers = Object.freeze({
  trainerA: { id: 'trainer-a', name: 'Trainer A', created: '2026-01-01T00:00:00.000Z' },
  trainerB: { id: 'trainer-b', name: 'Trainer B', created: '2026-01-01T00:00:00.000Z' },
  clientA: { id: 'client-a', name: 'Client A', created: '2026-01-02T00:00:00.000Z' },
  clientB: { id: 'client-b', name: 'Client B', created: '2026-01-02T00:00:00.000Z' },
  unlinked: { id: 'unlinked', name: 'Unlinked User', created: '2026-01-03T00:00:00.000Z' }
});

export function tempCoachingData(prefix = 'transforma-coaching-test-') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  fs.writeFileSync(path.join(dir, 'secret'), 'c'.repeat(64), { mode: 0o600 });
  fs.writeFileSync(path.join(dir, 'db.json'), JSON.stringify({
    users: Object.values(testUsers), creds: [], subs: [], invites: [], coachingAdmissions: []
  }, null, 2));
  return dir;
}

export function identityAuthority(overrides = {}) {
  const users = new Map(Object.values(testUsers).map(user => [user.id, { ...user }]));
  for (const user of Object.values(overrides)) users.set(user.id, { ...user });
  return {
    findUser: id => users.get(id) || null,
    isEnabled: id => {
      const user = users.get(id);
      return !!user && !user.disabled;
    },
    users
  };
}

export function fixedClock(now = TEST_NOW) {
  const date = new Date(now);
  return () => new Date(date);
}

export function testMutationId(label = 'mutation') {
  return crypto.createHash('sha256').update(label).digest('hex').slice(0, 8) + '-0000-4000-8000-000000000000';
}

export function signedSession(user, { secret = 'c'.repeat(64), expiresAt = TEST_NOW.getTime() + 86_400_000 } = {}) {
  const payload = `${user.id}:${expiresAt}:${user.sv || 0}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('base64url');
  return `gymsid=${payload}.${signature}`;
}

export function jsonRequest({ method = 'POST', path: requestPath = '/', user = null, body = {}, origin = 'http://localhost:8080', headers = {} } = {}) {
  return {
    method,
    url: requestPath,
    user,
    headers: {
      origin,
      'content-type': 'application/json',
      ...headers
    },
    body
  };
}
