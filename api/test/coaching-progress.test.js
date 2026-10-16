import test from'node:test';import assert from'node:assert/strict';import{tempCoachingData,identityAuthority,fixedClock,testUsers}from'./coaching-helpers.mjs';import{openCoachingDb}from'../coaching/db.js';import{progressService}from'../coaching/progress.js';
test('progress counts scheduled/completed separately and labels missing sync data',()=>{const identities=identityAuthority(),store=openCoachingDb({dataDir:tempCoachingData(),identities});store.insertRelationship({id:'r',trainerId:testUsers.trainerA.id,clientId:testUsers.clientA.id,timeZone:'UTC',consentText:'yes',now:'2026-09-01T00:00:00Z'});const service=progressService(store,{readPersonalState:()=>({workouts:[{id:'personal',d:'2026-09-07',entries:[]}],bodyweight:[{d:'2026-09-07',w:72}]})});const p=service.get(testUsers.clientA,'r','2026-09-01','2026-09-14');assert.equal(p.scheduled,0);assert.equal(p.personalExtra,1);assert.equal(p.sync.personalStateReceivedAt,null);assert.equal(p.weight[0].source,'personal');assert.equal('creds'in p,false);store.close()});

test('progress derives labeled strength points from completed assigned sets',()=>{const identities=identityAuthority(),store=openCoachingDb({dataDir:tempCoachingData(),identities});store.insertRelationship({id:'r',trainerId:testUsers.trainerA.id,clientId:testUsers.clientA.id,timeZone:'UTC',consentText:'yes',now:'2026-09-01T00:00:00Z'});store.db.prepare("INSERT INTO plan_assignments(id,relationship_id,kind,version,created_at,updated_at) VALUES('a','r','workout',1,'x','x')").run();store.db.prepare("INSERT INTO plan_revisions(id,assignment_id,revision_number,content_json,published_by,published_at) VALUES('v','a',1,'{}','trainer-a','x')").run();store.db.prepare("INSERT INTO workout_occurrences(id,assignment_id,relationship_id,revision_id,recurrence_key,scheduled_date,original_date,state,prescription_json,created_at,updated_at) VALUES('o','a','r','v','k','2026-09-07','2026-09-07','completed','{}','x','x')").run();store.db.prepare("INSERT INTO assigned_sessions(id,occurrence_id,relationship_id,client_id,revision_id,state,started_at,client_finished_at,received_at,scheduled_date,time_zone,unit,prescription_json,actual_json,summary_json) VALUES('s','o','r','client-a','v','finished','x','x','x','2026-09-07','UTC','kg',?,?,?)").run(JSON.stringify({exercises:[{id:'squat',name:'Back squat',mode:'reps'}]}),JSON.stringify({entries:[{id:'squat',sets:[{w:80,r:5,done:true},{w:80,r:4,done:false}]}]}),JSON.stringify({classification:'partial'}));const p=progressService(store).get(testUsers.clientA,'r','2026-09-01','2026-09-14');assert.deepEqual(p.strength,[{date:'2026-09-07',sessionId:'s',exerciseId:'squat',exerciseName:'Back squat',weight:80,reps:5,unit:'kg',source:'assigned'}]);assert.equal(p.missing.strength,false);store.close()});

test('week ranges end on the relationship date and cover exactly the requested number of days', () => {
  const store = openCoachingDb({ dataDir: tempCoachingData(), identities: identityAuthority() });
  try {
    for (const [id, timeZone, clientId] of [['east', 'Pacific/Kiritimati', testUsers.clientA.id], ['west', 'America/Los_Angeles', testUsers.clientB.id]]) {
      store.insertRelationship({ id, trainerId: testUsers.trainerA.id, clientId, timeZone, consentText: 'yes', now: '2026-09-01T00:00:00Z' });
    }
    const service = progressService(store, { now: fixedClock('2026-10-01T12:30:00Z'), readPersonalState: () => ({ workouts: [{ id: 'edge', d: '2026-10-02' }] }) });
    const east = service.get(testUsers.clientA, 'east', undefined, undefined, '4');
    assert.equal(east.to, '2026-10-02');
    assert.equal(east.from, '2026-09-05');
    assert.equal(east.personalExtra, 1);
    const west = service.get(testUsers.clientB, 'west', undefined, undefined, '4');
    assert.equal(west.to, '2026-10-01');
    assert.equal(west.from, '2026-09-04');
    assert.equal(west.personalExtra, 0);
    for (const weeks of ['0', '25', 'oops', '']) assert.throws(() => service.get(testUsers.clientA, 'east', undefined, undefined, weeks), error => error.status === 422);
  } finally { store.close(); }
});
