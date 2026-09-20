import crypto from 'node:crypto';
import { HttpError } from './validation.js';
import { requireTrainer } from './access.js';
import { requestHash } from './mutations.js';
import { uuid } from './validation.js';

export const CONSENT_VERSION = 1;
export const CONSENT_TEXT = 'I agree to share my existing workout and weight history, assigned plans, check-ins, and fee records with this trainer while coaching is active.';

const hashToken = token => crypto.createHash('sha256').update(String(token || ''), 'utf8').digest('hex');
const invitationState = (row, now) => row.accepted_by ? 'accepted' : row.revoked_at ? 'revoked' : Date.parse(row.expires_at) <= now.getTime() ? 'expired' : 'pending';

function relationship(row) {
  if (!row) return null;
  return {
    id: row.id, trainerId: row.trainer_id, clientId: row.client_id, status: row.status,
    timeZone: row.time_zone, consentVersion: row.consent_version, consentedAt: row.consented_at,
    startedAt: row.started_at, endedAt: row.ended_at, endedBy: row.ended_by, version: row.version
  };
}

export function invitationService(store, { config, now = () => new Date() } = {}) {
  const service = {
    hashToken,
    canAdmitHash(tokenHash) {
      const row = store.db.prepare('SELECT * FROM invitations WHERE token_hash = ?').get(tokenHash);
      return !!row && invitationState(row, now()) === 'pending' && !!store.identities?.isEnabled?.(row.trainer_id);
    },
    create(trainerId, mutationId = null) {
      requireTrainer(store.assertAccount(trainerId), config.trainerIds);
      const profile = store.db.prepare('SELECT user_id FROM trainer_profiles WHERE user_id = ?').get(trainerId);
      if (!profile) throw new HttpError(409, 'PROFILE_REQUIRED', 'Complete trainer settings before inviting a client');
      if (mutationId) {
        uuid(mutationId, 'mutationId');
        const receipt = store.db.prepare('SELECT * FROM mutation_receipts WHERE actor_id = ? AND mutation_id = ?').get(trainerId, mutationId);
        if (receipt) {
          if (receipt.operation !== 'invitation.create' || receipt.request_hash !== requestHash({})) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'This operation ID was already used with different data');
          return JSON.parse(receipt.response_json);
        }
      }
      const token = crypto.randomBytes(32).toString('base64url');
      const id = crypto.randomUUID();
      const createdAt = now().toISOString();
      const expiresAt = new Date(now().getTime() + 7 * 86_400_000).toISOString();
      store.transaction(() => {
        store.db.prepare('INSERT INTO invitations (id, trainer_id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?, ?)').run(id, trainerId, hashToken(token), createdAt, expiresAt);
        if (mutationId) store.db.prepare(`INSERT INTO mutation_receipts(actor_id,mutation_id,operation,resource_id,request_hash,response_json,created_at) VALUES (?,?,?,?,?,?,?)`).run(trainerId, mutationId, 'invitation.create', id, requestHash({}), JSON.stringify({ id, createdAt, expiresAt, linkUnavailable: true }), createdAt);
      })();
      return { id, token, createdAt, expiresAt };
    },
    list(trainerId) {
      requireTrainer(store.assertAccount(trainerId), config.trainerIds);
      return store.db.prepare('SELECT * FROM invitations WHERE trainer_id = ? ORDER BY created_at DESC').all(trainerId)
        .map(row => ({ id: row.id, state: invitationState(row, now()), createdAt: row.created_at, expiresAt: row.expires_at, acceptedAt: row.accepted_at, acceptedBy: row.accepted_by }));
    },
    preview(token) {
      const row = store.db.prepare(`SELECT i.*, p.display_name, p.business_time_zone
        FROM invitations i JOIN trainer_profiles p ON p.user_id = i.trainer_id WHERE i.token_hash = ?`).get(hashToken(token));
      if (!row || invitationState(row, now()) !== 'pending' || !store.identities?.isEnabled?.(row.trainer_id)) throw new HttpError(404, 'INVITATION_UNAVAILABLE', 'This invitation is unavailable. Ask the trainer for a new link.');
      return {
        trainer: { id: row.trainer_id, displayName: row.display_name, businessTimeZone: row.business_time_zone },
        expiresAt: row.expires_at,
        consentVersion: CONSENT_VERSION,
        consentText: CONSENT_TEXT
      };
    },
    revoke(trainerId, invitationId) {
      requireTrainer(store.assertAccount(trainerId), config.trainerIds);
      const row = store.db.prepare('SELECT * FROM invitations WHERE id = ? AND trainer_id = ?').get(invitationId, trainerId);
      if (!row) throw new HttpError(404, 'NOT_FOUND', 'Invitation not found');
      if (row.accepted_by) throw new HttpError(409, 'INVITATION_ACCEPTED', 'End the coaching relationship instead');
      if (!row.revoked_at) store.db.prepare('UPDATE invitations SET revoked_at = ? WHERE id = ?').run(now().toISOString(), invitationId);
      return { id: invitationId, state: 'revoked' };
    },
    accept(token, clientId, input) {
      store.assertAccount(clientId);
      const tokenHash = hashToken(token);
      return store.transaction(() => {
        const row = store.db.prepare('SELECT * FROM invitations WHERE token_hash = ?').get(tokenHash);
        if (row?.accepted_by === clientId && row.relationship_id) return relationship(store.db.prepare('SELECT * FROM client_relationships WHERE id = ?').get(row.relationship_id));
        if (!row || invitationState(row, now()) !== 'pending' || !store.identities?.isEnabled?.(row.trainer_id)) throw new HttpError(404, 'INVITATION_UNAVAILABLE', 'This invitation is unavailable. Ask the trainer for a new link.');
        if (input.consentVersion !== CONSENT_VERSION) throw new HttpError(409, 'CONSENT_CHANGED', 'The sharing terms changed. Review them before joining.');
        if (input.confirmSharing !== true) throw new HttpError(422, 'CONSENT_REQUIRED', 'Confirm sharing before joining');
        if (clientId === row.trainer_id) throw new HttpError(422, 'SELF_INVITATION', 'A trainer cannot invite their own account');
        const existing = store.db.prepare("SELECT * FROM client_relationships WHERE client_id = ? AND status = 'active'").get(clientId);
        if (existing) throw new HttpError(409, 'ALREADY_LINKED', 'End the current coaching relationship before joining another');
        const profile = store.db.prepare('SELECT * FROM trainer_profiles WHERE user_id = ?').get(row.trainer_id);
        const id = crypto.randomUUID();
        const at = now().toISOString();
        store.insertRelationship({ id, trainerId: row.trainer_id, clientId, timeZone: profile.business_time_zone, consentText: CONSENT_TEXT, consentVersion: CONSENT_VERSION, now: at });
        store.db.prepare('UPDATE invitations SET accepted_by = ?, accepted_at = ?, relationship_id = ? WHERE id = ? AND accepted_by IS NULL')
          .run(clientId, at, id, row.id);
        return relationship(store.db.prepare('SELECT * FROM client_relationships WHERE id = ?').get(id));
      })();
    }
  };
  return service;
}
