import { HttpError } from './validation.js';

export function validateMutationRequest(req, { origin, maxBytes = 500_000 } = {}) {
  if (origin && req.headers?.origin !== origin) throw new HttpError(403, 'ORIGIN_FORBIDDEN', 'Request origin is not allowed');
  const type = String(req.headers?.['content-type'] || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/json') throw new HttpError(415, 'JSON_REQUIRED', 'Content-Type must be application/json');
  const length = Number(req.contentLength ?? req.headers?.['content-length'] ?? 0);
  if (Number.isFinite(length) && length > maxBytes) throw new HttpError(413, 'BODY_TOO_LARGE', 'Request body is too large');
}

export function requireUser(user) {
  if (!user || user.disabled) throw new HttpError(401, 'NOT_SIGNED_IN', 'Sign in to continue');
  return user;
}

export function requireTrainer(user, trainerIds) {
  requireUser(user);
  if (!trainerIds?.has(user.id)) throw new HttpError(403, 'TRAINER_REQUIRED', 'Trainer access is required');
  return user;
}

export function authorizeRelationship(user, relationship, operation = 'read') {
  requireUser(user);
  if (!relationship) throw new HttpError(404, 'NOT_FOUND', 'Record not found');
  const client = relationship.client_id === user.id;
  const activeTrainer = relationship.trainer_id === user.id && relationship.status === 'active';
  const allowed = operation === 'write-trainer' ? activeTrainer
    : operation === 'write-client' ? client && relationship.status === 'active'
      : client || activeTrainer;
  if (!allowed) throw new HttpError(404, 'NOT_FOUND', 'Record not found');
  return relationship;
}
