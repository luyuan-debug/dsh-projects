// OFFLINE integration fixtures. These tests do not start a DSH Host or a model.
import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile,realpath} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {Projects} from '../../src/product/domain/projects.mjs';
import {ProjectKnowledge} from '../../src/product/domain/project-knowledge.mjs';
import {installMemoryRuntime} from '../../src/product/host/project-memory-runtime.mjs';

const user={kind:'user',origin:'user_instruction',source:{kind:'user-input'}};
const sha=b=>createHash('sha256').update(b).digest('hex');
function table(){const data=new Map();return {get:k=>structuredClone(data.get(k)),entries:()=>[...data].map(([k,v])=>[k,structuredClone(v)]),put:async(k,v)=>data.set(k,structuredClone(v)),delete:async k=>data.delete(k)};}
async function fixture(t){
 const root=await realpath(await mkdtemp(join(tmpdir(),'mem03-runtime-')));t.after(()=>rm(root,{recursive:true,force:true}));
 const projects=table();let count=0;const registry=new Projects({table:projects,createScope:async()=>({projectId:'p'+(++count),coordinatorSessionId:'co'+count}),validateModel:async()=>{}});
 const a=await registry.create({name:'Synthetic A'}),b=await registry.create({name:'Synthetic B'}),knowledge=new ProjectKnowledge({registry,blobs:{}});await knowledge.initialize();
 const workspace={tables:{bindings:table(),grants:table(),folders:table()},control:{}};
 workspace.control.admittedSync=sessionId=>{const b=[...workspace.tables.bindings.entries()].map(([,v])=>v).find(b=>b.threadSessionId===sessionId);return !!b&&workspace.tables.grants.get(b.grantId)?.state==='granted';};
 workspace.control.admit=async sessionId=>{const b=[...workspace.tables.bindings.entries()].map(([,v])=>v).find(b=>b.threadSessionId===sessionId);if(!b||workspace.tables.grants.get(b.grantId)?.state!=='granted')throw Object.assign(new Error('revoked'),{code:'FOLDER_GRANT_REQUIRED'});return b;};
 const tables={preferences:table()},events=new Map(),sessions=id=>[id==='p1'?'co1':'co2',...['a','b'].map(k=>id+'-thread-'+k)];
 const runtime=installMemoryRuntime({knowledge,registry,tables,workspace,config:{memoryPacketBytes:24000},readSessionEvents:async id=>events.get(id)??[],sessionIds:sessions});t.after(()=>runtime.close());
 async function bind({projectId=a.projectId,threadId='a',path=join(root,'workspace-'+projectId+'-'+threadId),scope='thread',folderId='folder-'+projectId+'-'+threadId}={}){
  await mkdir(path,{recursive:true});const session=projectId+'-thread-'+threadId,bindingId='binding-'+projectId+'-'+threadId,grantId='grant-'+bindingId;
  const binding={projectId,threadId,threadSessionId:session,bindingId,grantId,grantVersion:1,workspacePath:path,workspaceIdentity:{fixture:path}};
  await workspace.tables.bindings.put(bindingId,binding);await workspace.tables.grants.put(grantId,{grantId,state:'granted',scope,projectId,folderId,version:1});await workspace.tables.folders.put(folderId,{folderId,selectedPath:path,identity:{fixture:path}});return binding;
 }
 return {root,registry,knowledge,workspace,tables,runtime,events,a,b,bind};
}
const remember=(f,id,extra={})=>f.knowledge.memoryWrite(id,{name:'decisions/style.md',logicalPath:'decisions/style.md',kind:'decision',topicKey:'style',content:'统一使用中文项目说明。',reason:'明确项目约定',expectedRevision:0,operationId:'create',...extra},user);
function agent(id,{turn=1,messageId='message-1',query='项目说明 中文',kind='user'}={}){let events=[{type:'turn/start',data:{turn}},{type:'user/message',data:{id:messageId,source:{kind},content:[{type:'text',text:query}]}}];return {id,session:{snapshotEvents:()=>structuredClone(events)},setEvents:value=>{events=value}};}

test('OFFLINE no-repository project can query canonical memory and build context without scanning an implicit root',async t=>{
 const f=await fixture(t),entry=await remember(f,f.a.projectId),result=await f.runtime.search({projectId:f.a.projectId,query:'中文项目说明'});
 assert(result.current.some(hit=>hit.source.entryId===entry.entryId));assert.equal(result.stats.filesVisited,0);
 const packet=await f.runtime.prepare({agent:agent('co1'),projectId:f.a.projectId});assert(packet.text.includes('统一使用中文项目说明'));assert.equal(packet.evidence.length,0);
 const state=await f.runtime.state(f.a.projectId);assert.equal(state.memoryIndexMeta.resources.length,0);assert.equal(state.memoryIndexMeta.autoEvidence,false);
});

test('OFFLINE all 55 records are searchable; updated first record is used in packet, same-turn prepare is deduplicated',async t=>{
 const f=await fixture(t);let first;for(let i=0;i<55;i++){const r=await remember(f,f.a.projectId,{name:'decisions/'+i+'.md',logicalPath:'decisions/'+i+'.md',topicKey:'topic-'+i,content:'常规记录 '+i,operationId:'entry-'+i});first??=r;}
 await remember(f,f.a.projectId,{entryId:first.entryId,name:'decisions/0.md',logicalPath:'decisions/0.md',topicKey:'topic-0',content:'持久化存档必须使用 atomicSaveCheckpoint。',expectedRevision:1,operationId:'refresh'});
 const a=agent('co1',{query:'atomicSaveCheckpoint'}),[one,two]=await Promise.all([f.runtime.prepare({agent:a,projectId:f.a.projectId}),f.runtime.prepare({agent:a,projectId:f.a.projectId})]);
 assert.equal(one.packetId,two.packetId);assert(one.used.some(e=>e.entryId===first.entryId&&e.revision===2));assert(one.text.includes('atomicSaveCheckpoint'));assert(one.text.includes('"total":55'));
 assert.equal((await f.runtime.state(f.a.projectId)).memoryUsedPackets.length,1);
});

test('OFFLINE claimed current user message supplies the first Packet before user/message persistence; runtime-context is not a task',async t=>{
 const f=await fixture(t),entry=await remember(f,f.a.projectId,{content:'BeforePersistNeedle 当前请求对应的正式正文。'});
 const unrelated=await remember(f,f.a.projectId,{name:'other.md',logicalPath:'other.md',topicKey:'other',content:'OldRuntimeContextNeedle 过往无关说明。',operationId:'other'});
 const a=agent('co1');a.setEvents([{type:'turn/start',data:{turn:9}},{type:'user/message',data:{id:'context-record',source:{kind:'runtime-context'},content:[{type:'text',text:'OldRuntimeContextNeedle'}]}}]);
 assert.equal(await f.runtime.prepare({agent:a,projectId:f.a.projectId}),null);
 const message={id:'claimed-before-persist',role:'user',source:{kind:'user'},content:[{type:'text',text:'BeforePersistNeedle'}]};
 f.runtime.claim(a,message,8);assert.equal(await f.runtime.prepare({agent:a,projectId:f.a.projectId}),null);
 f.runtime.claim(a,message,9);const packet=await f.runtime.prepare({agent:a,projectId:f.a.projectId});
 assert(packet.text.includes('BeforePersistNeedle 当前请求对应的正式正文。'));assert(packet.used.some(e=>e.entryId===entry.entryId));assert(!packet.used.some(e=>e.entryId===unrelated.entryId));assert(packet.indexPreview.entries.some(e=>e.entryId===unrelated.entryId&&e.delivery==='index-preview'));assert(!packet.text.split('[Relevant current memory]\n').slice(1).map(section=>section.split('\n[')[0]).some(section=>section.includes('OldRuntimeContextNeedle 过往无关说明。')));
 assert.equal(packet.turnId,9);assert.equal((await f.runtime.state(f.a.projectId)).memoryUsedPackets.length,1);
});

test('OFFLINE caller closures represent coordinator, new Thread, continued agent-message and direct Thread user message; restart refreshes',async t=>{
 const f=await fixture(t),saved=await remember(f,f.a.projectId);
 const triggers=[{id:'co1',kind:'user',threadId:undefined},{id:'p1-thread-a',kind:'agent-message',threadId:'a'},{id:'p1-thread-a',kind:'agent-message',threadId:'a'},{id:'p1-thread-a',kind:'user',threadId:'a'}];
 const ids=[];for(let i=0;i<triggers.length;i++){const item=triggers[i],a=agent(item.id,{turn:i+1,messageId:'trigger-'+i,kind:item.kind});const packet=await f.runtime.prepare({agent:a,projectId:f.a.projectId,threadId:item.threadId});ids.push(packet.packetId);assert(packet.used.some(e=>e.entryId===saved.entryId));assert.equal(packet.threadId,item.threadId??null);}
 assert.equal(new Set(ids).size,4);
 const again=installMemoryRuntime({knowledge:f.knowledge,registry:f.registry,tables:f.tables,workspace:f.workspace,config:{},sessionIds:()=>['co1']});t.after(()=>again.close());const cold=await again.prepare({agent:agent('co1',{turn:10,messageId:'cold'}),projectId:f.a.projectId});assert(cold.used.some(e=>e.entryId===saved.entryId));
});

test('OFFLINE usage stores metadata without bodies or exact quotes; forget excludes future packets and queries',async t=>{
 const f=await fixture(t),saved=await remember(f,f.a.projectId,{content:'机密测试正文 月桂树-927'}),a=agent('co1',{query:'月桂树-927'});await f.runtime.prepare({agent:a,projectId:f.a.projectId});
 const usage=JSON.stringify(f.tables.preferences.get('memory-used:'+f.a.projectId));assert(!usage.includes('机密测试正文'));assert(!usage.includes('月桂树-927'));
 await f.knowledge.memoryDelete(f.a.projectId,{entryId:saved.entryId,expectedRevision:1,operationId:'forget'},user);f.runtime.invalidate(f.a.projectId);
 const next=await f.runtime.prepare({agent:agent('co1',{turn:2,messageId:'after-forget',query:'月桂树-927'}),projectId:f.a.projectId});assert(!next.text.includes('机密测试正文'));assert.equal(next.used.length,0);
 assert.equal((await f.runtime.search({projectId:f.a.projectId,query:'月桂树-927',includeHistory:true})).current.length,0);
});

test('OFFLINE UI edit provenance reopens only while visibly referenced; legacy provenance is explicitly stale',async t=>{
 const f=await fixture(t),saved=await remember(f,f.a.projectId),source=f.knowledge.memoryRead(f.a.projectId,saved.entryId).sourceRefs[0];
 assert.equal(source.kind,'ui-edit');const opened=await f.runtime.source({projectId:f.a.projectId,source});assert.equal(opened.stale,false);assert(opened.content.includes(source.operationId));
 await assert.rejects(f.runtime.source({projectId:f.b.projectId,source}),{code:'MEMORY_SOURCE_SCOPE'});
 await assert.rejects(f.runtime.source({projectId:f.a.projectId,source:{...source,operationId:'forged'}}),{code:'MEMORY_SOURCE_SCOPE'});
 await f.knowledge.memoryDelete(f.a.projectId,{entryId:saved.entryId,expectedRevision:1,operationId:'forget-provenance'},user);
 await assert.rejects(f.runtime.source({projectId:f.a.projectId,source}),{code:'MEMORY_SOURCE_SCOPE'});
 const project=f.registry.get(f.a.projectId);await f.registry.table.put(project.projectId,{...project,knowledgeVersion:1,memoryEntries:[...project.memoryEntries,{entryId:'legacy-provenance',name:'legacy.md',content:'Synthetic legacy entry',revision:1,origin:'model_observation',source:{callId:'legacy'},updatedAt:1}]});await f.knowledge.initialize();
 const legacy=f.knowledge.memoryRead(f.a.projectId,'legacy-provenance').sourceRefs[0],history=await f.runtime.source({projectId:f.a.projectId,source:legacy});assert.equal(legacy.kind,'legacy-source');assert.equal(history.stale,true);assert(history.content.includes('无法重新核实'));
});

test('OFFLINE explicitly indexed scope and settings govern code retrieval; revoke and changed file hashes are revalidated',async t=>{
 const f=await fixture(t),binding=await f.bind(),path=join(binding.workspacePath,'save.ts');await writeFile(path,'export function atomicSaveCheckpoint() { return "first"; }\n');
 const before=await f.runtime.search({projectId:f.a.projectId,threadId:'a',query:'atomicSaveCheckpoint'});assert.equal(before.evidence.length,0);
 await f.runtime.index({projectId:f.a.projectId});const state=await f.runtime.state(f.a.projectId);assert(state.memoryIndexMeta.indexedResourceCount>=1);assert.equal(state.memoryIndexMeta.autoEvidence,false);
 const result=await f.runtime.search({projectId:f.a.projectId,threadId:'a',query:'atomicSaveCheckpoint'}),hit=result.evidence.find(e=>e.source.path==='save.ts');assert(hit);assert.equal(hit.source.hash,sha(await readFile(path)));
 const opened=await f.runtime.source({projectId:f.a.projectId,threadId:'a',source:hit.source});assert.equal(opened.stale,false);assert(opened.content.includes('first'));
 await writeFile(path,'export function atomicSaveCheckpoint() { return "second"; }\n');assert.equal((await f.runtime.source({projectId:f.a.projectId,threadId:'a',source:hit.source})).stale,true);
 const grant=f.workspace.tables.grants.get(binding.grantId);await f.workspace.tables.grants.put(binding.grantId,{...grant,state:'revoked'});await assert.rejects(f.runtime.source({projectId:f.a.projectId,threadId:'a',source:hit.source}),{code:'MEMORY_SOURCE_REVOKED'});
});

test('OFFLINE same directory does not share canonical data or resources between two Projects',async t=>{
 const f=await fixture(t),shared=join(f.root,'shared');await f.bind({path:shared});await f.bind({projectId:f.b.projectId,path:shared});await writeFile(join(shared,'notes.md'),'共享目录授权文本 SharedWorkspaceNeedle');
 await remember(f,f.a.projectId,{content:'甲项目独有决定 ProjectAlphaRule'});await remember(f,f.b.projectId,{content:'乙项目独有决定 ProjectBetaRule'});await f.runtime.index({projectId:f.a.projectId});
 const alpha=await f.runtime.search({projectId:f.a.projectId,threadId:'a',query:'ProjectAlphaRule SharedWorkspaceNeedle'});assert(alpha.current.length>0);assert(alpha.evidence.length>0);
 const beta=await f.runtime.search({projectId:f.b.projectId,threadId:'a',query:'ProjectAlphaRule SharedWorkspaceNeedle'});assert.equal(beta.current.length,0);assert.equal(beta.evidence.length,0);
 assert.throws(()=>f.knowledge.memoryRead(f.b.projectId,alpha.current[0].source.entryId),{code:'MEMORY_REMOVED'});
});

test('OFFLINE two workspaces share project decisions but code evidence and source hashes stay local',async t=>{
 const f=await fixture(t),a=await f.bind(),b=await f.bind({threadId:'b'});await remember(f,f.a.projectId);
 await writeFile(join(a.workspacePath,'save.ts'),'export const saveCheckpoint = "WorktreeAlpha";\n');await writeFile(join(b.workspacePath,'save.ts'),'export const saveCheckpoint = "WorktreeBeta";\n');await f.runtime.index({projectId:f.a.projectId});
 const one=await f.runtime.search({projectId:f.a.projectId,threadId:'a',query:'saveCheckpoint'}),two=await f.runtime.search({projectId:f.a.projectId,threadId:'b',query:'saveCheckpoint'});
 assert(one.evidence.length&&two.evidence.length);assert(one.evidence.every(e=>!e.text.includes('WorktreeBeta')));assert(two.evidence.every(e=>!e.text.includes('WorktreeAlpha')));
 assert.notEqual(one.evidence[0].source.workspaceInstanceId,two.evidence[0].source.workspaceInstanceId);assert.notEqual(one.evidence[0].source.hash,two.evidence[0].source.hash);
 await assert.rejects(f.runtime.source({projectId:f.a.projectId,threadId:'a',source:two.evidence[0].source}),{code:'MEMORY_SOURCE_REVOKED'});
});

test('OFFLINE late query refuses permissions revoked or lifecycle paused while Library extraction is pending',async t=>{
 const f=await fixture(t),binding=await f.bind();await writeFile(join(binding.workspacePath,'code.md'),'latequery');await f.runtime.index({projectId:f.a.projectId});
 const p=f.registry.get(f.a.projectId);await f.registry.table.put(p.projectId,{...p,libraryItems:[{itemId:'synthetic',name:'synthetic.md',version:1,sha256:'fixture'}]});
 let begin,finish;const started=new Promise(r=>begin=r),held=new Promise(r=>finish=r);f.knowledge.libraryRead=async()=>{begin();await held;return {version:1,sha256:'fixture',text:'latequery pending'};};
 const pending=f.runtime.search({projectId:f.a.projectId,threadId:'a',query:'latequery'});await started;const grant=f.workspace.tables.grants.get(binding.grantId);await f.workspace.tables.grants.put(binding.grantId,{...grant,state:'revoked'});finish();await assert.rejects(pending,{code:'FOLDER_GRANT_REQUIRED'});
 let beginPause,finishPause;const startedPause=new Promise(r=>beginPause=r),heldPause=new Promise(r=>finishPause=r);f.knowledge.libraryRead=async()=>{beginPause();await heldPause;return {version:1,sha256:'fixture',text:'latequery pending'};};
 const paused=f.runtime.search({projectId:f.a.projectId,query:'latequery'});await startedPause;await f.registry.table.put(p.projectId,{...f.registry.get(p.projectId),lifecycle:'paused'});finishPause();await assert.rejects(paused,{code:'PROJECT_INACTIVE'});
});

test('OFFLINE pending packet cannot attach to another turn or message; source sessions are project bound',async t=>{
 const f=await fixture(t);await remember(f,f.a.projectId);const p=f.registry.get(f.a.projectId);await f.registry.table.put(p.projectId,{...p,libraryItems:[{itemId:'fixture',name:'fixture.md',version:1}],memoryEvidenceSettings:{autoEvidence:true,indexedResources:[],revision:1}});
 let begin,finish;const started=new Promise(r=>begin=r),held=new Promise(r=>finish=r);f.knowledge.libraryRead=async()=>{begin();await held;return {version:1,text:'fixture body'};};const a=agent('co1');const pending=f.runtime.prepare({agent:a,projectId:f.a.projectId});await started;a.setEvents([{type:'turn/start',data:{turn:2}},{type:'user/message',data:{id:'new',source:{kind:'user'},content:[{type:'text',text:'new task'}]}}]);finish();await assert.rejects(pending,{code:'MEMORY_PACKET_STALE'});
 await f.knowledge.memoryWrite(f.a.projectId,{name:'source.md',content:'Approved synthetic source',kind:'decision',topicKey:'source',expectedRevision:0,reason:'Synthetic approved source',operationId:'source'}, {...user,sourceRefs:[{kind:'user-message',sessionId:'co1',messageId:'source'}]});
 f.events.set('co1',[{type:'user/message',data:{id:'source',content:[{type:'text',text:'Approved synthetic source'}]}}]);const result=await f.runtime.source({projectId:f.a.projectId,source:{kind:'user-message',sessionId:'co1',messageId:'source'}});assert.equal(result.content,'Approved synthetic source');
 await assert.rejects(f.runtime.source({projectId:f.b.projectId,source:{kind:'user-message',sessionId:'co1',messageId:'source'}}),{code:'MEMORY_SOURCE_SCOPE'});
});
