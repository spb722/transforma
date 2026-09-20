import { HttpError, expectedVersion } from './validation.js';
import { authorizeRelationship } from './access.js';

const shape = row => ({
  id: row.id, trainerId: row.trainer_id, clientId: row.client_id, status: row.status,
  timeZone: row.time_zone, consentVersion: row.consent_version, consentedAt: row.consented_at,
  startedAt: row.started_at, endedAt: row.ended_at, endedBy: row.ended_by, version: row.version
});

export function relationshipService(store, { now = () => new Date(), beforeEnd = () => {} } = {}) {
  return {
    end(actor, relationshipId, requestedVersion) {
      const version = expectedVersion(requestedVersion);
      return store.transaction(() => {
        const row = store.db.prepare('SELECT * FROM client_relationships WHERE id = ?').get(relationshipId);
        authorizeRelationship(actor, row, 'read');
        if (row.status === 'ended') return shape(row);
        if (row.version !== version) throw new HttpError(409, 'VERSION_CONFLICT', 'Reload this relationship before ending it');
        beforeEnd(row);
        const at = now().toISOString();
        store.db.prepare(`UPDATE client_relationships SET status = 'ended', ended_at = ?, ended_by = ?, version = version + 1
          WHERE id = ? AND version = ?`).run(at, actor.id, relationshipId, version);
        return shape(store.db.prepare('SELECT * FROM client_relationships WHERE id = ?').get(relationshipId));
      })();
    }
  };
}
