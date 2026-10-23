// Actual local product module integration only. No network, models or Profile.
import test from 'node:test';
import assert from 'node:assert/strict';
import {Projects} from '../../src/product/domain/projects.mjs';
import {ProjectKnowledge} from '../../src/product/domain/project-knowledge.mjs';
import {installMemoryRuntime} from '../../src/product/host/project-memory-runtime.mjs';
import {describeMemoryEntry,MEMORY_DESCRIPTION_CODEPOINTS} from '../../src/product/domain/memory-entry-preview.mjs';
const owner={kind:'user',origin:'user_instruction',source:{kind:'user-input'}};
function table(){const data=new Map();return {get:key=>structuredClone(data.get(key)),entries:()=>[...data].map(([key,value])=>[key,structuredClone(value)]),put:async(key,value)=>data.set(key,structuredClone(value)),delete:async key=>data.delete(key)};}
async function fixture(t){
 const projects=table();let count=0;const registry=new Projects({table:projects,createScope:async()=>({projectId:'p'+(++count),coordinatorSessionId:'co'+count}),validateModel:async()=>{}});await registry.create({name:'Owned index preview fixture'});await registry.create({name:'Other owned Project'});const knowledge=new ProjectKnowledge({registry,blobs:{}});await knowledge.initialize();
 const workspace={tables:{bindings:table(),grants:table(),folders:table()},control:{admittedSync:()=>false,admit:async()=>assert.fail('No authorized source scan is needed')}};
 const tables={preferences:table()},runtime=installMemoryRuntime({knowledge,registry,tables,workspace,config:{memoryPacketBytes:24000},readSessionEvents:async()=>[],sessionIds:()=>['co1','thread-session-a','thread-session-b']});t.after(()=>runtime.close());let next=0;
 async function write(extra={},projectId='p1'){const id=++next;return knowledge.memoryWrite(projectId,{name:'记忆标题 '+id,logicalPath:'decisions/entry-'+id+'.md',kind:'decision',topicKey:'topic-'+id,content:'游戏能力必须独立运行；项目管理仅为可选兼容层。\n\nFullBodyNeverInjected_'+id+' '+('后续限制条件。'.repeat(80)),reason:'Owned literal index fixture',expectedRevision:0,operationId:'index-entry-'+id,...extra},owner);}
 return {registry,knowledge,tables,runtime,write};
}
function agent(id,{turn=1,messageId='message-1',kind='user',query='Fix toolbar alignment and responsive button padding'}={}){const events=[{type:'turn/start',data:{turn}},{type:'user/message',data:{id:messageId,role:'user',source:{kind},content:[{type:'text',text:query}]}}];return {id,session:{snapshotEvents:()=>structuredClone(events)}};}
function payload(packet){const found=packet.text.match(/\n\[MEMORY\.md index\]\n([^\n]*)\n/);return found?JSON.parse(found[1]):null;}
const usage=f=>f.tables.preferences.get('memory-used:p1')?.packets??[];

test('Manual MEMORY.md and actual prepare share a literal description for an unrelated, unpinned decision without delivering its full body',async t=>{
 const f=await fixture(t),saved=await f.write({name:'插件独立边界',topicKey:'plugin-runtime-boundary',logicalPath:'decisions/plugin-boundary.md'}),entry=f.knowledge.memoryRead('p1',saved.entryId),description=describeMemoryEntry(entry),manual=f.knowledge.memoryFileRead('p1','MEMORY.md');
 const packet=await f.runtime.prepare({agent:agent('co1'),projectId:'p1'}),index=payload(packet),row=index.files.find(row=>row.id===saved.entryId);
 assert.ok(manual.content.includes(description.description));assert.equal(row.description,description.description);assert.equal(row.descriptionTruncated,true);assert.equal(row.path,entry.logicalPath);assert.equal(row.name,'插件独立边界');assert.equal(row.topicKey,'plugin-runtime-boundary');assert.equal(row.kind,'decision');assert.equal(row.revision,1);assert.equal(row.status,'active');assert.ok(packet.text.includes('not full bodies or approvals'));assert.ok(packet.text.includes('conditions or negation'));assert.ok(!packet.text.includes('FullBodyNeverInjected_1'));assert.ok(!packet.used.some(ref=>ref.entryId===saved.entryId));assert.ok(packet.indexPreview.entries.some(ref=>ref.entryId===saved.entryId&&ref.delivery==='index-preview'));
});

test('Four actual business paths preserve the source kind and all receive the same current preview layer',async t=>{
 const f=await fixture(t),saved=await f.write(),paths=[{id:'co1',kind:'user'},{id:'thread-session-a',kind:'agent-message',threadId:'a'},{id:'thread-session-a',kind:'agent-message',threadId:'a'},{id:'thread-session-a',kind:'user',threadId:'a'}];
 for(let index=0;index<paths.length;index++){const path=paths[index],subject=agent(path.id,{turn:index+1,messageId:'business-'+index,kind:path.kind}),before=subject.session.snapshotEvents(),packet=await f.runtime.prepare({agent:subject,projectId:'p1',threadId:path.threadId});assert.deepEqual(subject.session.snapshotEvents(),before);assert.ok(payload(packet).files.some(row=>row.id===saved.entryId&&row.description));assert.ok(packet.indexPreview.entries.some(ref=>ref.entryId===saved.entryId));assert.ok(!packet.used.some(ref=>ref.entryId===saved.entryId));assert.equal(packet.threadId,path.threadId??null);}
 assert.equal(usage(f).length,4);
});

test('Update and forget rebuild real previews; persisted Used contains references rather than old titles, topics or preview bodies',async t=>{
 const f=await fixture(t),saved=await f.write({name:'SensitiveTitleOriginal',topicKey:'SensitiveTopicOriginal',content:'SensitivePreviewOriginal 当前决定。\n\nFullOriginalBody'}),subject=agent('co1');
 const first=await f.runtime.prepare({agent:subject,projectId:'p1'});assert.equal(payload(first).files[0].description,'SensitivePreviewOriginal 当前决定。');const persisted=JSON.stringify(usage(f));for(const value of ['SensitiveTitleOriginal','SensitiveTopicOriginal','SensitivePreviewOriginal','FullOriginalBody','description":'])assert.ok(!persisted.includes(value),value);
 await f.knowledge.memoryWrite('p1',{entryId:saved.entryId,name:'SensitiveTitleUpdated',logicalPath:saved.logicalPath,kind:'decision',topicKey:'SensitiveTopicUpdated',content:'SensitivePreviewUpdated 更新约定。\n\nFullUpdatedBody',reason:'Owned update',expectedRevision:1,operationId:'preview-update'},owner);f.runtime.invalidate('p1');const updated=await f.runtime.prepare({agent:subject,projectId:'p1'});assert.equal(payload(updated).files[0].description,'SensitivePreviewUpdated 更新约定。');assert.equal(updated.indexPreview.entries[0].revision,2);assert.ok(!updated.text.includes('SensitivePreviewOriginal'));
 await f.knowledge.memoryDelete('p1',{entryId:saved.entryId,expectedRevision:2,operationId:'preview-forget'},owner);f.runtime.invalidate('p1');const forgotten=await f.runtime.prepare({agent:subject,projectId:'p1'});assert.equal(forgotten.indexPreview.total,0);assert.equal(forgotten.indexPreview.shown,0);assert.deepEqual(forgotten.indexPreview.entries,[]);assert.ok(!forgotten.text.includes('SensitivePreviewUpdated'));assert.ok(!JSON.stringify(usage(f)).includes('SensitivePreviewUpdated'));assert.ok(!JSON.stringify(usage(f)).includes('SensitiveTitleUpdated'));
});

test('Current index respects project/thread scope and excludes candidate, archived, superseded, deleted and other Project entries',async t=>{
 const f=await fixture(t),old=await f.write({topicKey:'replace',logicalPath:'decisions/replacement.md'}),current=await f.write({topicKey:'replace',logicalPath:'decisions/replacement.md',supersedes:[{entryId:old.entryId,expectedRevision:1}]}),candidate=await f.write({status:'candidate'}),archived=await f.write(),forgot=await f.write();
 await f.knowledge.memoryTransition('p1',{entryId:archived.entryId,expectedRevision:1,status:'archived',operationId:'archive'},owner);await f.knowledge.memoryDelete('p1',{entryId:forgot.entryId,expectedRevision:1,operationId:'delete'},owner);
 const a=await f.write({scope:{kind:'thread',threadId:'a'},kind:'observation'}),b=await f.write({scope:{kind:'thread',threadId:'b'},kind:'observation'}),foreign=await f.write({},'p2'),question=await f.write({kind:'open_question',content:'是否提供云执行？尚未决定。'});
 const coordinator=await f.runtime.prepare({agent:agent('co1'),projectId:'p1'}),coIds=payload(coordinator).files.map(row=>row.id);assert.ok(coIds.includes(current.entryId));assert.ok(coIds.includes(question.entryId));for(const entry of [old,candidate,archived,forgot,a,b,foreign])assert.ok(!coIds.includes(entry.entryId),entry.entryId);assert.ok(payload(coordinator).files.every(row=>row.status==='active'));assert.equal(payload(coordinator).files.find(row=>row.id===question.entryId).kind,'open_question');assert.ok(coordinator.text.includes('open_question is unresolved'));
 const own=await f.runtime.prepare({agent:agent('thread-session-a'),projectId:'p1',threadId:'a'}),ownIds=payload(own).files.map(row=>row.id);assert.ok(ownIds.includes(a.entryId));assert.ok(!ownIds.includes(b.entryId));assert.ok(own.indexPreview.entries.find(row=>row.entryId===a.entryId).scope.threadId==='a');
});

test('Codepoint-bounded descriptions flag all omitted continuation and preserve the same literal string in both index consumers',async t=>{
 const text='界'.repeat(97)+'👩🏽‍💻'+('不可以省略的条件'.repeat(12)),f=await fixture(t),saved=await f.write({content:text}),entry=f.knowledge.memoryRead('p1',saved.entryId),preview=describeMemoryEntry(entry),packet=await f.runtime.prepare({agent:agent('co1'),projectId:'p1'});
 assert.equal(MEMORY_DESCRIPTION_CODEPOINTS,100);assert.equal(Array.from(preview.description).length,100);assert.equal(preview.description,Array.from(text).slice(0,100).join(''));assert.equal(preview.descriptionTruncated,true);assert.equal(payload(packet).files[0].description,preview.description);assert.ok(f.knowledge.memoryFileRead('p1','MEMORY.md').content.includes(preview.description));assert.ok(f.knowledge.memoryFileRead('p1','MEMORY.md').content.includes('非完整正文'));
 assert.equal(describeMemoryEntry({content:'简短首行。\n\n后续包含条件。'}).descriptionTruncated,true);assert.equal(describeMemoryEntry({content:'只有完整短行。'}).descriptionTruncated,false);
});

test('Real UTF-8 Packet budget and page omission agree with exactly delivered previews, including no-space case',async t=>{
 const f=await fixture(t);for(let index=0;index<60;index++)await f.write({name:'当前约定 '+index,content:'每项当前约定 '+index+'：'+'界'.repeat(130)});
 const packet=await f.runtime.prepare({agent:agent('co1'),projectId:'p1',budgetBytes:8000}),index=payload(packet);assert.equal(packet.bytes,Buffer.byteLength(packet.text));assert.ok(packet.bytes<=8000);assert.equal(index.total,60);assert.ok(index.shown>0&&index.shown<60);assert.equal(index.shown,index.files.length);assert.equal(index.omitted,60-index.shown);assert.equal(index.nextOffset,index.shown);assert.equal(packet.indexPreview.shown,index.shown);assert.equal(packet.indexPreview.entries.length,index.shown);assert.deepEqual(packet.indexPreview.entries.map(ref=>ref.entryId),index.files.map(row=>row.id));assert.ok(packet.warnings.some(value=>value.includes('Index preview omitted')));
 const critical=await f.write({kind:'brief',content:'CriticalKeepR1 当前关键概要。'}),tiny=await f.runtime.prepare({agent:agent('co1',{turn:2,messageId:'tiny'}),projectId:'p1',budgetBytes:2048});assert.ok(tiny.bytes<=2048);assert.ok(tiny.used.some(ref=>ref.entryId===critical.entryId));const tinyIndex=payload(tiny);assert.equal(tiny.indexPreview.shown,tinyIndex?.shown??0);assert.equal(tiny.indexPreview.entries.length,tinyIndex?.files.length??0);assert.equal(tiny.indexPreview.omitted,tiny.indexPreview.total-tiny.indexPreview.shown);if(!tinyIndex)assert.ok(tiny.warnings.some(value=>value.includes('MEMORY.md index: omitted')));
});

test('Relevant full body has priority over index space and is never counted as a second full body through preview references',async t=>{
 const f=await fixture(t),brief=await f.write({kind:'brief',content:'criticalRelevantNeedle 当前关键约束。'}),matched=await f.write({content:'atomicPriorityNeedle '+('required body detail '.repeat(55))});for(let index=0;index<15;index++)await f.write();
 const packet=await f.runtime.prepare({agent:agent('co1',{query:'atomicPriorityNeedle criticalRelevantNeedle'}),projectId:'p1',budgetBytes:5000});assert.ok(packet.used.some(ref=>ref.entryId===matched.entryId));assert.ok(packet.used.some(ref=>ref.entryId===brief.entryId));assert.ok(packet.used.every(ref=>ref.delivery==='full-body'));assert.equal(new Set(packet.used.map(ref=>ref.entryId+':'+ref.revision)).size,packet.used.length);assert.ok(packet.indexPreview.entries.every(ref=>ref.delivery==='index-preview'));assert.ok(packet.bytes<=5000);assert.ok(!JSON.stringify(usage(f)).includes('required body detail'));
});


test('Automatic index nextOffset resumes the actual Knowledge list without omissions when timestamps tie and paths oppose entry IDs',async t=>{
 const f=await fixture(t);for(let index=0;index<30;index++)await f.write({content:'分页字面记录 '+index+'。\n\n完整正文保持按需读取。'});
 const project=f.registry.get('p1'),entries=project.memoryEntries.slice().sort((a,b)=>a.entryId.localeCompare(b.entryId)).map((entry,index)=>({...entry,logicalPath:'decisions/reverse-'+String(29-index).padStart(2,'0')+'.md',updatedAt:42}));await f.registry.table.put('p1',{...project,memoryEntries:entries});
 const packet=await f.runtime.prepare({agent:agent('co1'),projectId:'p1'}),preview=packet.indexPreview,full=f.knowledge.index('p1',{offset:0,limit:50}).memory.entries;
 assert.ok(preview.shown>0&&preview.shown<30);assert.equal(preview.nextOffset,preview.shown);assert.deepEqual(preview.entries.map(ref=>ref.entryId),full.slice(0,preview.shown).map(entry=>entry.entryId));const later=f.knowledge.index('p1',{offset:preview.nextOffset,limit:50}).memory.entries,all=[...preview.entries,...later];assert.equal(all.length,30);assert.equal(new Set(all.map(entry=>entry.entryId)).size,30);assert.deepEqual(all.map(entry=>entry.entryId),full.map(entry=>entry.entryId));assert.deepEqual(payload(packet).files.map(row=>row.id),preview.entries.map(ref=>ref.entryId));
});


test('Literal numeric/operator prefixes keep their sign in the shared formatter and actual automatic Packet',async t=>{
 const f=await fixture(t);
 for(const text of ['-1 means disabled','>0 means enabled']){
  const direct=describeMemoryEntry({content:text});assert.equal(direct.description,text);assert.equal(direct.descriptionTruncated,false);
  const saved=await f.write({content:text}),packet=await f.runtime.prepare({agent:agent('co1',{turn:text[0]==='-'?40:41,messageId:'literal-'+text}),projectId:'p1'}),actual=payload(packet).files.find(row=>row.id===saved.entryId);assert.equal(actual.description,text);assert.equal(actual.descriptionTruncated,false);assert.ok(f.knowledge.memoryFileRead('p1','MEMORY.md').content.includes(text));assert.ok(!packet.used.some(ref=>ref.entryId===saved.entryId));
 }
 // Formatting marks are literal source data too, not a semantic rewrite step.
 assert.equal(describeMemoryEntry({content:'> 0 remains a comparison if that is what the source says'}).description,'> 0 remains a comparison if that is what the source says');
});
