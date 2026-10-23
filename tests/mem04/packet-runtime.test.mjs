// OFFLINE composition tests: real Projects/Knowledge/Memory/Hindsight runtimes,
// synthetic in-memory backend only. No Host, service, model or credential access.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,rm,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {Projects} from '../../src/product/domain/projects.mjs';
import {ProjectKnowledge} from '../../src/product/domain/project-knowledge.mjs';
import {installMemoryRuntime} from '../../src/product/host/project-memory-runtime.mjs';
import {ProjectHindsightRuntime} from '../../src/product/host/project-hindsight-runtime.mjs';

const user={kind:'user',origin:'user_instruction',source:{kind:'user-input'}};
const clone=value=>structuredClone(value);
function table(){const data=new Map();return {get:key=>clone(data.get(key)),entries:()=>[...data].map(([key,value])=>[key,clone(value)]),put:async(key,value)=>data.set(key,clone(value)),delete:async key=>data.delete(key)};}
function deferred(){let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};}
const historical=(text='HistoricalBodyNeedle: a prior experiment, not current validation.',extra={})=>({items:[{id:'synthetic-fact',documentId:'synthetic-document',text,metadata:{projectId:'p1'},occurredStart:'2026-01-01',...extra}],truncated:false});
function agent(id,{turn=1,messageId='message-1',query='CurrentLocalNeedle',kind='user'}={}){
 let events=[{type:'turn/start',data:{turn}},{type:'user/message',data:{id:messageId,role:'user',source:{kind},content:[{type:'text',text:query}]}}];
 return {id,session:{snapshotEvents:()=>clone(events)},setEvents:value=>{events=value;}};
}
async function fixture(t,{recall=async()=>historical(),waitMs=2000,businessAdmission,businessQuery}={}){
 const root=await realpath(await mkdtemp(join(tmpdir(),'mem04-packet-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const projects=table();let count=0;const registry=new Projects({table:projects,createScope:async()=>({projectId:'p'+(++count),coordinatorSessionId:'co'+count}),validateModel:async()=>{}});
 const a=await registry.create({name:'Synthetic packet project'}),b=await registry.create({name:'Other synthetic project'}),knowledge=new ProjectKnowledge({registry,blobs:{}});await knowledge.initialize();
 const tables={preferences:table(),outbox:table(),runs:table()},calls=[],admissions=[],dispatches=new Set();
 const clientFactory=()=>({recall:async(bankId,input)=>{calls.push({bankId,query:input.query,signal:input.signal,maxResults:input.maxResults,maxTokens:input.maxTokens});return recall(bankId,input);}});
 const makeHindsight=()=>new ProjectHindsightRuntime({registry,tables,namespace:'mem04-packet-offline',clientFactory});
 const hindsight=makeHindsight();
 const workspace={tables:{bindings:table(),grants:table(),folders:table()},control:{}};
 const bindingFor=id=>workspace.tables.bindings.entries().map(([,value])=>value).find(value=>value.threadSessionId===id);
 workspace.control.admittedSync=id=>{const binding=bindingFor(id);return !!binding&&workspace.tables.grants.get(binding.grantId)?.state==='granted';};
 workspace.control.admit=async id=>{const binding=bindingFor(id);if(!binding||workspace.tables.grants.get(binding.grantId)?.state!=='granted')throw Object.assign(Error('Synthetic revoked grant'),{code:'FOLDER_GRANT_REQUIRED'});return binding;};
 const admission=(value,message)=>{admissions.push({sessionId:value.id,message:clone(message)});return businessAdmission?businessAdmission(value,message):message.source?.kind==='user'||dispatches.has(value.id+':'+message.id);};
 const makeMemory=external=>installMemoryRuntime({knowledge,registry,tables,workspace,config:{memoryPacketBytes:24000},readSessionEvents:async()=>[],sessionIds:id=>[id==='p1'?'co1':'co2',id+'-thread-a'],hindsight:external,businessAdmission:admission,businessQuery});
 const runtime=makeMemory(hindsight);
 t.after(async()=>{runtime.close();await hindsight.close();});
 const settings=config=>hindsight.settings({projectId:a.projectId,expectedRevision:hindsight.state(a.projectId).config.revision,config});
 await settings({enabled:true,endpoint:'http://127.0.0.1:1',bankId:'synthetic-p1-bank',bankScopeConfirmed:true,routeAuthorization:'local-free',waitMs});
 async function remember(extra={}){return knowledge.memoryWrite(a.projectId,{name:'constraints/current.md',logicalPath:'constraints/current.md',kind:'constraint',topicKey:'current',content:'CurrentLocalNeedle: keep the production Profile unchanged.',reason:'Synthetic current constraint',expectedRevision:0,operationId:'current',...extra},user);}
 async function bind(){const workspacePath=join(root,'owned-workspace');await mkdir(workspacePath);const binding={projectId:a.projectId,threadId:'a',threadSessionId:'p1-thread-a',bindingId:'synthetic-binding',grantId:'synthetic-grant',grantVersion:1,workspacePath,workspaceIdentity:{fixture:workspacePath}};
  await workspace.tables.bindings.put(binding.bindingId,binding);await workspace.tables.grants.put(binding.grantId,{grantId:binding.grantId,state:'granted',scope:'thread',projectId:a.projectId,folderId:'synthetic-folder',version:1});await workspace.tables.folders.put('synthetic-folder',{folderId:'synthetic-folder',selectedPath:workspacePath,identity:{fixture:workspacePath}});return binding;}
 return {root,registry,knowledge,tables,workspace,hindsight,runtime,a,b,calls,admissions,dispatches,settings,remember,bind,makeHindsight,makeMemory};
}
const usage=f=>f.tables.preferences.get('memory-used:'+f.a.projectId)?.packets??[];

test('Packet composition admits four business paths without changing agent-message provenance into user authority',async t=>{
 const f=await fixture(t),entry=await f.remember(),paths=[
  {sessionId:'co1',kind:'user',threadId:undefined,label:'Coordinator user'},
  {sessionId:'p1-thread-a',kind:'agent-message',threadId:'a',label:'New authorized Thread task'},
  {sessionId:'p1-thread-a',kind:'agent-message',threadId:'a',label:'Authorized Thread continuation'},
  {sessionId:'p1-thread-a',kind:'user',threadId:'a',label:'Direct Thread user'},
 ];
 const packetIds=[];
 for(let index=0;index<paths.length;index++){
  const path=paths[index],messageId='business-'+index,a=agent(path.sessionId,{turn:index+1,messageId,kind:path.kind,query:'CurrentLocalNeedle '+path.label});
  if(path.kind==='agent-message')f.dispatches.add(path.sessionId+':'+messageId);
  const before=a.session.snapshotEvents(),packet=await f.runtime.prepare({agent:a,projectId:f.a.projectId,threadId:path.threadId});
  assert.ok(packet.used.some(value=>value.entryId===entry.entryId));assert.equal(packet.hindsight.state,'ready');assert.equal(packet.hindsight.used[0].factId,'synthetic-fact');assert.equal(packet.threadId,path.threadId??null);assert.equal(packet.turnId,index+1);assert.deepEqual(a.session.snapshotEvents(),before);packetIds.push(packet.packetId);
 }
 assert.equal(f.calls.length,4);assert.equal(new Set(packetIds).size,4);assert.deepEqual(f.admissions.map(value=>value.message.source.kind),['user','agent-message','agent-message','user']);assert.deepEqual(f.admissions.map(value=>value.message.id),['business-0','business-1','business-2','business-3']);assert.equal(usage(f).length,4);
 assert.ok(f.calls.every(value=>value.bankId==='synthetic-p1-bank'));
});

test('Concurrent prepare and completed same-turn local edits rebuild local bytes without another remote Recall',async t=>{
 const f=await fixture(t),entry=await f.remember(),a=agent('co1'),input={agent:a,projectId:f.a.projectId};
 const [one,two,three]=await Promise.all([f.runtime.prepare(input),f.runtime.prepare(input),f.runtime.prepare(input)]);assert.equal(f.calls.length,1);assert.equal(one.packetId,two.packetId);assert.equal(two.packetId,three.packetId);assert.equal(usage(f).length,1);
 await f.remember({entryId:entry.entryId,expectedRevision:1,operationId:'current-edit',content:'UpdatedCurrentLocalNeedle: retain the current explicit constraint.'});f.runtime.invalidate(f.a.projectId);
 const edited=await f.runtime.prepare(input);assert.equal(f.calls.length,1);assert.ok(edited.text.includes('UpdatedCurrentLocalNeedle'));assert.ok(!edited.text.includes('CurrentLocalNeedle: keep the production Profile unchanged.'));assert.notEqual(edited.packetId,one.packetId);assert.equal(usage(f).length,1);assert.ok(usage(f)[0].used.some(value=>value.entryId===entry.entryId&&value.revision===2));
});

test('In-flight same-turn local edits invalidate stale publication without issuing a second remote Recall',async t=>{
 const started=deferred(),finish=deferred(),f=await fixture(t,{recall:async()=>{started.resolve();return finish.promise;}}),entry=await f.remember(),a=agent('co1'),input={agent:a,projectId:f.a.projectId};
 const old=f.runtime.prepare(input),oldOutcome=old.then(value=>({value}),error=>({error}));await started.promise;
 await f.remember({entryId:entry.entryId,expectedRevision:1,operationId:'inflight-edit',content:'InflightUpdatedLocalNeedle: use the latest local constraint.'});f.runtime.invalidate(f.a.projectId);
 const next=f.runtime.prepare(input);finish.resolve(historical());const stale=await oldOutcome;assert.ok(stale.error,'The pre-edit Packet must not publish stale local content');assert.ok(['HINDSIGHT_ABORTED','MEMORY_PACKET_STALE'].includes(stale.error.code),stale.error.code);const packet=await next;
 assert.equal(f.calls.length,1,'One business turn may perform at most one automatic remote Recall even after local invalidation');assert.ok(packet.text.includes('InflightUpdatedLocalNeedle'));assert.ok(!packet.text.includes('CurrentLocalNeedle: keep the production Profile unchanged.'));assert.equal(usage(f).length,1);
});

test('Report relay and non-task messages do not cause automatic remote Recall',async t=>{
 const f=await fixture(t);await f.remember();
 const report=agent('co1',{kind:'agent-message',messageId:'report-relay'}),packet=await f.runtime.prepare({agent:report,projectId:f.a.projectId});assert.equal(packet.hindsight.state,'not_a_task_message');assert.equal(packet.hindsight.reason,'report_or_untrusted_relay');assert.ok(packet.text.includes('CurrentLocalNeedle'));assert.equal(f.calls.length,0);assert.equal(f.admissions[0].message.source.kind,'agent-message');
 for(const kind of ['runtime-context','assistant','tool-result'])assert.equal(await f.runtime.prepare({agent:agent('co1',{turn:2,kind,messageId:'non-task-'+kind}),projectId:f.a.projectId}),null);
 assert.equal(f.calls.length,0);
 const rejected=await fixture(t,{businessAdmission:()=>false});await rejected.remember();const ordinary=await rejected.runtime.prepare({agent:agent('co1'),projectId:rejected.a.projectId});assert.equal(ordinary.hindsight.state,'not_a_task_message');assert.equal(rejected.calls.length,0);
});

test('Recall timeout retains current local Packet and publishes degraded Used metadata without historical text',async t=>{
 const f=await fixture(t,{waitMs:50,recall:async()=>new Promise(()=>{})});await f.remember();const packet=await f.runtime.prepare({agent:agent('co1'),projectId:f.a.projectId});
 assert.ok(packet.text.includes('CurrentLocalNeedle'));assert.equal(packet.hindsight.state,'degraded');assert.equal(packet.hindsight.reason,'HINDSIGHT_TIMEOUT');assert.equal(f.calls.length,1);assert.equal(f.calls[0].signal.aborted,true);assert.equal(usage(f).length,1);assert.equal(usage(f)[0].hindsight.state,'degraded');assert.equal(usage(f)[0].hindsight.reason,'HINDSIGHT_TIMEOUT');assert.ok(!JSON.stringify(usage(f)).includes('HistoricalBodyNeedle'));
});

for(const change of ['binding','turn','permission'])test('Late Recall after '+change+' change cannot publish stale Packet/Used',async t=>{
 const started=deferred(),finish=deferred(),f=await fixture(t,{recall:async()=>{started.resolve();return finish.promise;}});await f.remember();const a=agent(change==='permission'?'p1-thread-a':'co1'),input={agent:a,projectId:f.a.projectId,...change==='permission'?{threadId:'a'}:{}};
 let binding;if(change==='permission'){binding=await f.bind();await f.runtime.index({projectId:f.a.projectId});await f.runtime.changeSettings({projectId:f.a.projectId,autoEvidence:true});}
 const pending=f.runtime.prepare(input),outcome=pending.then(value=>({value}),error=>({error}));await started.promise;
 if(change==='binding')await f.settings({bankId:'other-synthetic-bank'});
 else if(change==='turn')a.setEvents([{type:'turn/start',data:{turn:2}},{type:'user/message',data:{id:'next-turn',source:{kind:'user'},content:[{type:'text',text:'A different task'}]}}]);
 else{const grant=f.workspace.tables.grants.get(binding.grantId);await f.workspace.tables.grants.put(binding.grantId,{...grant,state:'revoked'});}
 finish.resolve(historical());const result=await outcome;assert.ok(result.error,'A stale external result must reject rather than be published');assert.ok(['HINDSIGHT_ABORTED','HINDSIGHT_STALE','MEMORY_PACKET_STALE','FOLDER_GRANT_REQUIRED'].includes(result.error.code),result.error.code);assert.equal(usage(f).length,0);assert.equal(f.calls.length,1);
 if(change==='binding'){const refreshed=await f.runtime.prepare(input);assert.equal(refreshed.hindsight.state,'automatic_recall_already_spent_or_capacity');assert.equal(f.calls.length,1);assert.ok(refreshed.text.includes('CurrentLocalNeedle'));assert.ok(!refreshed.text.includes('HistoricalBodyNeedle'));}
});

test('Low Packet budget protects local critical records and stores external reference metadata without historical bodies',async t=>{
 const body='HistoricalBodyNeedle '+'past experimental detail '.repeat(38),items=Array.from({length:6},(_,index)=>({id:'fact-'+index,documentId:'document-'+index,text:body+index,metadata:{projectId:'p1'}})),f=await fixture(t,{recall:async()=>({items,truncated:false})});await f.remember();
 const packet=await f.runtime.prepare({agent:agent('co1'),projectId:f.a.projectId,budgetBytes:2048});assert.ok(packet.text.includes('CurrentLocalNeedle: keep the production Profile unchanged.'));assert.ok(packet.used.some(value=>value.logicalPath==='constraints/current.md'));assert.ok(packet.bytes<=2048);assert.equal(packet.bytes,Buffer.byteLength(packet.text));assert.ok(packet.hindsight.omitted.some(value=>['remaining_packet_budget','history_byte_limit'].includes(value.reason)));
 const serialized=JSON.stringify(usage(f));assert.ok(!serialized.includes('HistoricalBodyNeedle'));assert.ok(!serialized.includes('past experimental detail'));assert.ok(!serialized.includes('CurrentLocalNeedle'));assert.ok(!serialized.includes('"text":'));assert.equal(usage(f)[0].hindsight.state,'ready');
});

test('Successful Recall Used identifies provided historical facts without persisting the historical body',async t=>{
 const f=await fixture(t);await f.remember();const packet=await f.runtime.prepare({agent:agent('co1'),projectId:f.a.projectId});assert.ok(packet.text.includes('HistoricalBodyNeedle'));assert.ok(packet.hindsight.used.length>0);
 const used=usage(f)[0];assert.equal(used.hindsight.used[0].factId,'synthetic-fact');assert.equal(used.hindsight.used[0].documentId,'synthetic-document');assert.equal(used.hindsight.used[0].source.bankId,'synthetic-p1-bank');assert.equal(used.hindsight.used[0].classification,'external-history');assert.ok(!JSON.stringify(used).includes('HistoricalBodyNeedle'));assert.ok(!('text' in used.hindsight.used[0]));
});


test('Automatic Recall remains spent after over 100 other business turns evict both in-memory caches',async t=>{
 const f=await fixture(t);await f.remember();const first=agent('co1',{turn:1,messageId:'first-business-message'}),input={agent:first,projectId:f.a.projectId};
 const packet=await f.runtime.prepare(input);assert.equal(packet.hindsight.state,'ready');assert.equal(f.calls.length,1);
 // Distinct active Sessions avoid changing the original Session/turn identity.
 for(let index=0;index<105;index++)await f.runtime.prepare({agent:agent('other-synthetic-session-'+index,{turn:1,messageId:'other-business-'+index}),projectId:f.a.projectId});
 assert.equal(f.calls.length,106);assert.equal(f.hindsight.turnRecalls.size,100);
 const reentered=await f.runtime.prepare(input);assert.equal(f.calls.length,106,'Cache eviction must not grant another remote request for the original business turn');assert.equal(reentered.hindsight.state,'automatic_recall_already_spent_or_capacity');assert.ok(reentered.text.includes('CurrentLocalNeedle'));assert.ok(!reentered.text.includes('HistoricalBodyNeedle'));
});

test('Rebuilt Memory and Hindsight controllers honor the same ProjectStore spent business identity',async t=>{
 const f=await fixture(t);await f.remember();const input={agent:agent('co1',{turn:7,messageId:'survives-controller-restart'}),projectId:f.a.projectId};
 await f.runtime.prepare(input);assert.equal(f.calls.length,1);f.runtime.close();await f.hindsight.close();
 const restoredHindsight=f.makeHindsight(),restoredMemory=f.makeMemory(restoredHindsight);t.after(async()=>{restoredMemory.close();await restoredHindsight.close();});
 const packet=await restoredMemory.prepare(input);assert.equal(f.calls.length,1,'A controller restart must not repeat a spent automatic Recall');assert.equal(packet.hindsight.state,'automatic_recall_already_spent_or_capacity');assert.ok(packet.text.includes('CurrentLocalNeedle'));assert.ok(!packet.text.includes('HistoricalBodyNeedle'));assert.equal(restoredHindsight.state(f.a.projectId).config.bankId,'synthetic-p1-bank');
});

test('Trusted businessQuery sends dispatch task text without workspace authorization envelope JSON',async t=>{
 const trustedTasks=new Map([['authorized-task','Review current save logic and report a bounded fix.']]),f=await fixture(t,{businessQuery:(_agent,message)=>message.source?.kind==='agent-message'?trustedTasks.get(message.id):message.content.filter(value=>value.type==='text').map(value=>value.text).join('\n')});await f.remember();
 f.dispatches.add('p1-thread-a:authorized-task');const envelope=JSON.stringify({task:trustedTasks.get('authorized-task'),workspace:{path:'/synthetic/private/path',grantId:'SyntheticGrantDoNotSend',permission:'scoped-write'}}),a=agent('p1-thread-a',{kind:'agent-message',messageId:'authorized-task',query:envelope});
 const packet=await f.runtime.prepare({agent:a,projectId:f.a.projectId,threadId:'a'});assert.equal(packet.hindsight.state,'ready');assert.equal(f.calls.length,1);assert.equal(f.calls[0].query,trustedTasks.get('authorized-task'));assert.ok(!f.calls[0].query.includes('SyntheticGrantDoNotSend'));assert.ok(!f.calls[0].query.includes('/synthetic/private/path'));assert.equal(f.admissions[0].message.source.kind,'agent-message');assert.equal(f.admissions[0].message.content[0].text,envelope);
});
