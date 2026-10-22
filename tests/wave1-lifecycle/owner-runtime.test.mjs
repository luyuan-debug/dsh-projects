import test from 'node:test';
import assert from 'node:assert/strict';
import { watch } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { AgentOwnerRuntime } from '../../src/product/host/agent-owner-runtime.mjs';
import { HostLifecycle } from '../../src/product/host/host-lifecycle.mjs';

function deferred() { let resolve, reject; const promise = new Promise((a,b) => { resolve=a; reject=b; }); return {promise,resolve,reject}; }
function fixture(options={}) {
  const registry=new Map(), calls=[], liveHandles=new Set();
  const agents={get:id=>registry.get(id)};
  for (const operation of ['create','resume']) agents[operation]=async spec=>{
    const id=spec.sessionId??spec.resumeSessionId;calls.push(operation);
    options.entered?.resolve(operation);if(options.gate)await options.gate.promise;
    if(options.factoryError)throw options.factoryError;
    const agent={id,cancel:cause=>calls.push('cancel:'+cause.kind),whenIdle:()=>options.idle?.promise??Promise.resolve()};
    registry.set(id,agent);
    const handle={agent,dispose:async()=>{calls.push('dispose:'+id);options.disposeEntered?.resolve();if(options.disposeGate)await options.disposeGate.promise;registry.delete(id);liveHandles.delete(handle);if(options.disposeError)throw options.disposeError;}};
    liveHandles.add(handle);return handle;
  };
  const persistence={stat:async()=>{if(options.statError)throw options.statError;return options.exists?{}:undefined;}};
  return {runtime:new AgentOwnerRuntime({agents,persistence,isNotFound:options.isNotFound}),agents,persistence,registry,calls,liveHandles};
}
const spec={sessionId:'test-root',cwd:'/root/dsh-owner-test/thread'};

for(const mode of ['create','resume'])test(`${mode} / dispose waits for unpublished handle cleanup`,async()=>{
  const gate=deferred(),entered=deferred(),disposeGate=deferred(),disposeEntered=deferred();
  const f=fixture({gate,entered,disposeGate,disposeEntered,exists:mode==='resume'});
  const creation=f.runtime.ensure(spec);const rejected=assert.rejects(creation,{code:'RUNTIME_CLOSED'});
  assert.equal(await entered.promise,mode);const closing=f.runtime.dispose();assert.equal(f.runtime.state,'CLOSING');
  gate.resolve();await disposeEntered.promise;assert.deepEqual(f.runtime.liveSessionIds,[]);assert.equal(f.liveHandles.size,1);
  disposeGate.resolve();await rejected;await closing;assert.equal(f.runtime.state,'CLOSED');assert.equal(f.registry.size,0);assert.equal(f.liveHandles.size,0);
});
test('queued ensure rechecks state after session lock',async()=>{
  const entered=deferred(),gate=deferred();const f=fixture({entered,gate});
  const first=f.runtime.ensure(spec);const r1=assert.rejects(first,{code:'RUNTIME_CLOSED'});await entered.promise;
  const queued=f.runtime.ensure(spec);const r2=assert.rejects(queued,{code:'RUNTIME_CLOSED'});const closing=f.runtime.dispose();gate.resolve();
  await Promise.all([r1,r2,closing]);assert.equal(f.calls.filter(x=>x==='create').length,1);assert.equal(f.registry.size,0);
});
test('ensure / stop serializes; stop interrupts without disposing Session owner',async()=>{
  const entered=deferred(),gate=deferred();const f=fixture({entered,gate});
  const creating=f.runtime.ensure(spec);await entered.promise;const stopped=f.runtime.stop(spec.sessionId);gate.resolve();
  const agent=await creating;assert.equal((await stopped).sessionPreserved,true);assert.equal(f.registry.get(spec.sessionId),agent);
  assert.deepEqual(f.calls,['create','cancel:user']);assert.equal(await f.runtime.ensure(spec),agent);await f.runtime.dispose();
});
test('ensure queued behind active stop does not resume/create a second owner',async()=>{
  const idle=deferred();const f=fixture({idle});const agent=await f.runtime.ensure(spec);const stop=f.runtime.stop(spec.sessionId);const ensuring=f.runtime.ensure(spec);
  idle.resolve();await stop;assert.equal(await ensuring,agent);assert.equal(f.liveHandles.size,1);await f.runtime.dispose();
});
test('concurrent dispose shares exact promise and one handle disposal',async()=>{
  const f=fixture();await f.runtime.ensure(spec);const a=f.runtime.dispose(),b=f.runtime.dispose();assert.equal(a,b);await a;assert.equal(f.calls.filter(x=>x.startsWith('dispose:')).length,1);
});
test('ensure after dispose fails without reading persistence or creating',async()=>{
  const f=fixture();await f.runtime.dispose();await assert.rejects(f.runtime.ensure(spec),{code:'RUNTIME_CLOSED'});assert.deepEqual(f.calls,[]);
});
for(const exists of [false,true])test(`${exists?'resume':'create'} error propagates and teardown still converges`,async()=>{
  const error=new Error('factory fails');const f=fixture({exists,factoryError:error});await assert.rejects(f.runtime.ensure(spec),e=>e===error);await f.runtime.dispose();assert.equal(f.runtime.state,'CLOSED');assert.equal(f.registry.size,0);
});
for(const code of ['EACCES','EIO','SessionAlreadyOwnedError'])test(`stat ${code} never falls through to create`,async()=>{
  const error=Object.assign(new Error(code),{code});const f=fixture({statError:error});await assert.rejects(f.runtime.ensure(spec),e=>e===error);assert.deepEqual(f.calls,[]);await f.runtime.dispose();
});
test('only explicit not-found predicate permits create',async()=>{
  const missing=new Error('explicit absent');const f=fixture({statError:missing,isNotFound:e=>e===missing});await f.runtime.ensure(spec);assert.deepEqual(f.calls,['create']);await f.runtime.dispose();
});
test('owner conflict never adopts a bare registered Agent',async()=>{
  const f=fixture();const foreign={id:spec.sessionId};f.registry.set(spec.sessionId,foreign);
  await assert.rejects(f.runtime.ensure(spec),{code:'OWNER_CONFLICT'});await assert.rejects(f.runtime.stop(spec.sessionId),{code:'OWNER_CONFLICT'});await f.runtime.dispose();assert.equal(f.registry.get(spec.sessionId),foreign);assert.deepEqual(f.calls,[]);
});
test('dispose errors propagate, all other handles dispose, live map clears',async()=>{
  const f=fixture({disposeError:new Error('dispose failed')});await f.runtime.ensure(spec);await f.runtime.ensure({...spec,sessionId:'second'});
  await assert.rejects(f.runtime.dispose(),AggregateError);assert.deepEqual(f.runtime.liveSessionIds,[]);assert.equal(f.liveHandles.size,0);assert.equal(f.runtime.state,'CLOSED');
});
test('teardown rejects commands, cancels watcher/timer before draining; runtime then store',async()=>{
  const log=[],entered=deferred(),gate=deferred();const f=fixture();const host=new HostLifecycle({runtime:{dispose:async()=>{log.push('runtime');await f.runtime.dispose();}},store:{close:async()=>log.push('store')}});
  host.ownCancellation(()=>log.push('watcher-cancelled'));host.ownCancellation(()=>log.push('timer-cancelled'));
  const command=host.submit(async()=>{log.push('command-start');entered.resolve();await gate.promise;await f.runtime.ensure(spec);log.push('command-end');});await entered.promise;
  const closing=host.dispose();assert.equal(host.dispose(),closing);await assert.rejects(host.submit(()=>{}),{code:'HOST_CLOSING'});assert.equal(host.accepting,false);
  gate.resolve();await command;await closing;assert.deepEqual(log,['command-start','watcher-cancelled','timer-cancelled','command-end','runtime','store']);assert.equal(f.registry.size,0);
});
test('teardown errors are reported after store cleanup',async()=>{
  const log=[];const host=new HostLifecycle({runtime:{dispose:async()=>{log.push('runtime');throw new Error('owner');}},store:{close:async()=>{log.push('store');throw new Error('store');}}});
  host.ownCancellation(()=>{throw new Error('watcher');});await assert.rejects(host.dispose(),e=>e instanceof AggregateError && e.errors.length===3);assert.deepEqual(log,['runtime','store']);
});
test('unpublished cleanup failure reaches ensure and shared dispose',async()=>{
  const entered=deferred(),gate=deferred();const f=fixture({entered,gate,disposeError:new Error('late cleanup')});
  const ensuring=f.runtime.ensure(spec);const ensureFailure=assert.rejects(ensuring,AggregateError);await entered.promise;
  const closing=f.runtime.dispose();const closeFailure=assert.rejects(closing,AggregateError);gate.resolve();await Promise.all([ensureFailure,closeFailure]);assert.equal(f.runtime.state,'CLOSED');
});
test('native fs watcher closes and native interval is cancelled during teardown',async()=>{
  const f=fixture();const host=new HostLifecycle({runtime:f.runtime,store:{close:async()=>{}}});
  const watcher=watch(fileURLToPath(new URL('.',import.meta.url)),()=>{});const closed=new Promise(resolve=>watcher.once('close',resolve));
  const timer=setInterval(()=>{},100000);host.ownCancellation(async()=>{watcher.close();await closed;});host.ownCancellation(()=>clearInterval(timer));
  await host.dispose();assert.equal(timer._destroyed,true);await closed;assert.equal(f.runtime.state,'CLOSED');
});
