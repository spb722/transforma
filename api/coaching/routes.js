import { authorizeRelationship, validateMutationRequest, requireUser, requireTrainer } from './access.js';
import { dateRange, HttpError, publicError } from './validation.js';
import { withMutation } from './mutations.js';

function limiter({ max, windowMs }) {
  const buckets = new Map();
  return key => {
    const now = Date.now();
    const current = buckets.get(key);
    if (!current || current.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return;
    }
    current.count += 1;
    if (current.count > max) throw new HttpError(429, 'RATE_LIMITED', 'Too many attempts. Try again shortly.');
  };
}

export function relationshipHandlers({ store, profiles, invitations, relationships, workspaces, templates, plans, occurrences, sessions, checkIns, progress, history, fees, config }) {
  const limitPreview = limiter({ max: 30, windowMs: 60_000 });
  const relationship = (user, relationshipId, permission) => authorizeRelationship(user, store.db.prepare('SELECT * FROM client_relationships WHERE id=?').get(relationshipId), permission);
  const occurrenceRelationship = (user, occurrenceId) => {
    const row = store.db.prepare('SELECT r.* FROM workout_occurrences o JOIN client_relationships r ON r.id=o.relationship_id WHERE o.id=?').get(occurrenceId);
    return authorizeRelationship(user, row, 'write-trainer');
  };
  const checkInRelationship = (user, checkInId) => {
    const row = store.db.prepare('SELECT r.* FROM weekly_check_ins c JOIN client_relationships r ON r.id=c.relationship_id WHERE c.id=?').get(checkInId);
    return authorizeRelationship(user, row, 'write-trainer');
  };
  const feeRelationship = (user, feeId) => {
    const row = store.db.prepare('SELECT r.* FROM fees f JOIN client_relationships r ON r.id=f.relationship_id WHERE f.id=?').get(feeId);
    return authorizeRelationship(user, row, 'write-trainer');
  };
  const mutate = (user, body, operation, effect, authorizeReplay = () => true) => withMutation(store, { actorId: user.id, mutationId: body.mutationId, operation, request: body, authorizeReplay }, effect).data;
  return {
    'GET /api/coaching/bootstrap': ({ user }) => workspaces.bootstrap(requireUser(user)),
    'PUT /api/coaching/profile': ({ user, body }) => { user=requireTrainer(requireUser(user),config.trainerIds); return mutate(user,body,'profile.save',()=>profiles.save(user.id,body),()=>config.trainerIds.has(user.id)); },
    'POST /api/coaching/invitations': ({ user, body }) => {
      const invitation = invitations.create(requireUser(user).id, body.mutationId);
      if (invitation.linkUnavailable) return { created: false, data: invitation };
      return { created: true, data: { ...invitation, shareUrl: `${config.origin}/#/join/${invitation.token}` } };
    },
    'GET /api/coaching/invitations': ({ user }) => ({ items: invitations.list(requireUser(user).id), nextCursor: null }),
    'POST /api/coaching/invitations/preview': ({ req, body }) => {
      const ip = req.socket?.remoteAddress || 'unknown';
      limitPreview(ip);
      return invitations.preview(body.token);
    },
    'POST /api/coaching/invitations/revoke': ({ user, body }) => { user=requireTrainer(requireUser(user),config.trainerIds);return mutate(user,body,'invitation.revoke',()=>invitations.revoke(user.id,body.invitationId),()=>!!store.db.prepare('SELECT id FROM invitations WHERE id=? AND trainer_id=?').get(body.invitationId,user.id)); },
    'POST /api/coaching/invitations/accept': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'invitation.accept',()=>invitations.accept(body.token,user.id,body)); },
    'POST /api/coaching/relationships/end': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'relationship.end',()=>relationships.end(user,body.relationshipId,body.expectedVersion)); },
    'GET /api/coaching/overview': ({ user }) => workspaces.overview(requireUser(user)),
    'GET /api/coaching/workspace': ({ user, url }) => workspaces.get(requireUser(user), url.searchParams.get('relationshipId')),
    'GET /api/coaching/templates': ({ user, url }) => templates.list(requireTrainer(requireUser(user),config.trainerIds).id, url.searchParams.get('kind')),
    'GET /api/coaching/plan-sources': ({ user, url }) => plans.sources(requireTrainer(requireUser(user),config.trainerIds).id, { kind: url.searchParams.get('kind') || 'workout', limit: url.searchParams.get('limit') }),
    'POST /api/coaching/templates': ({ user, body }) => { user=requireTrainer(requireUser(user),config.trainerIds);return mutate(user,body,'template.create',()=>templates.create(user.id,body),receipt=>!!store.db.prepare('SELECT id FROM plan_templates WHERE id=? AND trainer_id=?').get(receipt.resource_id,user.id)); },
    'PUT /api/coaching/templates': ({ user, body }) => { user=requireTrainer(requireUser(user),config.trainerIds);return mutate(user,body,'template.update',()=>templates.update(user.id,body),()=>!!store.db.prepare('SELECT id FROM plan_templates WHERE id=? AND trainer_id=?').get(body.templateId,user.id)); },
    'POST /api/coaching/plans/publish': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'plan.publish',()=>plans.publish(user.id,body),()=>relationship(user,body.relationshipId,'write-trainer')); },
    'POST /api/coaching/occurrences/move': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'occurrence.move',()=>occurrences.move(user,body.occurrenceId,body.expectedVersion,body.scheduledDate),()=>occurrenceRelationship(user,body.occurrenceId)); },
    'POST /api/coaching/occurrences/reset': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'occurrence.reset',()=>occurrences.reset(user,body.occurrenceId,body.expectedVersion),()=>occurrenceRelationship(user,body.occurrenceId)); },
    'POST /api/coaching/occurrences/customize': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'occurrence.customize',()=>occurrences.customize(user,body.occurrenceId,body.expectedVersion,body.prescription),()=>occurrenceRelationship(user,body.occurrenceId)); },
    'POST /api/coaching/occurrences/cancel': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'occurrence.cancel',()=>occurrences.cancel(user,body.occurrenceId,body.expectedVersion),()=>occurrenceRelationship(user,body.occurrenceId)); },
    'POST /api/coaching/occurrences/restore': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'occurrence.restore',()=>occurrences.restore(user,body.occurrenceId,body.expectedVersion,body.scheduledDate),()=>occurrenceRelationship(user,body.occurrenceId)); },
    'POST /api/coaching/sessions/start': ({ user, body }) => sessions.start(requireUser(user),body),
    'PUT /api/coaching/sessions/result': ({ user, body }) => sessions.finish(requireUser(user),body),
    'GET /api/coaching/sessions': ({ user, url }) => sessions.list(requireUser(user),url.searchParams.get('relationshipId')),
    'PUT /api/coaching/check-ins': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'check-in.save',()=>checkIns.save(user,body),()=>relationship(user,body.relationshipId,'write-client')); },
    'PUT /api/coaching/check-ins/response': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'check-in.respond',()=>checkIns.respond(user,body),()=>checkInRelationship(user,body.checkInId)); },
    'GET /api/coaching/progress': ({ user, url }) => { const range=dateRange(url.searchParams.get('from'),url.searchParams.get('to')); return progress.get(requireUser(user),url.searchParams.get('relationshipId'),range.from,range.to); },
    'GET /api/coaching/history': ({ user, url }) => { const range=dateRange(url.searchParams.get('from'),url.searchParams.get('to')); return history.list(requireUser(user),url.searchParams.get('relationshipId'),range.from,range.to); },
    'GET /api/coaching/fees': ({ user, url }) => fees.list(requireUser(user),url.searchParams.get('relationshipId')),
    'POST /api/coaching/fees': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'fee.create',()=>fees.create(user,body),()=>relationship(user,body.relationshipId,'write-trainer')); },
    'POST /api/coaching/fees/confirm': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'fee.confirm',()=>fees.confirm(user,body),()=>feeRelationship(user,body.feeId)); },
    'POST /api/coaching/fees/correct': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'fee.correct',()=>fees.correct(user,body),()=>feeRelationship(user,body.feeId)); },
    'POST /api/coaching/fees/void': ({ user, body }) => { user=requireUser(user);return mutate(user,body,'fee.void',()=>fees.void(user,body),()=>feeRelationship(user,body.feeId)); }
  };
}

export function coachingRoutes({ handlers = {}, json, readBody, readSession, config }) {
  const routes = {};
  for (const [key, handler] of Object.entries(handlers)) {
    routes[key] = async (req, res) => {
      try {
        if (req.method !== 'GET') validateMutationRequest(req, { origin: config.origin, maxBytes: config.maxBodyBytes });
        const user = readSession(req);
        const body = req.method === 'GET' ? {} : await readBody(req, config.maxBodyBytes);
        const data = await handler({ req, user, body, url: new URL(req.url, 'http://local') });
        json(res, data?.created ? 201 : 200, { data: data?.data ?? data, serverTime: new Date().toISOString() });
      } catch (error) {
        if (!(error instanceof HttpError) && error?.message === 'body too large') error = new HttpError(413, 'BODY_TOO_LARGE', 'Request body is too large');
        if (!(error instanceof HttpError) && error?.message === 'bad json') error = new HttpError(400, 'BAD_JSON', 'Request body must be valid JSON');
        if (!(error instanceof HttpError)) console.error(`${req.method} ${new URL(req.url, 'http://local').pathname}`, error);
        const output = publicError(error);
        json(res, output.status, output.body);
      }
    };
  }
  return routes;
}
