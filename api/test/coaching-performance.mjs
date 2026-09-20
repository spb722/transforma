import { performance } from 'node:perf_hooks';
import { tempCoachingData, identityAuthority, testUsers } from './coaching-helpers.mjs';
import { openCoachingDb } from '../coaching/db.js';
import { workspaceService } from '../coaching/workspaces.js';

const extra = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`client${i}`, { id: `perf-client-${i}`, name: `Client ${i}` }]));
const identities = identityAuthority(extra), store = openCoachingDb({ dataDir: tempCoachingData('transforma-perf-'), identities });
for (let i = 0; i < 10; i++) store.insertRelationship({ id:`perf-r-${i}`,trainerId:testUsers.trainerA.id,clientId:`perf-client-${i}`,timeZone:'UTC',consentText:'test',now:'2026-09-01T00:00:00Z' });
const workspaces=workspaceService(store,{config:{trainerIds:new Set([testUsers.trainerA.id]),supportedCurrencies:new Map(),feeSetupReady:false},identities,readPersonalState:()=>({workouts:Array.from({length:200},(_,i)=>({id:`w-${i}`})),bodyweight:[]})});
const overviewSamples=[],workspaceSamples=[];for(let round=0;round<100;round++){let start=performance.now();workspaces.overview(testUsers.trainerA);overviewSamples.push(performance.now()-start);start=performance.now();workspaces.get(testUsers.trainerA,`perf-r-${round%10}`);workspaceSamples.push(performance.now()-start)}
const measure=(samples,targetMs)=>{samples.sort((a,b)=>a-b);const p95=samples[Math.floor(samples.length*.95)];return{samples:samples.length,p95Ms:+p95.toFixed(2),maxMs:+samples.at(-1).toFixed(2),targetMs,pass:p95<=targetMs}};
const result={overview:measure(overviewSamples,500),mobileWorkspaceServer:measure(workspaceSamples,2000),scope:'local server processing; excludes browser/network, passkeys, checkout, and intentional contention'};console.log(JSON.stringify(result));store.close();if(!result.overview.pass||!result.mobileWorkspaceServer.pass)process.exitCode=1;
