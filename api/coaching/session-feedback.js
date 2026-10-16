import { authorizeRelationship } from './access.js';
import { HttpError, uuid } from './validation.js';
import { withMutation } from './mutations.js';

export function sessionFeedback(row) {
  const content = row.feedback_json ? JSON.parse(row.feedback_json) : {};
  return { sessionId: row.id, note: content.note || '', difficulty: content.difficulty ?? null,
    pain: content.pain ?? null, version: row.feedback_version || 0, updatedAt: row.feedback_updated_at || null,
    reviewedAt: row.feedback_reviewed_at || null, response: row.feedback_response || '',
    needsAttention: !!(row.feedback_version && !row.feedback_reviewed_at && (content.note || content.difficulty != null || content.pain != null)) };
}

function text(value, field) {
  if (value == null) return '';
  if (typeof value !== 'string' || value.trim().length > 1000) throw new HttpError(422, 'VALIDATION_ERROR', `${field} must be text, up to 1,000 characters`);
  return value.trim();
}
function rating(value, field, minimum, maximum) {
  if (value == null || value === '') return null;
  if (!Number.isInteger(value) || value < minimum || value > maximum) throw new HttpError(422, 'VALIDATION_ERROR', `${field} must be a whole number from ${minimum} to ${maximum}`);
  return value;
}
function version(value) {
  if (!Number.isInteger(value) || value < 0) throw new HttpError(422, 'INVALID_VERSION', 'A valid feedback version is required');
  return value;
}

export function sessionFeedbackService(store, { now = () => new Date() } = {}) {
  function access(user, sessionId, operation = 'read') {
    uuid(sessionId, 'sessionId');
    const row = store.db.prepare('SELECT * FROM assigned_sessions WHERE id=?').get(sessionId);
    const rel = row && store.db.prepare('SELECT * FROM client_relationships WHERE id=?').get(row.relationship_id);
    // Owners may upload feedback for their saved result after ending coaching, just as they may upload the result itself.
    authorizeRelationship(user, rel, operation === 'client' ? 'read' : operation);
    if (operation === 'client' && row.client_id !== user.id) throw new HttpError(404, 'NOT_FOUND', 'Session not found');
    return row;
  }
  function mutate(user, sessionId, input, operation, effect) {
    access(user, sessionId, operation === 'save' ? 'client' : 'write-trainer');
    version(input.expectedVersion);
    return withMutation(store, { actorId: user.id, mutationId: input.mutationId, operation: `session-feedback-${operation}`,
      request: { sessionId, ...input }, now: now().toISOString(),
      authorizeReplay: () => !!access(user, sessionId, operation === 'save' ? 'client' : 'write-trainer') }, () => {
      const row = access(user, sessionId, operation === 'save' ? 'client' : 'write-trainer');
      if (row.feedback_version !== input.expectedVersion) throw new HttpError(409, 'VERSION_CONFLICT', 'Feedback changed. Reload it before saving again.');
      effect(row, now().toISOString());
      return sessionFeedback(access(user, sessionId));
    }).data;
  }
  return {
    get: (user, sessionId) => sessionFeedback(access(user, sessionId)),
    save(user, sessionId, input) {
      const content = { note: text(input.note, 'Note'), difficulty: rating(input.difficulty, 'Difficulty', 1, 5), pain: rating(input.pain, 'Pain', 0, 10) };
      return mutate(user, sessionId, input, 'save', (row, at) => {
        if (row.state === 'started') throw new HttpError(409, 'RESULT_PENDING', 'Save the workout result before sending feedback.');
        store.db.prepare(`UPDATE assigned_sessions SET feedback_json=?,feedback_version=feedback_version+1,
          feedback_updated_at=?,feedback_reviewed_at=NULL WHERE id=?`).run(JSON.stringify(content), at, row.id);
      });
    },
    review(user, sessionId, input) {
      const response = text(input.response, 'Response');
      return mutate(user, sessionId, input, 'review', (row, at) => {
        if (!row.feedback_version) throw new HttpError(409, 'FEEDBACK_MISSING', 'There is no feedback to review yet.');
        store.db.prepare(`UPDATE assigned_sessions SET feedback_response=?,feedback_reviewed_at=?,
          feedback_version=feedback_version+1 WHERE id=?`).run(response, at, row.id);
      });
    }
  };
}
