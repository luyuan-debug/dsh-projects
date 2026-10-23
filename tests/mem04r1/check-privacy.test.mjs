// A private index preview remains private even after its canonical row is gone.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Projects} from '../../src/product/domain/projects.mjs';
import {ProjectHindsightRuntime} from '../../src/product/host/project-hindsight-runtime.mjs';
const clone=value=>structuredClone(value);
function table(){const data=new Map();return {get:key=>clone(data.get(key)),entries:()=>[...data].map(([key,value])=>[key,clone(value)]),put:async(key,value)=>data.set(key,clone(value))};}

test('private index-preview usage alone blocks report Retain after a private entry is archived, deleted or absent',async t=>{
 for(const variant of ['archived','deleted','absent']){
  const registry=new Projects({table:table(),createScope:async()=>({projectId:'p',coordinatorSessionId:'co'}),validateModel:async()=>{}});await registry.create({name:'Synthetic private preview'});
  await registry.table.put('p',{...registry.get('p'),memoryEntries:variant==='absent'?[]:[{entryId:'private-preview',revision:2,status:'archived',deleted:variant==='deleted',scope:{kind:'thread',threadId:'thread'}}]});
  const tables={preferences:table(),outbox:table(),runs:table()},calls=[];
  const runtime=new ProjectHindsightRuntime({registry,tables,namespace:'r1-private-preview',clientFactory:()=>({bank:async()=>{calls.push('bank');return {bankId:'synthetic-bank'};},retain:async()=>{calls.push('retain');return {status:'completed'};}})});t.after(()=>runtime.close());
  await runtime.settings({projectId:'p',expectedRevision:0,config:{enabled:true,endpoint:'http://127.0.0.1:1',bankId:'synthetic-bank',bankScopeConfirmed:true,routeAuthorization:'local-free',retainEnabled:true,shareReportsConfirmed:true}});
  await tables.preferences.put('memory-used:p',{packets:[{sessionId:'session',turnId:1,used:[{entryId:'public-fullbody',scope:{kind:'project'}}],indexPreview:{entries:[{entryId:'private-preview',revision:1,scope:{kind:'thread',threadId:'thread'},providedLevel:'index-preview'}]}}]});
  const report={reportId:'report-'+variant,runId:'run-'+variant,sessionId:'session',turn:1,threadId:'thread',activity:'Idle',reason:null,errors:[],outputs:[{text:'Synthetic terminal report that could reveal facts from a private index description.'}],libraryRefs:[],resultRefs:[],trust:'untrusted-thread-output'};
  const row={projectId:'p',reportId:report.reportId,runId:report.runId,report,delivery:'prepared'};
  await tables.runs.put(report.runId,{runId:report.runId,projectId:'p',sessionId:'session',threadId:'thread',turn:1,endedAt:1,endReason:{kind:'completed'}});await tables.outbox.put(report.reportId,row);
  const result=await runtime.queueReport('p',row);await runtime.drain();
  assert.deepEqual(result,{queued:false,reason:'private_or_sensitive_report'},variant);
  assert.deepEqual(calls,[],variant+' must never reach bank/Retain');assert.equal(runtime.state('p').outbox.length,0);
 }
});
