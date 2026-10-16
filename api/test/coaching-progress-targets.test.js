import test from 'node:test';
import assert from 'node:assert/strict';
import {tempCoachingData,identityAuthority,testUsers} from './coaching-helpers.mjs';
import {openCoachingDb} from '../coaching/db.js';
import {progressService} from '../coaching/progress.js';

test('normalized assigned exercise entries retain names and logging modes in progress',()=>{
 const store=openCoachingDb({dataDir:tempCoachingData(),identities:identityAuthority()});
 try{
  store.insertRelationship({id:'r',trainerId:testUsers.trainerA.id,clientId:testUsers.clientA.id,timeZone:'UTC',consentText:'yes',now:'2026-09-01T00:00:00Z'});
  store.db.prepare("INSERT INTO plan_assignments(id,relationship_id,kind,version,created_at,updated_at) VALUES('a','r','workout',1,'x','x')").run();
  store.db.prepare("INSERT INTO plan_revisions(id,assignment_id,revision_number,content_json,published_by,published_at) VALUES('v','a',1,'{}','trainer-a','x')").run();
  store.db.prepare("INSERT INTO workout_occurrences(id,assignment_id,relationship_id,revision_id,recurrence_key,scheduled_date,original_date,state,prescription_json,created_at,updated_at) VALUES('o','a','r','v','k','2026-09-07','2026-09-07','completed','{}','x','x')").run();
  const prescription={exercises:[{entryId:'set-a',exerciseId:'squat',name:'Goblet Squat',mode:'reps'},{entryId:'set-b',exerciseId:'squat',name:'Timed squat hold',mode:'time'}]};
  const actual={entries:[{entryId:'set-a',id:'squat',sets:[{w:18,r:6,done:true}]},{entryId:'set-b',id:'squat',sets:[{w:18,sec:45,done:true}]}]};
  store.db.prepare("INSERT INTO assigned_sessions(id,occurrence_id,relationship_id,client_id,revision_id,state,started_at,client_finished_at,received_at,scheduled_date,time_zone,unit,prescription_json,actual_json,summary_json) VALUES('s','o','r','client-a','v','finished','x','x','x','2026-09-07','UTC','kg',?,?,'{}')").run(JSON.stringify(prescription),JSON.stringify(actual));
  const progress=progressService(store).get(testUsers.trainerA,'r','2026-09-01','2026-09-14');
  assert.deepEqual(progress.strength,[{date:'2026-09-07',sessionId:'s',exerciseId:'squat',exerciseName:'Goblet Squat',weight:18,reps:6,unit:'kg',source:'assigned'}]);
 }finally{store.close()}
});
