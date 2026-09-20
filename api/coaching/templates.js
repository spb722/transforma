import crypto from 'node:crypto';
import { HttpError, expectedVersion, text } from './validation.js';

export function templateService(store, { now = () => new Date(), validateContent = (_kind, value) => value } = {}) {
  return {
    list(trainerId, kind) {
      return store.db.prepare('SELECT * FROM plan_templates WHERE trainer_id = ? AND kind = ? AND archived_at IS NULL ORDER BY updated_at DESC').all(trainerId, kind)
        .map(row => ({ ...row, content: JSON.parse(row.content_json) }));
    },
    create(trainerId, { kind, name, content }) {
      const id = crypto.randomUUID();
      const at = now().toISOString();
      const validated = validateContent(kind, content);
      store.db.prepare(`INSERT INTO plan_templates
        (id, trainer_id, kind, name, content_json, version, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, 1, ?, ?)`)
        .run(id, trainerId, kind, text(name, 'name', { max: 100 }), JSON.stringify(validated), at, at);
      return { id, trainerId, kind, name, content: validated, version: 1, createdAt: at, updatedAt: at };
    },
    update(trainerId, { templateId, expectedVersion: requested, name, content, archived = false }) {
      const version = expectedVersion(requested);
      const row = store.db.prepare('SELECT * FROM plan_templates WHERE id = ? AND trainer_id = ?').get(templateId, trainerId);
      if (!row) throw new HttpError(404, 'NOT_FOUND', 'Template not found');
      if (row.version !== version) throw new HttpError(409, 'VERSION_CONFLICT', 'Reload this template before saving');
      const at = now().toISOString();
      const validated = validateContent(row.kind, content);
      store.db.prepare(`UPDATE plan_templates SET name = ?, content_json = ?, version = version + 1,
        updated_at = ?, archived_at = ? WHERE id = ? AND trainer_id = ? AND version = ?`)
        .run(text(name, 'name', { max: 100 }), JSON.stringify(validated), at, archived ? at : null, templateId, trainerId, version);
      return { id: templateId, version: version + 1, archived, updatedAt: at };
    }
  };
}
