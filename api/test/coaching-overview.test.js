import test from 'node:test';
import assert from 'node:assert/strict';
import { tempCoachingData, identityAuthority, fixedClock, testUsers } from './coaching-helpers.mjs';
import { openCoachingDb } from '../coaching/db.js';
import { workspaceService } from '../coaching/workspaces.js';
import { checkInService } from '../coaching/check-ins.js';

// A received report remains actionable until the trainer reviews its current version.
test('overview and workspace keep unanswered and changed reports in review', () => {
  const identities = identityAuthority();
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities });
  const now = fixedClock();
  const config = { trainerIds: new Set([testUsers.trainerA.id]) };
  store.insertRelationship({ id: 'r', trainerId: testUsers.trainerA.id, clientId: testUsers.clientA.id, timeZone: 'UTC', consentText: 'yes', now: now().toISOString() });
  const checks = checkInService(store, { now });
  const workspaces = workspaceService(store, { config, identities, now });
  try {
    assert.equal(workspaces.overview(testUsers.trainerA).items[0].checkInMissing, true);
    const report = checks.save(testUsers.clientA, { relationshipId: 'r', weekStart: '2026-09-07', expectedVersion: 0, adherence: 'mostly' });
    assert.equal(report.needsReview, true);
    assert.equal(workspaces.overview(testUsers.trainerA).items[0].checkIn.needsReview, true);
    assert.equal(workspaces.get(testUsers.trainerA, 'r').checkIn.needsReview, true);
    checks.respond(testUsers.trainerA, { checkInId: report.id, expectedVersion: 0, reviewedCheckInVersion: report.version, text: 'Reviewed' });
    assert.equal(checks.get(report.id).needsReview, false);
    assert.equal(workspaces.overview(testUsers.trainerA).items[0].checkIn.needsReview, false);
    checks.save(testUsers.clientA, { relationshipId: 'r', weekStart: '2026-09-07', expectedVersion: 1, adherence: 'some' });
    assert.equal(workspaces.overview(testUsers.trainerA).items[0].checkIn.needsReview, true);
  } finally { store.close(); }
});

test('finished partial and zero results remain explicit weekly follow-up reasons',()=>{
 const identities=identityAuthority(),store=openCoachingDb({dataDir:tempCoachingData(),identities});
 const now=fixedClock('2026-09-09T06:30:00.000Z'),config={trainerIds:new Set([testUsers.trainerA.id])};
 try{
  store.insertRelationship({id:'r',trainerId:testUsers.trainerA.id,clientId:testUsers.clientA.id,timeZone:'UTC',consentText:'yes',now:now().toISOString()});
  store.db.prepare("INSERT INTO plan_assignments(id,relationship_id,kind,version,created_at,updated_at) VALUES('a','r','workout',1,'x','x')").run();
  store.db.prepare("INSERT INTO plan_revisions(id,assignment_id,revision_number,content_json,published_by,published_at) VALUES('v','a',1,'{}','trainer-a','x')").run();
  for(const [id,date,classification] of [['partial','2026-09-07','partial'],['zero','2026-09-08','zero']]){
   store.db.prepare("INSERT INTO workout_occurrences(id,assignment_id,relationship_id,revision_id,recurrence_key,scheduled_date,original_date,state,prescription_json,created_at,updated_at) VALUES(?,'a','r','v',?,?,?,'completed','{}','x','x')").run(id,id,date,date);
   store.db.prepare("INSERT INTO assigned_sessions(id,occurrence_id,relationship_id,client_id,revision_id,state,started_at,client_finished_at,received_at,scheduled_date,time_zone,unit,prescription_json,actual_json,summary_json) VALUES(?,?,'r','client-a','v','finished','x','x','x',?,'UTC','kg','{}','{}',?)").run(`s-${id}`,id,date,JSON.stringify({classification,completedSets:classification==='zero'?0:1}));
  }
  const overview=workspaceService(store,{config,identities,now}).overview(testUsers.trainerA);
  assert.equal(overview.items.length,1);
  assert.deepEqual(overview.items[0].weekly,{weekStart:'2026-09-07',weekEnd:'2026-09-13',scheduled:2,completed:1,partial:1,zero:1});
 }finally{store.close()}
});
