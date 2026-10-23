// OFFLINE concurrency contract tests. No native dialog, Host process or model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {setImmediate as yieldLoop} from 'node:timers/promises';
import {NativeDirectorySelection} from '../../src/product/host/native-directory-selection.mjs';
import {WorkspaceBindings} from '../../src/product/domain/workspace-bindings.mjs';
import {HostLifecycle} from '../../src/product/host/host-lifecycle.mjs';
import {executeCommand,executeIndependent} from '../../src/product/host/command-admission.mjs';

function deferred(){let resolve,reject;const promise=new Promise((yes,no)=>{resolve=yes;reject=no;});return {promise,resolve,reject};}
async function promptly(promise,label='operation'){let timeout;try{return await Promise.race([promise,new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(label+' did not settle promptly')),300);})]);}finally{clearTimeout(timeout);}}
function fixture({native=true,connect}={}){
 let closed=false,token=0;const backends=[],signals=[],connections=[],timers=new Map(),deadlines=[];
 const selection=new NativeDirectorySelection({
  capability:()=>({kind:native?'native':'unavailable',pick:signal=>{const job=deferred();backends.push(job);signals.push(signal);return job.promise;}}),
  connectSelected:connect??(async(path,{signal,validate})=>{signal?.throwIfAborted();validate();connections.push(path);return {folderId:'synthetic-selected-folder',selectedPath:path};}),
  isClosed:()=>closed,
  setTimer:(callback,ms)=>{const id=++token;timers.set(id,callback);deadlines.push(ms);return id;},
  clearTimer:id=>timers.delete(id),
 });
 return {selection,backends,signals,connections,timers,deadlines,setClosed:()=>{closed=true;},fire:()=>{const callbacks=[...timers.values()];timers.clear();callbacks.forEach(callback=>callback());}};
}
const begin=async(f,input={})=>{const promise=f.selection.pick({pickerId:randomUUID(),...input});await yieldLoop();return {promise};};

test('A selected native folder uses short commit and does not create authorization implicitly',async()=>{
 const f=fixture(),commits=[];const {promise}=await begin(f,{commit:async operation=>{commits.push('commit');return operation();}});assert.equal(f.connections.length,0);f.backends[0].resolve('/synthetic/owner-selected');
 const value=await promptly(promise);assert.equal(value.folder.selectedPath,'/synthetic/owner-selected');assert.deepEqual(f.connections,['/synthetic/owner-selected']);assert.deepEqual(commits,['commit']);assert.ok(!('grant' in value)&&!('approved' in value));assert.equal(f.timers.size,0);
});

test('Pending independent picker does not block state, denial or another Project command',async()=>{
 const f=fixture(),events=[],lifecycle=new HostLifecycle({runtime:{dispose:async()=>events.push('runtime closed')},store:{close:async()=>events.push('store closed')}}),pickerId=randomUUID();
 const pending=executeIndependent(lifecycle,()=>f.selection.pick({pickerId,commit:operation=>executeCommand(lifecycle,operation)}));await yieldLoop();
 assert.deepEqual(await promptly(executeCommand(lifecycle,async()=>({projectId:'A',state:'available'})),'state'),{projectId:'A',state:'available'});
 assert.equal(await promptly(executeCommand(lifecycle,async()=>{events.push('request denied');return 'denied';}),'denial'),'denied');
 assert.equal(await promptly(executeCommand(lifecycle,async()=>{events.push('project B updated');return 'B';}),'other Project command'),'B');
 await executeIndependent(lifecycle,()=>f.selection.cancel({pickerId}));assert.deepEqual(await promptly(pending),{cancelled:true,reason:'cancelled'});assert.equal(f.signals[0].aborted,true);f.backends[0].resolve('/synthetic/late');await yieldLoop();assert.equal(f.connections.length,0);await promptly(lifecycle.dispose(),'close');assert.deepEqual(events,['request denied','project B updated','runtime closed','store closed']);
});


test('Owner cancellation settles while backend ignores abort; physical busy prevents a second selector until late settlement',async()=>{
 const f=fixture(),pickerId=randomUUID(),{promise}=await begin(f,{pickerId});await f.selection.cancel({pickerId});assert.deepEqual(await promptly(promise),{cancelled:true,reason:'cancelled'});assert.equal(f.signals[0].aborted,true);
 await assert.rejects(f.selection.pick({pickerId:randomUUID()}),{code:'PICKER_ALREADY_OPEN'});assert.equal(f.backends.length,1);f.backends[0].resolve('/synthetic/late-never-connect');await yieldLoop();assert.equal(f.connections.length,0);
 const next=await begin(f);assert.equal(f.backends.length,2);f.backends[1].resolve('/synthetic/new-owner-choice');assert.equal((await promptly(next.promise)).folder.selectedPath,'/synthetic/new-owner-choice');
});

test('HTTP request abort settles promptly and a late backend result cannot connect',async()=>{
 const f=fixture(),request=new AbortController(),{promise}=await begin(f,{signal:request.signal});request.abort();assert.deepEqual(await promptly(promise),{cancelled:true,reason:'request_aborted'});assert.equal(f.signals[0].aborted,true);f.backends[0].resolve('/synthetic/late-after-disconnect');await yieldLoop();assert.equal(f.connections.length,0);
});

test('The independent Host upper wait is 120 seconds and does not depend on backend abort cooperation',async()=>{
 const f=fixture(),{promise}=await begin(f);assert.equal(f.deadlines[0],120000);f.fire();assert.deepEqual(await promptly(promise),{cancelled:true,reason:'timeout'});assert.equal(f.signals[0].aborted,true);f.backends[0].reject(Error('Synthetic late backend rejection'));await yieldLoop();assert.equal(f.connections.length,0);
});

test('Quiesce cancels an ignored-abort picker so HostLifecycle disposal drains independent jobs',async()=>{
 const f=fixture(),events=[],lifecycle=new HostLifecycle({runtime:{dispose:async()=>events.push('runtime')},store:{close:async()=>events.push('store')}});lifecycle.ownCancellation(()=>f.selection.close());
 const pending=executeIndependent(lifecycle,()=>f.selection.pick({pickerId:randomUUID(),commit:operation=>executeCommand(lifecycle,operation)}));await yieldLoop();await promptly(lifecycle.dispose(),'HostLifecycle dispose with picker');assert.deepEqual(await pending,{cancelled:true,reason:'closed'});assert.equal(f.signals[0].aborted,true);assert.deepEqual(events,['runtime','store']);await assert.rejects(executeIndependent(lifecycle,()=>42),{code:'HOST_CLOSING'});f.backends[0].resolve('/synthetic/after-close');await yieldLoop();assert.equal(f.connections.length,0);
});

test('Cancellation before a picker request creates a bounded tombstone and opens no native selector',async()=>{
 const f=fixture(),pickerId=randomUUID();await f.selection.cancel({pickerId});assert.deepEqual(await promptly(f.selection.pick({pickerId})),{cancelled:true,reason:'cancelled'});assert.equal(f.backends.length,0);assert.equal(f.connections.length,0);f.selection.close();
});

test('Unknown-cancellation tombstone capacity rejects new selection conservatively instead of evicting a cancellation',async()=>{
 const f=fixture();for(let index=0;index<256;index++)await f.selection.cancel({pickerId:randomUUID()});await assert.rejects(f.selection.pick({pickerId:randomUUID()}),{code:'PICKER_CAPACITY'});assert.equal(f.backends.length,0);f.selection.close();
});

test('Cancellation while a successful native result waits for commit prevents connectSelected',async()=>{
 const f=fixture(),commitStarted=deferred(),releaseCommit=deferred(),pickerId=randomUUID(),{promise}=await begin(f,{pickerId,commit:async operation=>{commitStarted.resolve();await releaseCommit.promise;return operation();}});f.backends[0].resolve('/synthetic/not-yet-registered');await commitStarted.promise;await f.selection.cancel({pickerId});releaseCommit.resolve();assert.deepEqual(await promptly(promise),{cancelled:true,reason:'cancelled'});await yieldLoop();assert.equal(f.connections.length,0);
});

test('Native cancel-null and unavailable capability create no folder; invalid IDs fail before native execution',async()=>{
 const f=fixture(),{promise}=await begin(f);f.backends[0].resolve(null);assert.deepEqual(await promptly(promise),{cancelled:true,reason:'cancelled'});assert.equal(f.connections.length,0);
 for(const pickerId of ['', 'not-a-uuid','../outside',42])await assert.rejects(f.selection.pick({pickerId}),error=>typeof error.code==='string');assert.equal(f.backends.length,1);
 const missing=fixture({native:false});await assert.rejects(missing.selection.pick({pickerId:randomUUID()}),{code:'NATIVE_PICKER_UNAVAILABLE'});assert.equal(missing.backends.length,0);
});


for(const stage of ['identity','metadata'])test('Cancelled WorkspaceBindings '+stage+' read releases the actual command queue and rejects late folder writes',async()=>{
 const names=['endpoints','folders','requests','grants','bindings','operations','intents'],tables=Object.fromEntries(names.map(name=>{const rows=new Map();return [name,{get:key=>structuredClone(rows.get(key)),entries:()=>[...rows].map(([key,value])=>[key,structuredClone(value)]),put:async(key,value)=>rows.set(key,structuredClone(value))}];}));
 const entered=deferred(),held=deferred(),controller=new AbortController(),identity={canonicalPath:'/synthetic/selected',dev:'1',ino:'2',birthtimeNs:'3',repository:null};
 const control=new WorkspaceBindings({tables,identity:async()=>{if(stage==='identity'){entered.resolve();return held.promise;}return identity;},metadata:async()=>{if(stage==='metadata'){entered.resolve();return held.promise;}return null;},prepareWorkspace:async()=>assert.fail('Selection must not prepare a workspace'),sessionHeader:async()=>null});await control.online();
 const lifecycle=new HostLifecycle({runtime:{dispose:()=>control.close()},store:{close:async()=>{}}});
 const pending=executeCommand(lifecycle,()=>control.connectSelected('/synthetic/selected',{signal:controller.signal,validate:()=>controller.signal.throwIfAborted()})),outcome=pending.then(value=>({value}),error=>({error}));await entered.promise;controller.abort(Object.assign(Error('Synthetic owner cancelled directory selection'),{code:'TEST_PICKER_CANCELLED'}));
 const result=await promptly(outcome,stage+' cancellation');assert.equal(result.error?.code,'TEST_PICKER_CANCELLED');assert.equal(await promptly(executeCommand(lifecycle,()=>tables.folders.entries().length),'command after cancelled '+stage),0);held.resolve(stage==='identity'?identity:{head:'synthetic-head'});await yieldLoop();assert.equal(tables.folders.entries().length,0);assert.equal(tables.grants.entries().length,0);assert.equal(tables.bindings.entries().length,0);await promptly(lifecycle.dispose());
});
