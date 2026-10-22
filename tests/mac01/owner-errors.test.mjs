import test from 'node:test';
import assert from 'node:assert/strict';
import { AgentOwnerRuntime } from '../../src/product/host/agent-owner-runtime.mjs';
import { HostLifecycle } from '../../src/product/host/host-lifecycle.mjs';

function deferred() { let resolve,reject; const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject}; }
const spec={sessionId:'audit-root',cwd:process.env.MAC01_TEST_ROOT};
test('close while stat is deferred never creates or resumes an Agent',async()=>{
 const entered=deferred(),release=deferred();let calls=0;
 const r=new AgentOwnerRuntime({agents:{get:()=>undefined,create:()=>{calls++;throw Error('unexpected create');},resume:()=>{calls++;throw Error('unexpected resume');}},persistence:{stat:async()=>{entered.resolve();await release.promise;return undefined;}}});
 const ensure=r.ensure(spec);const rejected=assert.rejects(ensure,{code:'RUNTIME_CLOSED'});
 await entered.promise;const closing=r.dispose();release.resolve();await Promise.all([rejected,closing]);assert.equal(calls,0);assert.equal(r.state,'CLOSED');
});
test('whenIdle rejection is surfaced and a subsequent dispose releases the owner',async()=>{
 const idleError=new Error('idle failed');let disposals=0;const agent={cancel(){},async whenIdle(){throw idleError;}};
 const r=new AgentOwnerRuntime({agents:{get:()=>undefined,create:async()=>({agent,async dispose(){disposals++;}})},persistence:{stat:async()=>undefined}});
 await r.ensure(spec);await assert.rejects(r.stop(spec.sessionId),e=>e===idleError);await r.dispose();assert.equal(disposals,1);assert.equal(r.state,'CLOSED');
});
test('cancel failure does not poison the session serialization queue',async()=>{
 const cancelError=new Error('cancel failed');let calls=0;const agent={cancel(){throw cancelError;},async whenIdle(){}};
 const r=new AgentOwnerRuntime({agents:{get:()=>undefined,create:async()=>{calls++;return {agent,async dispose(){}};}},persistence:{stat:async()=>undefined}});
 await r.ensure(spec);await assert.rejects(r.stop(spec.sessionId),e=>e===cancelError);assert.equal(await r.ensure(spec),agent);assert.equal(calls,1);await r.dispose();
});
test('rejected admitted command drains before runtime/store and remains reported at teardown',async()=>{
 const failure=new Error('admitted command failed'),log=[];const host=new HostLifecycle({runtime:{async dispose(){log.push('runtime');}},store:{async close(){log.push('store');}}});
 const first=host.submit(async()=>{log.push('first');throw failure;});const second=host.submit(async()=>log.push('second'));
 await assert.rejects(first,e=>e===failure);await second;await assert.rejects(host.dispose(),e=>e instanceof AggregateError&&e.errors.includes(failure));assert.deepEqual(log,['first','second','runtime','store']);
});
test('a failing resource canceller does not skip later cancellers or store close',async()=>{
 const entered=deferred(),release=deferred(),log=[];const failure=new Error('cancel resource failed');
 const host=new HostLifecycle({runtime:{async dispose(){log.push('runtime');}},store:{async close(){log.push('store');}}});
 host.ownCancellation(async()=>{entered.resolve();await release.promise;throw failure;});host.ownCancellation(()=>log.push('second-canceller'));
 const closing=host.dispose(),rejection=assert.rejects(closing,e=>e instanceof AggregateError&&e.errors.includes(failure));await entered.promise;
 assert.throws(()=>host.ownCancellation(()=>{}),{code:'HOST_CLOSING'});release.resolve();await rejection;assert.deepEqual(log,['second-canceller','runtime','store']);
});
