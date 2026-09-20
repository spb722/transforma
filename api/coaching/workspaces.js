import { HttpError } from './validation.js';
import { authorizeRelationship, requireUser } from './access.js';
import { addDays, dateInZone, mondayOf } from './dates.js';

const rel = row => ({
  id: row.id, trainerId: row.trainer_id, clientId: row.client_id, status: row.status,
  timeZone: row.time_zone, startedAt: row.started_at, endedAt: row.ended_at, version: row.version
});

const trainerProfile = row => row ? {
  userId: row.user_id, displayName: row.display_name, businessTimeZone: row.business_time_zone,
  whatsAppNumber: row.whatsapp_number, version: row.version, createdAt: row.created_at, updatedAt: row.updated_at
} : null;
const currentCheckIn = (store, relationshipId) => {
  const row = store.db.prepare('SELECT * FROM weekly_check_ins WHERE relationship_id=? ORDER BY week_start DESC LIMIT 1').get(relationshipId);
  if (!row) return null;
  const reply = store.db.prepare('SELECT * FROM check_in_responses WHERE check_in_id=?').get(row.id);
  return { id:row.id,relationshipId:row.relationship_id,weekStart:row.week_start,adherence:row.adherence,weightValue:row.weight_value,weightUnit:row.weight_unit,notes:row.notes,version:row.version,updatedAt:row.updated_at,response:reply?{id:reply.id,text:reply.text,version:reply.version,reviewedCheckInVersion:reply.reviewed_check_in_version,updatedAt:reply.updated_at}:null,needsReview:!!reply&&reply.reviewed_check_in_version!==row.version };
};

export function workspaceService(store, { config, identities, readPersonalState = () => null, occurrences, now = () => new Date() } = {}) {
  const clientName = id => identities.findUser(id)?.name || 'Client';
  return {
    bootstrap(user) {
      requireUser(user);
      const rows = store.db.prepare('SELECT * FROM client_relationships WHERE client_id = ? ORDER BY started_at DESC').all(user.id);
      return {
        capabilities: { trainer: config.trainerIds.has(user.id), client: true, admin: user.admin === true },
        trainerProfile: trainerProfile(store.db.prepare('SELECT * FROM trainer_profiles WHERE user_id = ?').get(user.id)),
        relationships: rows.map(rel),
        feeSetupReady: config.feeSetupReady === true,
        currencies: [...(config.supportedCurrencies || new Map())].map(([code,exponent])=>({code,exponent}))
      };
    },
    overview(user) {
      requireUser(user);
      if (!config.trainerIds.has(user.id)) throw new HttpError(403, 'TRAINER_REQUIRED', 'Trainer access is required');
      occurrences?.catchUpAll();
      const items = store.db.prepare("SELECT * FROM client_relationships WHERE trainer_id = ? AND status = 'active' ORDER BY started_at DESC").all(user.id)
          .map(row => {
            const today = dateInZone(now(), row.time_zone);
            const weekStart = mondayOf(today);
            const weekEnd = addDays(weekStart, 6);
            const weekly = store.db.prepare(`SELECT
              sum(CASE WHEN state <> 'canceled' THEN 1 ELSE 0 END) AS scheduled,
              sum(CASE WHEN state = 'completed' THEN 1 ELSE 0 END) AS completed
              FROM workout_occurrences WHERE relationship_id=? AND scheduled_date BETWEEN ? AND ?`).get(row.id, weekStart, weekEnd);
            const feeRows=store.db.prepare("SELECT amount_minor,currency,exponent,due_date,time_zone FROM fees WHERE relationship_id=? AND status='unpaid'").all(row.id);
            const checkIn = currentCheckIn(store,row.id);
            const feeTotals = [...feeRows.reduce((totals, fee) => { const current=totals.get(fee.currency)||{currency:fee.currency,exponent:fee.exponent,amountMinor:0};current.amountMinor+=fee.amount_minor;totals.set(fee.currency,current);return totals; },new Map()).values()];
            return { relationship: rel(row), client: { id: row.client_id, name: clientName(row.client_id) }, weekly: { weekStart, weekEnd, scheduled: weekly.scheduled || 0, completed: weekly.completed || 0 }, checkIn, checkInMissing: !checkIn || checkIn.weekStart !== weekStart, fees: feeRows.map(f=>({amountMinor:f.amount_minor,currency:f.currency,exponent:f.exponent,overdue:dateInZone(now(),f.time_zone)>f.due_date})), feeTotals };
          });
      const feeTotals = [...items.flatMap(item=>item.feeTotals).reduce((totals, fee) => { const current=totals.get(fee.currency)||{currency:fee.currency,exponent:fee.exponent,amountMinor:0};current.amountMinor+=fee.amountMinor;totals.set(fee.currency,current);return totals; },new Map()).values()];
      return {
        items,
        feeTotals,
        nextCursor: null
      };
    },
    get(user, relationshipId) {
      const row = store.db.prepare('SELECT * FROM client_relationships WHERE id = ?').get(relationshipId);
      authorizeRelationship(user, row, 'read');
      occurrences?.catchUpRelationship(row.id);
      const state = readPersonalState(row.client_id) || {};
      const trainer = trainerProfile(store.db.prepare('SELECT * FROM trainer_profiles WHERE user_id = ?').get(row.trainer_id));
      const assignment = store.db.prepare("SELECT a.*,r.content_json,r.published_at FROM plan_assignments a LEFT JOIN plan_revisions r ON r.id=a.current_revision_id WHERE a.relationship_id=? AND a.kind='workout'").get(row.id);
      const workout = assignment ? { id: assignment.id, version: assignment.version, revisionId: assignment.current_revision_id, sourceTemplateId: assignment.source_template_id, content: JSON.parse(assignment.content_json), publishedAt: assignment.published_at, occurrences: store.db.prepare('SELECT id,scheduled_date AS scheduledDate,original_date AS originalDate,override_date AS overrideDate,state,cancellation_reason AS cancellationReason,version,prescription_json AS prescriptionJson,prescription_override_json AS prescriptionOverrideJson,override_updated_at AS customizedAt FROM workout_occurrences WHERE relationship_id=? ORDER BY scheduled_date').all(row.id).map(item=>{const override=item.prescriptionOverrideJson;return {...item,prescription:JSON.parse(override||item.prescriptionJson),customized:!!override,prescriptionJson:undefined,prescriptionOverrideJson:undefined}}) } : null;

      const dietRow = store.db.prepare("SELECT a.*,r.content_json,r.published_at FROM plan_assignments a LEFT JOIN plan_revisions r ON r.id=a.current_revision_id WHERE a.relationship_id=? AND a.kind='diet'").get(row.id);
      const diet = dietRow ? { id:dietRow.id,version:dietRow.version,revisionId:dietRow.current_revision_id,content:JSON.parse(dietRow.content_json),publishedAt:dietRow.published_at } : null;
      const fees=store.db.prepare('SELECT * FROM fees WHERE relationship_id=? ORDER BY due_date DESC').all(row.id).map(f=>({id:f.id,relationshipId:f.relationship_id,amountMinor:f.amount_minor,currency:f.currency,exponent:f.exponent,periodStart:f.period_start,periodEnd:f.period_end,dueDate:f.due_date,paymentUrl:f.payment_url,paymentHost:f.payment_host,status:f.status,paidDate:f.paid_date,version:f.version,relationshipStatus:row.status,overdue:f.status==='unpaid'&&dateInZone(now(),f.time_zone)>f.due_date,events:store.db.prepare('SELECT type,actor_id AS actorId,paid_date AS paidDate,reason,created_at AS createdAt FROM fee_events WHERE fee_id=? ORDER BY created_at,rowid').all(f.id)}));
      return {
        relationship: rel(row),
        client: { id: row.client_id, name: clientName(row.client_id) },
        trainer,
        personalSummary: { workouts: (state.workouts || []).length, weighIns: (state.bodyweight || []).length },
        workout, diet, checkIn: currentCheckIn(store,row.id), fees
      };
    }
  };
}
