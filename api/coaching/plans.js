import crypto from 'node:crypto';
import { HttpError, expectedVersion } from './validation.js';

const finite = value => typeof value === 'number' && Number.isFinite(value) && value >= 0;
export function validateWorkoutContent(value) {
  if (!value || typeof value !== 'object' || !['kg', 'lb'].includes(value.unit) || !Array.isArray(value.days) || value.days.length < 1 || value.days.length > 14) throw new HttpError(422, 'VALIDATION_ERROR', 'Add at least one valid training day');
  const dayIds = new Set(); const claimedWeekdays = new Set();
  const days = value.days.map((day, dayIndex) => {
    if (!day?.id || dayIds.has(day.id) || !Array.isArray(day.weekdays) || !day.weekdays.length || day.weekdays.some(n => !Number.isInteger(n) || n < 1 || n > 7)) throw new HttpError(422, 'VALIDATION_ERROR', `Training day ${dayIndex + 1} is invalid`);
    for (const weekday of day.weekdays) {
      if (claimedWeekdays.has(weekday)) throw new HttpError(422, 'VALIDATION_ERROR', 'Each weekday can belong to only one training day');
      claimedWeekdays.add(weekday);
    }
    dayIds.add(day.id); const entryIds = new Set();
    const exercises = (day.exercises || []).map((exercise, exerciseIndex) => {
      const entryId = String(exercise?.entryId || exercise?.id || '');
      const exerciseId = String(exercise?.exerciseId || exercise?.id || '');
      if (!entryId || !exerciseId || entryIds.has(entryId) || !String(exercise.name || '').trim() || !['reps','time','cardio'].includes(exercise.mode) || !Array.isArray(exercise.sets)) throw new HttpError(422, 'VALIDATION_ERROR', `Exercise ${exerciseIndex + 1} is invalid`);
      entryIds.add(entryId);
      const sets = exercise.sets.map(set => {
        if (!set || Object.values(set).some(item => typeof item === 'number' && !finite(item))) throw new HttpError(422, 'VALIDATION_ERROR', 'Targets must be finite and nonnegative');
        if (exercise.mode === 'reps' && (!finite(set.reps) || !finite(set.weight || 0))) throw new HttpError(422, 'VALIDATION_ERROR', 'Rep targets require reps and a valid weight');
        if (exercise.mode === 'time' && !finite(set.seconds)) throw new HttpError(422, 'VALIDATION_ERROR', 'Timed targets require seconds');
        if (exercise.mode === 'cardio' && !finite(set.minutes)) throw new HttpError(422, 'VALIDATION_ERROR', 'Cardio targets require minutes');
        return structuredClone(set);
      });
      const custom = exercise.custom && typeof exercise.custom === 'object' ? {
        muscle: String(exercise.custom.muscle || '').slice(0, 100),
        equipment: String(exercise.custom.equipment || '').slice(0, 100)
      } : undefined;
      return { entryId, exerciseId, name: String(exercise.name).trim().slice(0, 100), mode: exercise.mode, sets, restSec: finite(exercise.restSec || 0) ? exercise.restSec || 0 : 0, notes: String(exercise.notes || '').slice(0, 500), ...(custom ? { custom } : {}) };
    });
    return { id: String(day.id), name: String(day.name || `Day ${dayIndex + 1}`).trim().slice(0, 100), weekdays: [...new Set(day.weekdays)].sort(), exercises };
  });
  return { name: String(value.name || 'Workout plan').trim().slice(0, 100), unit: value.unit, days };
}

export function validateWorkoutPrescription(value, base) {
  if (!value || typeof value !== 'object' || !base?.planName || !base?.dayId) throw new HttpError(422, 'VALIDATION_ERROR', 'Add a valid workout for this day');
  const normalized = validateWorkoutContent({
    name: base.planName,
    unit: value.unit,
    days: [{ id: base.dayId, name: value.dayName, weekdays: [1], exercises: value.exercises }]
  });
  const day = normalized.days[0];
  return { planName: normalized.name, dayId: day.id, dayName: day.name, unit: normalized.unit, exercises: day.exercises };
}

export function planService(store, { now = () => new Date(), validateContent = (_kind, value) => value, beforePublish = () => {}, afterPublish = () => {} } = {}) {
  return {
    sources(trainerId, { kind = 'workout', limit = 20 } = {}) {
      if (kind !== 'workout') throw new HttpError(422, 'VALIDATION_ERROR', 'Only workout plan sources are available');
      const safeLimit = Math.max(1, Math.min(50, Number(limit) || 20));
      return store.db.prepare(`SELECT pr.id AS revision_id,pr.content_json,pr.published_at,cr.client_id
        FROM plan_revisions pr
        JOIN plan_assignments pa ON pa.id=pr.assignment_id AND pa.kind='workout'
        JOIN client_relationships cr ON cr.id=pa.relationship_id
        WHERE cr.trainer_id=?
        ORDER BY pr.published_at DESC,pr.revision_number DESC
        LIMIT ?`).all(trainerId, safeLimit).map(row => {
          const content = JSON.parse(row.content_json);
          return { id: row.revision_id, sourceType: 'recent_assignment', revisionId: row.revision_id, planName: content.name, clientName: store.identities?.findUser?.(row.client_id)?.name || 'Client', publishedAt: row.published_at, content };
        });
    },
    publish(trainerId, { relationshipId, kind, sourceTemplateId = null, content, expectedVersion: requested }) {
      const version = expectedVersion(requested);
      const relationship = store.db.prepare('SELECT * FROM client_relationships WHERE id = ? AND trainer_id = ? AND status = ?').get(relationshipId, trainerId, 'active');
      if (!relationship) throw new HttpError(404, 'NOT_FOUND', 'Relationship not found');
      if (sourceTemplateId) {
        const source = store.db.prepare('SELECT id FROM plan_templates WHERE id = ? AND trainer_id = ? AND kind = ? AND archived_at IS NULL').get(sourceTemplateId, trainerId, kind);
        if (!source) throw new HttpError(404, 'NOT_FOUND', 'Template not found');
      }
      const validated = validateContent(kind, content);
      beforePublish(relationshipId, kind);
      return store.transaction(() => {
        let assignment = store.db.prepare('SELECT * FROM plan_assignments WHERE relationship_id = ? AND kind = ?').get(relationshipId, kind);
        if (!assignment) {
          if (version !== 0) throw new HttpError(409, 'VERSION_CONFLICT', 'Reload the client plan before publishing');
          const id = crypto.randomUUID();
          const at = now().toISOString();
          store.db.prepare(`INSERT INTO plan_assignments
            (id, relationship_id, kind, source_template_id, version, created_at, updated_at)
            VALUES (?, ?, ?, ?, 1, ?, ?)`)
            .run(id, relationshipId, kind, sourceTemplateId, at, at);
          assignment = store.db.prepare('SELECT * FROM plan_assignments WHERE id = ?').get(id);
        } else {
          if (assignment.version !== version) throw new HttpError(409, 'VERSION_CONFLICT', 'Reload the client plan before publishing');
          store.db.prepare('UPDATE plan_assignments SET source_template_id = ?, version = version + 1, updated_at = ? WHERE id = ?')
            .run(sourceTemplateId, now().toISOString(), assignment.id);
          assignment.version += 1;
        }
        const revisionNumber = (store.db.prepare('SELECT max(revision_number) AS n FROM plan_revisions WHERE assignment_id = ?').get(assignment.id).n || 0) + 1;
        const revisionId = crypto.randomUUID();
        const publishedAt = now().toISOString();
        store.db.prepare(`INSERT INTO plan_revisions
          (id, assignment_id, revision_number, content_json, published_by, published_at)
          VALUES (?, ?, ?, ?, ?, ?)`)
          .run(revisionId, assignment.id, revisionNumber, JSON.stringify(validated), trainerId, publishedAt);
        store.db.prepare('UPDATE plan_assignments SET current_revision_id = ? WHERE id = ?').run(revisionId, assignment.id);
        const result = { id: assignment.id, relationshipId, kind, sourceTemplateId, revisionId, revisionNumber, version: assignment.version, content: validated, publishedAt };
        afterPublish(result, relationship);
        return result;
      })();
    }
  };
}
