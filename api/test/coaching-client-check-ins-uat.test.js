import test from 'node:test'
import assert from 'node:assert/strict'
import { tempCoachingData, identityAuthority, fixedClock, testUsers } from './coaching-helpers.mjs'
import { openCoachingDb } from '../coaching/db.js'
import { profileService } from '../coaching/profiles.js'
import { invitationService, CONSENT_VERSION } from '../coaching/invitations.js'
import { checkInService } from '../coaching/check-ins.js'
import { relationshipHandlers } from '../coaching/routes.js'
import { relationshipService } from '../coaching/relationships.js'

function fixture() {
  const identities = identityAuthority(), store = openCoachingDb({ dataDir: tempCoachingData(), identities }), now = fixedClock()
  const config = { trainerIds: new Set([testUsers.trainerA.id]) }
  profileService(store, { config, now }).save(testUsers.trainerA.id, { expectedVersion: 0, displayName: 'Care Studio', businessTimeZone: 'Asia/Kolkata' })
  const invitations = invitationService(store, { config, now })
  const rel = invitations.accept(invitations.create(testUsers.trainerA.id).token, testUsers.clientA.id, { consentVersion: CONSENT_VERSION, confirmSharing: true })
  const checkIns = checkInService(store, { now }), handlers = relationshipHandlers({ checkIns })
  return { store, rel, checkIns, handlers, now }
}

test('current Monday report retains dated prior report and response through GET route', () => {
  const x = fixture()
  try {
    const prior = x.checkIns.save(testUsers.clientA, { relationshipId: x.rel.id, weekStart: '2026-08-31', expectedVersion: 0, adherence: 'mostly', notes: 'Prior week' })
    x.checkIns.respond(testUsers.trainerA, { checkInId: prior.id, reviewedCheckInVersion: 1, expectedVersion: 0, text: 'Prior feedback' })
    const current = x.checkIns.save(testUsers.clientA, { relationshipId: x.rel.id, weekStart: '2026-09-07', expectedVersion: 0, adherence: 'some', weightValue: 71.4, weightUnit: 'kg', notes: 'New week' })
    const rows = x.handlers['GET /api/coaching/check-ins']({ user: testUsers.clientA, url: new URL(`http://local/api/coaching/check-ins?relationshipId=${x.rel.id}`) })
    assert.deepEqual(rows.map(row => row.id), [current.id, prior.id])
    assert.equal(rows[1].response.text, 'Prior feedback')
    assert.equal(rows[1].version, 1)
  } finally { x.store.close() }
})

test('history route denies guest/unrelated users/revoked trainer and retains owned archive', () => {
  const x = fixture()
  try {
    x.checkIns.save(testUsers.clientA, { relationshipId: x.rel.id, weekStart: '2026-09-07', expectedVersion: 0, adherence: 'all', notes: 'Private report' })
    const get = user => x.handlers['GET /api/coaching/check-ins']({ user, url: new URL(`http://local/api/coaching/check-ins?relationshipId=${x.rel.id}`) })
    assert.throws(() => get(null), error => error.status === 401)
    for (const user of [testUsers.clientB, testUsers.trainerB, testUsers.unlinked]) assert.throws(() => get(user), error => error.status === 404)
    assert.equal(get(testUsers.trainerA)[0].notes, 'Private report')
    relationshipService(x.store, { now: x.now }).end(testUsers.clientA, x.rel.id, 1)
    assert.throws(() => get(testUsers.trainerA), error => error.status === 404)
    assert.equal(get(testUsers.clientA)[0].notes, 'Private report')
  } finally { x.store.close() }
})
