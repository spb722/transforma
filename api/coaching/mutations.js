import crypto from 'node:crypto';
import { HttpError, uuid } from './validation.js';

export function stableStringify(value) {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

export const requestHash = value => crypto.createHash('sha256').update(stableStringify(value)).digest('hex');

export function withMutation(store, { actorId, mutationId, operation, request, authorizeReplay = () => true, now = new Date().toISOString() }, effect) {
  uuid(mutationId, 'mutationId');
  const hash = requestHash(request);
  const existing = store.db.prepare('SELECT * FROM mutation_receipts WHERE actor_id = ? AND mutation_id = ?').get(actorId, mutationId);
  if (existing) {
    if (!authorizeReplay(existing)) throw new HttpError(404, 'NOT_FOUND', 'Record not found');
    if (existing.request_hash !== hash || existing.operation !== operation) throw new HttpError(409, 'IDEMPOTENCY_CONFLICT', 'This operation ID was already used with different data');
    return { replay: true, data: JSON.parse(existing.response_json) };
  }
  return store.transaction(() => {
    const data = effect();
    store.db.prepare(`INSERT INTO mutation_receipts
      (actor_id, mutation_id, operation, resource_id, request_hash, response_json, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)`)
      .run(actorId, mutationId, operation, data?.id || null, hash, JSON.stringify(data), now);
    return { replay: false, data };
  })();
}
