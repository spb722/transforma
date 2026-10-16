import { randomUUID } from 'node:crypto';
import { authorizeRelationship } from './access.js';
import { HttpError } from './validation.js';
import { withMutation } from './mutations.js';

export function contactService(store, { now = () => new Date() } = {}) {
  function access(user, id, permission = 'read') {
    return authorizeRelationship(user, store.db.prepare('SELECT * FROM client_relationships WHERE id=?').get(id), permission);
  }
  function preference(id) {
    return store.db.prepare('SELECT * FROM client_contact_preferences WHERE relationship_id=?').get(id) || { enabled: 0, version: 0 };
  }
  function get(user, id) {
    const rel = access(user, id);
    const row = preference(id);
    return { enabled: !!row.enabled && rel.status === 'active', whatsAppNumber: row.enabled && rel.status === 'active' ? row.whatsapp_number : null,
      version: row.version, updatedAt: row.updated_at || null,
      contacts: store.db.prepare(`SELECT id,scheduled_date AS scheduledDate,occurrence_id AS occurrenceId,
        workout_name AS workoutName,confirmed_at AS confirmedAt FROM client_contact_confirmations
        WHERE relationship_id=? ORDER BY confirmed_at DESC,rowid DESC LIMIT 20`).all(id) };
  }
  function mutate(user, id, input, operation, effect) {
    const permission = operation === 'preference' ? 'write-client' : 'write-trainer';
    access(user, id, permission);
    if (!Number.isInteger(input.expectedVersion) || input.expectedVersion < 0) throw new HttpError(422, 'INVALID_VERSION', 'Reload the contact preference before saving.');
    return withMutation(store, { actorId: user.id, mutationId: input.mutationId, operation: `contact-${operation}`,
      request: { ...input, relationshipId: id }, authorizeReplay: receipt => {
        access(user, id, permission);
        const saved = JSON.parse(receipt.response_json);
        if (preference(id).version !== saved.version) throw new HttpError(409, 'VERSION_CONFLICT', 'Contact consent changed. Reload before continuing.');
        return true;
      } }, () => {
      access(user, id, permission);
      if (preference(id).version !== input.expectedVersion) throw new HttpError(409, 'VERSION_CONFLICT', 'Contact consent changed. Reload before continuing.');
      effect();
      return get(user, id);
    }).data;
  }
  return {
    get,
    savePreference(user, id, input) {
      if (typeof input.enabled !== 'boolean') throw new HttpError(422, 'VALIDATION_ERROR', 'Choose whether to share your WhatsApp number.');
      const number = typeof input.whatsAppNumber === 'string' ? input.whatsAppNumber.trim() : '';
      if (input.enabled && !/^\+[1-9]\d{6,14}$/.test(number)) throw new HttpError(422, 'VALIDATION_ERROR', 'Enter a number with + and country code, containing 7–15 digits.');
      return mutate(user, id, input, 'preference', () => {
        store.db.prepare(`INSERT INTO client_contact_preferences(relationship_id,enabled,whatsapp_number,version,updated_at)
          VALUES(?,?,?,1,?) ON CONFLICT(relationship_id) DO UPDATE SET enabled=excluded.enabled,
          whatsapp_number=excluded.whatsapp_number,version=version+1,updated_at=excluded.updated_at`)
          .run(id, +input.enabled, input.enabled ? number : null, now().toISOString());
      });
    },
    confirm(user, id, input) {
      return mutate(user, id, input, 'confirm', () => {
        if (!preference(id).enabled) throw new HttpError(409, 'CONTACT_NOT_SHARED', 'The client has not agreed to WhatsApp contact.');
        if (input.confirmedSent !== true) throw new HttpError(422, 'CONFIRMATION_REQUIRED', 'Confirm that you sent the message yourself.');
        const date = input.scheduledDate;
        if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(Date.parse(date)) || new Date(date).toISOString().slice(0, 10) !== date) throw new HttpError(422, 'INVALID_DATE', 'Choose a valid workout date.');
        let occurrence = null;
        if (input.occurrenceId != null) {
          if (typeof input.occurrenceId !== 'string') throw new HttpError(422, 'VALIDATION_ERROR', 'Choose a valid workout.');
          occurrence = store.db.prepare('SELECT * FROM workout_occurrences WHERE id=? AND relationship_id=?').get(input.occurrenceId, id);
          if (!occurrence) throw new HttpError(404, 'NOT_FOUND', 'Workout not found.');
          if (occurrence.scheduled_date !== date) throw new HttpError(409, 'WORKOUT_CHANGED', 'The workout date changed. Reload before continuing.');
        }
        const name = occurrence ? JSON.parse(occurrence.prescription_override_json || occurrence.prescription_json).dayName || 'Workout' : null;
        store.db.prepare(`INSERT INTO client_contact_confirmations(id,relationship_id,trainer_id,scheduled_date,occurrence_id,workout_name,confirmed_at)
          VALUES(?,?,?,?,?,?,?)`).run(randomUUID(), id, user.id, date, occurrence?.id || null, name, now().toISOString());
      });
    }
  };
}
