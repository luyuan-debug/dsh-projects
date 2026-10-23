// Actual runtime with synthetic clients/tables only. No network, service, OAuth or model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {setImmediate as tick} from 'node:timers/promises';
import {Projects} from '../../src/product/domain/projects.mjs';
import {ProjectHindsightRuntime} from '../../src/product/host/project-hindsight-runtime.mjs';

const clone=value=>structuredClone(value);
const deferred=()=>{let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};};
const error=(code,status)=>Object.assign(new Error('Synthetic backend detail must not be displayed'),{code,...status?{status}:{}});
function table(){const values=new Map();return {get:key=>clone(values.get(key)),entries:()=>[...values].map(([key,value])=>[key,clone(value)]),put:async(key,value)=>values.set(key,clone(value))};}
async function fixture(t){
 const registry=new Projects({table:table(),createScope:async()=>({projectId:'p',coordinatorSessionId:'co'}),validateModel:async()=>{}});await registry.create({name:'Synthetic R1 check'});
 const tables={preferences:table(),outbox:table(),runs:table()},calls=[];
 const behavior={health:async()=>({healthy:true,version:'1.1.0'}),bank:async bankId=>({bankId})};
 const client={health:async options=>{calls.push({method:'health',signal:options.signal});return behavior.health(options);},bank:async(bankId,options)=>{calls.push({method:'bank',bankId,signal:options.signal});return behavior.bank(bankId,options);}};
 const factory=()=>client;
 const runtime=new ProjectHindsightRuntime({registry,tables,namespace:'check-status-offline',clientFactory:factory});t.after(()=>runtime.close());
 const settings=config=>runtime.settings({projectId:'p',expectedRevision:runtime.state('p').config.revision,config});
 await settings({endpoint:'http://127.0.0.1:1',bankId:'synthetic-bank'});
 return {runtime,registry,tables,behavior,calls,settings,factory};
}
const settled=promise=>promise.then(value=>({value}),error=>({error}));
const check=f=>f.runtime.check({projectId:'p'});

test('successful check followed by health network failure clears historical reachable and recovers independently',async t=>{
 const f=await fixture(t);await check(f);const successful=f.runtime.state('p').status;
 assert.equal(successful.connection,'reachable');assert.equal(successful.bank,'accessible');
 f.behavior.health=async()=>{throw error('HINDSIGHT_NETWORK');};
 await assert.rejects(check(f),{code:'HINDSIGHT_CHECK_FAILED'});
 const failed=f.runtime.state('p').status;
 assert.equal(failed.connection,'failed');assert.equal(failed.bank,'not_checked');
 assert.equal(failed.checkPhase,'failed');assert.equal(failed.checkFailureStage,'health');assert.equal(failed.message,'HINDSIGHT_NETWORK');
 assert.deepEqual(failed.capabilities,{});assert.notEqual(failed.checkAttempt,successful.checkAttempt);
 assert.equal(failed.lastSuccessfulCheckAt,successful.lastSuccessfulCheckAt);
 assert.equal(f.calls.filter(call=>call.method==='bank').length,1,'Failed health never reuses or probes bank');
 f.behavior.health=async()=>({healthy:true,version:'1.1.0'});await check(f);
 const recovered=f.runtime.state('p').status;
 assert.equal(recovered.connection,'reachable');assert.equal(recovered.bank,'accessible');assert.equal(recovered.checkPhase,'complete');assert.equal(recovered.message,null);
 assert.notEqual(recovered.checkAttempt,failed.checkAttempt);assert.ok(recovered.lastSuccessfulCheckAt>=successful.lastSuccessfulCheckAt);
});

test('an unhealthy health result fails the current check and never calls bank',async t=>{
 const f=await fixture(t);await check(f);f.behavior.health=async()=>({healthy:false,status:'unhealthy',version:'1.1.0'});
 const bankCalls=f.calls.filter(call=>call.method==='bank').length;
 await assert.rejects(check(f),{code:'HINDSIGHT_CHECK_FAILED'});
 const status=f.runtime.state('p').status;
 assert.equal(status.connection,'failed');assert.equal(status.bank,'not_checked');assert.equal(status.checkFailureStage,'health');assert.equal(status.message,'HINDSIGHT_UNHEALTHY');
 assert.equal(f.calls.filter(call=>call.method==='bank').length,bankCalls);
});

for(const httpStatus of [404,401])test('healthy service plus bank HTTP '+httpStatus+' reports the current bank failure only',async t=>{
 const f=await fixture(t);await check(f);f.behavior.bank=async()=>{throw error('HINDSIGHT_HTTP_ERROR',httpStatus);};
 await assert.rejects(check(f),{code:'HINDSIGHT_CHECK_FAILED'});
 const status=f.runtime.state('p').status;
 assert.equal(status.connection,'reachable');assert.equal(status.bank,'failed');assert.equal(status.checkPhase,'failed');assert.equal(status.checkFailureStage,'bank');
 assert.equal(status.message,'HTTP_'+httpStatus);assert.equal(status.capabilities.apiVersion,'1.1.0');assert.equal(status.capabilities.recall,'not_tested');assert.equal(status.capabilities.retain,'not_tested');
});

test('each active check exposes fresh health and bank stages without historical green or stale metadata',async t=>{
 const f=await fixture(t);await check(f);const old=f.runtime.state('p').status;
 const health=deferred(),bank=deferred();f.behavior.health=()=>health.promise;f.behavior.bank=()=>bank.promise;
 const pending=settled(check(f));await tick();let status=f.runtime.state('p').status;
 assert.equal(status.connection,'checking');assert.equal(status.bank,'not_checked');assert.equal(status.checkPhase,'health');assert.equal(status.checkedAt,null);assert.equal(status.message,null);assert.deepEqual(status.capabilities,{});
 assert.equal(typeof status.checkStartedAt,'number');assert.notEqual(status.checkAttempt,old.checkAttempt);assert.equal(status.lastSuccessfulCheckAt,old.lastSuccessfulCheckAt);
 health.resolve({healthy:true,version:'1.1.0'});await tick();status=f.runtime.state('p').status;
 assert.equal(status.connection,'reachable');assert.equal(status.bank,'checking');assert.equal(status.checkPhase,'bank');
 bank.resolve({bankId:'synthetic-bank'});assert.ok((await pending).value);status=f.runtime.state('p').status;
 assert.equal(status.bank,'accessible');assert.equal(status.checkPhase,'complete');assert.ok(status.checkedAt>=status.checkStartedAt);assert.equal(status.lastSuccessfulCheckAt,status.checkedAt);
});

test('concurrent checks completing in reverse order cannot replace a newer failure with old success',async t=>{
 const f=await fixture(t),first=deferred();let healthCalls=0;
 f.behavior.health=()=>++healthCalls===1?first.promise:Promise.reject(error('HINDSIGHT_NETWORK'));
 const old=settled(check(f));await tick();const olderAttempt=f.runtime.state('p').status.checkAttempt;
 await assert.rejects(check(f),{code:'HINDSIGHT_CHECK_FAILED'});const latest=clone(f.runtime.state('p').status);
 first.resolve({healthy:true,version:'old-late-success'});await old;await tick();
 assert.equal(f.runtime.state('p').status.connection,'failed');assert.deepEqual(f.runtime.state('p').status,latest);assert.notEqual(latest.checkAttempt,olderAttempt);
 assert.equal(f.calls.filter(call=>call.method==='bank').length,0,'Old successful health may not start a bank request');
});

test('an already received bank success cannot commit after a newer check has failed',async t=>{
 const f=await fixture(t),reached=deferred(),release=deferred(),serial=f.registry.serial.bind(f.registry);let hold=true;
 f.registry.serial=(id,operation)=>{
  if(hold&&f.runtime.state(id).status.checkPhase==='bank'&&f.calls.some(call=>call.method==='bank')){hold=false;reached.resolve();return release.promise.then(()=>serial(id,operation));}
  return serial(id,operation);
 };
 const old=settled(check(f));await reached.promise;
 f.behavior.health=async()=>{throw error('HINDSIGHT_NETWORK');};await assert.rejects(check(f),{code:'HINDSIGHT_CHECK_FAILED'});
 const latest=clone(f.runtime.state('p').status);release.resolve();await old;
 assert.deepEqual(f.runtime.state('p').status,latest);assert.equal(latest.connection,'failed');assert.equal(latest.bank,'not_checked');assert.equal(latest.lastSuccessfulCheckAt,null);
});

test('bank/config changes and disconnect invalidate late checks without writing old success or catch state',async t=>{
 for(const action of ['settings','disconnect']){
  const f=await fixture(t),bank=deferred();f.behavior.bank=()=>bank.promise;
  const pending=settled(check(f));await tick();
  if(action==='settings')await f.settings({bankId:'changed-bank'});
  else await f.runtime.disconnect({projectId:'p',expectedRevision:f.runtime.state('p').config.revision});
  const afterChange=clone(f.runtime.state('p'));
  bank.resolve({bankId:'synthetic-bank'});await pending;await tick();
  assert.deepEqual(f.runtime.state('p'),afterChange,action+' must not receive an old completion or error update');
  assert.equal(afterChange.status.connection,'not_checked');assert.equal(afterChange.status.bank,'not_checked');
 }
});

test('close cancels active checks and cold state never presents an orphaned check as still running',async t=>{
 const f=await fixture(t),health=deferred();f.behavior.health=()=>health.promise;
 const pending=settled(check(f));await tick();await f.runtime.close();
 const closed=clone(f.runtime.state('p'));health.resolve({healthy:true,version:'late'});await pending;await tick();
 assert.deepEqual(f.runtime.state('p'),closed);
 const cold=new ProjectHindsightRuntime({registry:f.registry,tables:f.tables,namespace:'check-status-offline',clientFactory:f.factory});t.after(()=>cold.close());
 assert.equal(cold.state('p').status.connection,'not_checked');assert.equal(cold.state('p').status.bank,'not_checked');assert.notEqual(cold.state('p').status.checkPhase,'health');
});

test('a newer check only aborts older checks, leaving simultaneous Recall and Retain controllers alone',async t=>{
 const f=await fixture(t),health=deferred(),recall=deferred(),retain=deferred();let recallSignal,retainSignal;
 const a=settled(f.runtime.request('p','recall',(_client,_cfg,signal)=>{recallSignal=signal;return recall.promise;}));
 const b=settled(f.runtime.request('p','retain',(_client,_cfg,signal)=>{retainSignal=signal;return retain.promise;}));
 f.behavior.health=()=>health.promise;const older=settled(check(f));await tick();const oldCheckSignal=f.calls.find(call=>call.method==='health').signal;
 f.behavior.health=async()=>({healthy:true,version:'1.1.0'});await check(f);
 assert.equal(oldCheckSignal.aborted,true);assert.equal(recallSignal.aborted,false);assert.equal(retainSignal.aborted,false);
 health.resolve({healthy:true,version:'older'});await older;recall.resolve('recall-ok');retain.resolve('retain-ok');assert.equal((await a).value,'recall-ok');assert.equal((await b).value,'retain-ok');
});

test('a service-only check completes without presenting an unchecked bank as accessible',async t=>{
 const f=await fixture(t);await f.settings({bankId:''});await check(f);const status=f.runtime.state('p').status;
 assert.equal(status.connection,'reachable');assert.equal(status.bank,'not_checked');assert.equal(status.checkPhase,'complete');assert.equal(status.checkFailureStage,null);
 assert.equal(f.calls.filter(call=>call.method==='bank').length,0);assert.equal(status.capabilities.recall,'not_tested');assert.equal(status.capabilities.retain,'not_tested');
});
