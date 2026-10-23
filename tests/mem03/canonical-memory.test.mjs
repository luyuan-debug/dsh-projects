import test from 'node:test';
import assert from 'node:assert/strict';
import {Projects} from '../../src/product/domain/projects.mjs';
import {ProjectKnowledge} from '../../src/product/domain/project-knowledge.mjs';
import {memoryPath} from '../../src/product/domain/canonical-memory.mjs';

const user={kind:'user',origin:'user_instruction',source:{kind:'user-input'}};
const model={kind:'model',sessionId:'thread-session',threadId:'thread-a',origin:'model_observation',source:{sessionId:'thread-session',callId:'call-1'}};
const explicit={...model,intent:'explicit-decision',sourceRefs:[{kind:'user-message',sessionId:'thread-session',messageId:'human-1',exactQuote:'正式决定使用 MIT。'}]};
async function fixture(raw){
 const data=new Map();let shouldFail=false,writes=0;
 const table={get:id=>structuredClone(data.get(id)),entries:()=>[...data].map(([k,v])=>[k,structuredClone(v)]),put:async(id,value)=>{if(shouldFail){shouldFail=false;throw Object.assign(new Error('injected commit failure'),{code:'EIO'});}writes++;data.set(id,structuredClone(value));}};
 const registry=new Projects({table,createScope:async()=>({projectId:'p',coordinatorSessionId:'co'}),validateModel:async()=>{}});
 await registry.create({name:'Synthetic memory project'});if(raw)await table.put('p',{...registry.get('p'),...raw});
 const knowledge=new ProjectKnowledge({registry,blobs:{}});await knowledge.initialize();
 return {knowledge,registry,table,data,failNext:()=>{shouldFail=true},writes:()=>writes};
}
const write=(f,extra={},actor=user)=>f.knowledge.memoryWrite('p',{name:'decisions/license.md',logicalPath:'decisions/license.md',kind:'decision',topicKey:'license',content:'使用 MIT',reason:'项目许可决定',expectedRevision:0,operationId:'create',...extra},actor);

test('actual legacy migration preserves 60 entries, user authority, IDs, revisions and tombstones; repeats are inert',async()=>{
 const entries=Array.from({length:60},(_,i)=>({entryId:'legacy-'+i,name:i<2?'同名.md':'旧记录-'+i,content:'旧正文 '+i,revision:i+1,origin:i===0?'user_instruction':'model_observation',source:{callId:'legacy-call-'+i},updatedAt:i}));
 entries.push({entryId:'forgotten',revision:3,deleted:true,updatedAt:99});
 const f=await fixture({knowledgeVersion:1,memoryEntries:entries}),p=f.registry.get('p');
 assert.equal(p.knowledgeVersion,2);assert.equal(p.memoryEntries.length,61);assert.equal(p.memoryEntries[0].origin,'user_instruction');assert.equal(p.memoryEntries[1].origin,'model_observation');
 assert.deepEqual(p.memoryEntries.slice(0,60).map(e=>[e.entryId,e.content,e.revision,e.source]),entries.slice(0,60).map(e=>[e.entryId,e.content,e.revision,e.source]));
 assert.equal(p.memoryEntries[0].sourceRefs[0].kind,'legacy-source');assert.equal(p.memoryEntries[0].sourceRefs[0].verified,false);
 assert.notEqual(p.memoryEntries[0].logicalPath,p.memoryEntries[1].logicalPath);assert.equal(new Set(p.memoryEntries.slice(0,60).map(e=>e.logicalPath)).size,60);
 const before=JSON.stringify(p),count=f.writes();await f.knowledge.initialize();assert.equal(f.writes(),count);assert.equal(JSON.stringify(f.registry.get('p')),before);
 assert.equal(f.knowledge.records('p').length,60);assert.equal(f.knowledge.index('p').memory.nextOffset,50);assert.equal(f.knowledge.memoryFiles('p').length,61);
 assert.throws(()=>f.knowledge.memoryRead('p','forgotten'),{code:'MEMORY_REMOVED'});
});

test('formal model proposals stay candidate unless current explicit user decision is verified; quote alone grants nothing',async()=>{
 const f=await fixture(),candidate=await write(f,{},model);assert.equal(candidate.status,'candidate');assert.equal(f.knowledge.records('p').length,0);
 const quoted=await write(f,{name:'quote.md',logicalPath:'quote.md',topicKey:'quote',operationId:'quote'},{...model,sourceRefs:explicit.sourceRefs});assert.equal(quoted.status,'candidate');
 const confirmed=await write(f,{name:'confirmed.md',logicalPath:'confirmed.md',topicKey:'confirmed',operationId:'confirmed'},explicit);assert.equal(confirmed.status,'active');assert.equal(f.knowledge.memoryRead('p',confirmed.entryId).origin,'user_instruction');
 await assert.rejects(write(f,{name:'fake.md',logicalPath:'fake.md',operationId:'fake',sourceRefs:[{kind:'user-message',messageId:'forged'}]},model),{code:'MEMORY_SOURCE'});
 const observation=await write(f,{name:'lesson.md',logicalPath:'lesson.md',kind:'lesson',topicKey:'lesson',operationId:'lesson'},model);assert.equal(observation.status,'active');
 await assert.rejects(write(f,{entryId:confirmed.entryId,name:'confirmed.md',logicalPath:'confirmed.md',expectedRevision:1,operationId:'overwrite'},model),{code:'USER_MEMORY_PROTECTED'});
});

test('same topic replacement is atomic, expected-revision protected and history is excluded from current files',async()=>{
 const f=await fixture(),a=await write(f),replacement={content:'改为 Apache 2.0',operationId:'replace',supersedes:[{entryId:a.entryId,expectedRevision:1}]};
 f.failNext();await assert.rejects(write(f,replacement),{code:'EIO'});assert.equal(f.knowledge.records('p').length,1);assert.equal(f.knowledge.memoryRead('p',a.entryId).status,'active');
 const results=await Promise.allSettled(['replace-a','replace-b'].map(operationId=>write(f,{...replacement,operationId})));
 assert.equal(results.filter(r=>r.status==='fulfilled').length,1);assert.equal(results.find(r=>r.status==='rejected').reason.code,'MEMORY_CONFLICT');
 const active=f.knowledge.records('p');assert.equal(active.length,1);assert.deepEqual(active[0].supersedes,[a.entryId]);assert.equal(f.knowledge.memoryFileRead('p','decisions/license.md').content,'改为 Apache 2.0');
 assert(f.knowledge.records('p',{status:'history'}).every(e=>e.status==='superseded'));assert(f.knowledge.records('p',{status:'history'}).some(e=>e.content==='使用 MIT'));
 assert(!f.knowledge.memoryFileRead('p','MEMORY.md').content.includes(a.entryId));
});

test('in-place editing keeps historical body with CAS and stable entryId; retry input cannot change',async()=>{
 const f=await fixture(),a=await write(f),input={entryId:a.entryId,expectedRevision:1,content:'MIT，保留版权',operationId:'edit'};
 const b=await write(f,input);assert.equal(b.entryId,a.entryId);assert.equal(b.revision,2);assert.equal((await write(f,input)).replayed,true);
 await assert.rejects(write(f,{...input,content:'other'}),{code:'OPERATION_CONFLICT'});
 assert.equal(f.knowledge.memoryRead('p',a.entryId,{revision:1,status:'history'}).content,'使用 MIT');
 assert.throws(()=>f.knowledge.memoryRead('p',a.entryId,{revision:1}),{code:'MEMORY_HISTORY_REQUIRED'});
 assert.equal(f.knowledge.records('p').length,1);assert.equal(f.knowledge.records('p',{status:'history'}).length,1);
});

test('MEMORY.md has editable description and checked pins; links are derived and survive restart',async()=>{
 const f=await fixture(),a=await write(f);await f.knowledge.memoryIndexWrite('p',{description:'项目许可与写作约定。',pinnedEntryIds:[a.entryId],expectedRevision:0,operationId:'index'},user);
 const index=f.knowledge.memoryFileRead('p','MEMORY.md');assert(index.content.includes('自动生成的索引'));assert(index.content.includes('项目许可与写作约定。'));assert(index.content.includes('[decisions/license.md](decisions/license.md)'));assert(index.content.includes('★'));
 const again=new ProjectKnowledge({registry:f.registry,blobs:{}});await again.initialize();assert.equal(again.memoryFileRead('p','MEMORY.md').content,index.content);
 await assert.rejects(f.knowledge.memoryIndexWrite('p',{description:'x',pinnedEntryIds:['missing'],expectedRevision:1,operationId:'bad-pin'},user),{code:'MEMORY_INDEX_LINK'});
 await assert.rejects(write(f,{name:'MEMORY.md',logicalPath:'MEMORY.md',operationId:'fake-index'}),{code:'MEMORY_INDEX_GENERATED'});
 for(const path of ['../outside.md','/tmp/private.md','a/../b.md','file:a.md','a\\b.md','a//b.md'])assert.throws(()=>memoryPath(path));
});

test('archive and user confirmation use CAS; candidates never silently become current',async()=>{
 const f=await fixture(),a=await write(f,{},model);assert.equal(f.knowledge.records('p',{status:'candidate'}).length,1);
 await assert.rejects(f.knowledge.memoryTransition('p',{entryId:a.entryId,expectedRevision:1,status:'active',operationId:'self-approve'},model),{code:'USER_MEMORY_PROTECTED'});
 const confirmed=await f.knowledge.memoryTransition('p',{entryId:a.entryId,expectedRevision:1,status:'active',operationId:'approve'},user);assert.equal(confirmed.revision,2);assert.equal(f.knowledge.records('p')[0].origin,'user_instruction');
 await assert.rejects(f.knowledge.memoryTransition('p',{entryId:a.entryId,expectedRevision:1,status:'archived',operationId:'stale'},user),{code:'MEMORY_CONFLICT'});
 await f.knowledge.memoryTransition('p',{entryId:a.entryId,expectedRevision:2,status:'archived',operationId:'archive'},user);assert.equal(f.knowledge.records('p').length,0);assert.equal(f.knowledge.records('p',{status:'history'})[0].status,'archived');
});

test('forget purges all revisions, source quotes and receipts; old source cannot recreate it after restart',async()=>{
 const f=await fixture(),a=await write(f,{},explicit);await write(f,{entryId:a.entryId,expectedRevision:1,content:'修正后正文',operationId:'edit'},explicit);
 await f.knowledge.memoryDelete('p',{entryId:a.entryId,expectedRevision:2,operationId:'forget'},user);
 const persisted=JSON.stringify(f.registry.get('p'));for(const secret of ['使用 MIT','修正后正文','正式决定使用 MIT。'])assert(!persisted.includes(secret));
 assert.equal(f.knowledge.records('p',{status:'all'}).length,0);assert.equal(f.knowledge.memoryFiles('p',{status:'all'}).length,1);assert.equal(f.knowledge.memoryExport('p').entries.length,0);
 const reloaded=new ProjectKnowledge({registry:f.registry,blobs:{}});await reloaded.initialize();await assert.rejects(reloaded.memoryWrite('p',{name:'restored.md',kind:'decision',content:'使用 MIT',reason:'reuse old message',expectedRevision:0,operationId:'old-source'},{...explicit,sourceRefs:explicit.sourceRefs.map(r=>({...r,callId:'different-call'}))}),{code:'MEMORY_FORGOTTEN_SOURCE'});
 await assert.rejects(write(f,{},explicit),{code:'MEMORY_REMOVED'});
 const fresh=await write(f,{name:'fresh.md',logicalPath:'fresh.md',operationId:'fresh'},{...explicit,sourceRefs:[{kind:'user-message',sessionId:'thread-session',messageId:'new-human'}]});assert.equal(fresh.status,'active');
});

test('project and thread scope separate facts while sharing project decisions; exports preserve scope',async()=>{
 const f=await fixture();await write(f);await write(f,{name:'thread-a.md',logicalPath:'thread-a.md',kind:'observation',topicKey:'a',scope:{kind:'thread',threadId:'thread-a'},operationId:'a'},model);
 await write(f,{name:'thread-b.md',logicalPath:'thread-b.md',kind:'observation',topicKey:'b',scope:{kind:'thread',threadId:'thread-b'},operationId:'b'},user);
 assert.equal(f.knowledge.records('p').length,1);assert.equal(f.knowledge.records('p',{threadId:'thread-a'}).length,2);assert(!JSON.stringify(f.knowledge.records('p',{threadId:'thread-a'})).includes('thread-b.md'));
 const b=f.knowledge.records('p',{threadId:'thread-b'}).find(e=>e.logicalPath==='thread-b.md');assert.throws(()=>f.knowledge.memoryRead('p',b.entryId,{threadId:'thread-a'}),{code:'MEMORY_SCOPE'});
 await assert.rejects(write(f,{name:'cross.md',logicalPath:'cross.md',kind:'observation',topicKey:'cross',scope:{kind:'thread',threadId:'thread-b'},operationId:'cross'},model),{code:'MEMORY_SCOPE'});
 assert.equal(f.knowledge.memoryExport('p').entries.length,3);
});

test('51st-plus data stays discoverable after editing first record; logical files read the new body',async()=>{
 const f=await fixture();let first;for(let i=0;i<55;i++){const r=await write(f,{name:'decisions/'+i+'.md',logicalPath:'decisions/'+i+'.md',topicKey:'topic-'+i,operationId:'op-'+i,content:'decision '+i});first??=r;}
 await write(f,{entryId:first.entryId,name:'decisions/0.md',logicalPath:'decisions/0.md',topicKey:'topic-0',content:'最新中文决定',expectedRevision:1,operationId:'refresh'});
 assert.equal(f.knowledge.records('p').length,55);assert.equal(f.knowledge.memoryFileRead('p','decisions/0.md').content,'最新中文决定');const document=f.knowledge.memoryFileRead('p','MEMORY.md').content;assert.equal((document.match(/^-[^\n]*\]\(/gm)??[]).length,50);assert(document.includes('共 55 条'));assert(document.includes('省略 5 条'));const page1=f.knowledge.index('p'),page2=f.knowledge.index('p',{offset:page1.memory.nextOffset});assert.equal(page1.memory.nextOffset,50);assert.equal(page2.memory.entries.length,5);assert.equal(new Set([...page1.memory.entries,...page2.memory.entries].map(e=>e.entryId)).size,55);assert.equal(f.knowledge.memoryFiles('p').length,56);assert.equal(f.knowledge.memoryFileRead('p','decisions/54.md').content,'decision 54');
});

test('corrupt canonical state fails explicitly, and future schemas refuse downgrade',async()=>{
 await assert.rejects(fixture({knowledgeVersion:1,memoryEntries:[{entryId:'bad',revision:1,content:null}]}),{code:'MEMORY_STORE_CORRUPT'});
 await assert.rejects(fixture({knowledgeVersion:3,memoryEntries:[]}),{code:'MEMORY_SCHEMA_NEWER'});
});

test('historical body bytes count against configured capacity, failed edit does not lose current body',async()=>{
 const f=await fixture(),a=await write(f,{content:'A'.repeat(100)});f.knowledge.limits.totalMemoryBytes=150;
 await assert.rejects(write(f,{entryId:a.entryId,expectedRevision:1,content:'B'.repeat(100),operationId:'too-large'}),{code:'MEMORY_LIMIT'});
 assert.equal(f.knowledge.memoryRead('p',a.entryId).content,'A'.repeat(100));
});

test('activating a candidate via explicit CAS replacement preserves both candidate history and supersedes edge',async()=>{const f=await fixture();const a=await write(f);const c=await write(f,{name:'decisions/candidate.md',logicalPath:'decisions/candidate.md',content:'使用 BSD',status:'candidate',operationId:'candidate'},model);const result=await write(f,{entryId:c.entryId,name:'decisions/candidate.md',logicalPath:'decisions/candidate.md',content:'使用 BSD',status:'active',expectedRevision:c.revision,operationId:'confirm-candidate',supersedes:[{entryId:a.entryId,expectedRevision:a.revision}]});assert.equal(result.status,'active');assert.deepEqual(f.knowledge.memoryRead('p',c.entryId).supersedes,[a.entryId]);assert.equal(f.knowledge.records('p',{status:'active'}).length,1);});

test('same logical historical path is disambiguated by entry identity and revision rather than wrong body',async()=>{const f=await fixture();const a=await write(f,{content:'A'});const b=await write(f,{content:'B',operationId:'replace-b',supersedes:[{entryId:a.entryId,expectedRevision:a.revision}]});await write(f,{content:'C',operationId:'replace-c',supersedes:[{entryId:b.entryId,expectedRevision:b.revision}]});assert.throws(()=>f.knowledge.memoryFileRead('p','decisions/license.md',{status:'history',revision:1}),{code:'MEMORY_FILE_AMBIGUOUS'});assert.equal(f.knowledge.memoryFileRead('p','decisions/license.md',{status:'history',entryId:a.entryId,revision:1}).content,'A');assert.equal(f.knowledge.memoryFileRead('p','decisions/license.md',{status:'history',entryId:b.entryId,revision:1}).content,'B');});
