import crypto from 'node:crypto';
import { authorizeRelationship } from './access.js';
import { dateInZone, isoWeekday, validIsoDate } from './dates.js';
import { expectedVersion, HttpError, text } from './validation.js';

const response = row => row ? { id: row.id, text: row.text, reviewedCheckInVersion: row.reviewed_check_in_version, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at } : null;
const shape = (row, reply = null) => ({ id: row.id, relationshipId: row.relationship_id, weekStart: row.week_start, adherence: row.adherence, weightValue: row.weight_value, weightUnit: row.weight_unit, notes: row.notes, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at, response: response(reply), needsReview: !!reply && reply.reviewed_check_in_version !== row.version });

export function checkInService(store, { now = () => new Date() } = {}) {
  const get = id => {
    const row = store.db.prepare('SELECT * FROM weekly_check_ins WHERE id=?').get(id);
    return row ? shape(row, store.db.prepare('SELECT * FROM check_in_responses WHERE check_in_id=?').get(id)) : null;
  };
  return {
    get,
    list(user, relationshipId) {
      const relationship = store.db.prepare('SELECT * FROM client_relationships WHERE id=?').get(relationshipId);
      authorizeRelationship(user, relationship, 'read');
      return store.db.prepare('SELECT id FROM weekly_check_ins WHERE relationship_id=? ORDER BY week_start DESC').all(relationshipId).map(row => get(row.id));
    },
    save(user, input) {
      const relationship = store.db.prepare('SELECT * FROM client_relationships WHERE id=?').get(input.relationshipId);
      authorizeRelationship(user, relationship, 'write-client');
      if (!validIsoDate(input.weekStart) || isoWeekday(input.weekStart) !== 1 || input.weekStart > dateInZone(now(), relationship.time_zone)) throw new HttpError(422, 'VALIDATION_ERROR', 'Choose a current or past Monday');
      if (!['all', 'mostly', 'some', 'none'].includes(input.adherence)) throw new HttpError(422, 'VALIDATION_ERROR', 'Choose an adherence option');
      const version = expectedVersion(input.expectedVersion), current = store.db.prepare('SELECT * FROM weekly_check_ins WHERE relationship_id=? AND week_start=?').get(relationship.id, input.weekStart);
      if ((!current && version !== 0) || (current && current.version !== version)) throw new HttpError(409, 'VERSION_CONFLICT', 'Reload this check-in before saving');
      const weight = input.weightValue == null || input.weightValue === '' ? null : Number(input.weightValue), unit = weight == null ? null : input.weightUnit;
      if (weight != null && (!Number.isFinite(weight) || weight <= 0 || !['kg', 'lb'].includes(unit))) throw new HttpError(422, 'VALIDATION_ERROR', 'Enter a valid weight and unit');
      const at = now().toISOString(), notes = text(input.notes || '', 'notes', { min: 0, max: 2000 });
      if (!current) store.db.prepare('INSERT INTO weekly_check_ins VALUES (?,?,?,?,?,?,?,?,?,?)').run(crypto.randomUUID(), relationship.id, input.weekStart, input.adherence, weight, unit, notes, 1, at, at);
      else store.db.prepare('UPDATE weekly_check_ins SET adherence=?,weight_value=?,weight_unit=?,notes=?,version=version+1,updated_at=? WHERE id=?').run(input.adherence, weight, unit, notes, at, current.id);
      return get(current?.id || store.db.prepare('SELECT id FROM weekly_check_ins WHERE relationship_id=? AND week_start=?').get(relationship.id, input.weekStart).id);
    },
    respond(user, input) {
      const check = store.db.prepare('SELECT c.*,r.trainer_id,r.client_id,r.status AS relationship_status FROM weekly_check_ins c JOIN client_relationships r ON r.id=c.relationship_id WHERE c.id=?').get(input.checkInId);
      authorizeRelationship(user, check && { id: check.relationship_id, trainer_id: check.trainer_id, client_id: check.client_id, status: check.relationship_status }, 'write-trainer');
      if (check.version !== input.reviewedCheckInVersion) throw new HttpError(409, 'VERSION_CONFLICT', 'The client updated this check-in. Review it again.');
      const version = expectedVersion(input.expectedVersion), current = store.db.prepare('SELECT * FROM check_in_responses WHERE check_in_id=?').get(check.id);
      if ((!current && version !== 0) || (current && current.version !== version)) throw new HttpError(409, 'VERSION_CONFLICT', 'Reload the trainer response before saving');
      const at = now().toISOString(), body = text(input.text, 'text', { max: 2000 });
      if (!current) store.db.prepare('INSERT INTO check_in_responses VALUES (?,?,?,?,?,?,?)').run(crypto.randomUUID(), check.id, body, check.version, 1, at, at);
      else store.db.prepare('UPDATE check_in_responses SET text=?,reviewed_check_in_version=?,version=version+1,updated_at=? WHERE id=?').run(body, check.version, at, current.id);
      return get(check.id).response;
    }
  };
}
