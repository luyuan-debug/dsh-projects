import {writeFile, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {LlmAdapter} = await import(process.env.RELEASE_LLM_MODULE);
export const inject = ['llm', 'pluginManager', 'agents', 'sessionPersistence'];
// Exact synthetic utterances from the MEM03 handoff scenarios, never real work.
const handoffIntents=[
  {id:'u-old',text:'这个测试项目先让游戏插件依赖 Projects。',quote:'这个测试项目先让游戏插件依赖 Projects。',kind:'decision',status:'active'},
  {id:'u-no',text:'我们不采用云执行，不要把这个理解成以后一定要补云端。',quote:'我们不采用云执行，不要把这个理解成以后一定要补云端。',kind:'constraint',status:'active'},
  {id:'u-hyp',text:'假设我们又让游戏插件依赖 Projects，会出现什么问题？这不是要改决定。',quote:'游戏插件依赖 Projects',kind:'decision',status:'candidate'},
  {id:'u-quote',text:'下面是另一个人的建议：“必须修改 DSH 核心”。请审查它，我还没有同意。',quote:'必须修改 DSH 核心',kind:'constraint',status:'candidate'},
];

// A deterministic SDK adapter. No provider credentials, network or semantic claims.
class ReleaseFixture extends LlmAdapter {
  providerInfo(provider) { return {id: provider, name: 'Release offline fixture'}; }
  async listModels(provider) { return [{provider, id: 'scripted', name: 'scripted', inputModalities: ['text']}]; }
  async resolveModel(provider, id) { return {provider, id, name: id, context: {contextWindow: 32000}}; }
  async *stream(options) {
    const users = options.messages.filter(m => m.role === 'user' && ['user', 'agent-message'].includes(m.source?.kind));
    const last = users.at(-1);
    const text = (last?.content ?? []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    const tail = options.messages.slice(options.messages.indexOf(last) + 1);
    let call;
    const decision=text.match(/MEM03_DECISION supersedes=([a-f0-9]+) revision=(\d+)/);
    const forgetting=text.match(/MEM03_FORGET entry=([a-f0-9]+) revision=(\d+)/);
    if (last?.source?.kind === 'user' && !tail.some(m => m.role === 'tool')) {
      const fixture=handoffIntents.find(f=>f.text===text);
      if(fixture)call=['project_memory_write',{name:'decisions/handoff-'+fixture.id+'.md',logicalPath:'decisions/handoff-'+fixture.id+'.md',kind:fixture.kind,topicKey:'handoff-'+fixture.id,content:fixture.quote,reason:'Exact synthetic MEM03 handoff intent fixture',expectedRevision:0,sourceMessageId:last.id,exactQuote:fixture.quote,status:'active'}];
      if(text.includes('MEM03_CANDIDATE'))call=['project_memory_write',{name:'decisions/candidate.md',logicalPath:'decisions/candidate.md',kind:'decision',topicKey:'storage-candidate',content:'采用 C 的待选方案',reason:'Synthetic ambiguous question',expectedRevision:0,sourceMessageId:last.id,exactQuote:'采用 C',status:'active'}];
      if(decision)call=['project_memory_write',{name:'decisions/storage-b.md',logicalPath:'decisions/storage-b.md',kind:'decision',topicKey:'storage',content:'采用 B，放弃 A。',reason:'Synthetic explicit current decision',expectedRevision:0,sourceMessageId:last.id,exactQuote:'采用 B，放弃 A。',status:'active',supersedes:[{entryId:decision[1],expectedRevision:Number(decision[2])}]}];
      if(forgetting)call=['project_memory_delete',{entryId:forgetting[1],expectedRevision:Number(forgetting[2]),sourceMessageId:last.id,exactQuote:'请忘记这条记忆。',origin:'user_instruction'}];
      if(text==='MEM03_DISPATCH')call=['project_dispatch',{title:'MEM03 current memory Thread',task:'MEM03_WORKER'}];
      if (text === 'RELEASE_DISPATCH') call = ['project_dispatch', {title: 'Release Thread', task: 'RELEASE_WORKER'}];
      const match = text.match(/^RELEASE_CONTINUE thread=([a-f0-9-]+)$/);
      if (match) call = ['project_continue', {threadId: match[1], task: 'RELEASE_WORKER_CONTINUE'}];
    }
    if (call) {
      const id = randomUUID(), [name, args] = call, argumentsString = JSON.stringify(args);
      yield {type: 'block-start', index: 0, blockType: 'tool-call'};
      yield {type: 'tool-call-delta', index: 0, id, name, argumentsDelta: argumentsString};
      yield {type: 'block-end', index: 0, block: {type: 'tool-call', id, name, arguments: argumentsString}};
    } else {
      const text = 'RELEASE_FIXTURE_ACK';
      yield {type: 'block-start', index: 0, blockType: 'text'};
      yield {type: 'text-delta', index: 0, text};
      yield {type: 'block-end', index: 0, block: {type: 'text', text}};
    }
    yield {type: 'usage', usage: {inputTokens: 1, outputTokens: 1}};
    yield {type: 'finish', reason: {kind: call ? 'tool-calls' : 'stop'}};
  }
}

export function apply(ctx) {
  const root = process.env.RELEASE_CHECK_ROOT, stage = process.env.RELEASE_CHECK_STAGE;
  const save = (name, data) => writeFile(join(root, name), JSON.stringify(data, null, 2) + '\n');
  const captures=[], assertions=[],providerStats={fixtureRequests:0,blockedExternalAttempts:0};
  const checked=(id,name,details={})=>assertions.push({id,name,status:'PASS',evidence:'REAL_DSH_FIXTURE',...details});
  ctx.llm.registerAdapter(['release-fixture'], new ReleaseFixture());
  ctx.on('llm/stream', (options, next) => {
    if(options.provider==='release-fixture')providerStats.fixtureRequests++;else providerStats.blockedExternalAttempts++;
    assert.equal(options.provider, 'release-fixture', 'Paid model calls are forbidden');
    const serialized=JSON.stringify(options);const users=options.messages.filter(m=>m.role==='user'&&['user','agent-message'].includes(m.source?.kind));const last=users.at(-1);
    const stateEvents=ctx.agents.get(options.sessionId)?.session.snapshotEvents()??[];
    captures.push({sessionSnapshot:{turn:stateEvents.findLast(e=>e.type==='turn/start')?.data.turn??null,lastMessageId:stateEvents.findLast(e=>e.type==='user/message')?.data.id??null,eventCount:stateEvents.length},provider:options.provider,model:options.model??null,lastMessageId:last?.id??null,lastSourceKind:last?.source?.kind??null,lastText:(last?.content??[]).filter(c=>c.type==='text').map(c=>c.text).join('\n'),packetCount:(serialized.match(/Project Memory Packet/g)??[]).length,containsCritical:serialized.includes('MEM03_CRITICAL_KEEP'),containsCurrentB:serialized.includes('采用 B，放弃 A。'),serialized});
    return next();
  }, {prepend: true});
  const wait = async fn => {
    const deadline = Date.now() + 30000;
    while (Date.now() < deadline) {
      const value = await fn(); if (value) return value;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Timed out in release Host probe');
  };
  const send=async(s,p,text)=>{await s.activate(p.projectId);await s.sendLocal({projectId:p.projectId,text,messageId:randomUUID()});await ctx.agents.get(p.coordinatorSessionId).whenIdle();};
  async function mem03Suite(s,p,old){
    const id=p.projectId,write=(input)=>s.memoryWrite({projectId:id,expectedRevision:0,reason:'Owned MEM03 synthetic fixture',...input});
    let q=await s.state(id);
    if(!q.memoryEntries.some(e=>e.logicalPath==='brief.md'))await write({name:'brief.md',logicalPath:'brief.md',kind:'brief',topicKey:'brief',content:'MEM03_CRITICAL_KEEP',operationId:'critical-brief'});
    const initial=await write({name:'decisions/storage-a.md',logicalPath:'decisions/storage-a.md',kind:'decision',topicKey:'storage',content:'采用 A。',operationId:'initial-storage-a'});
    await send(s,p,'采用 B，放弃 A。 MEM03_DECISION supersedes='+initial.entryId+' revision='+initial.revision);
    q=await s.state(id);const current=q.memoryEntries.find(e=>e.kind==='decision'&&e.topicKey==='storage'&&e.status==='active');
    assert(current,'Actual model tool call must create an active decision');assert.equal(current.content,'采用 B，放弃 A。');assert.equal(current.origin,'user_instruction');assert.equal(current.sourceRefs[0].kind,'user-message');assert.equal(current.sourceRefs[0].verified,true);
    assert(q.memoryEntries.some(e=>e.entryId===initial.entryId&&e.status==='superseded'));checked('MEM03-07','Actual current human decision source/quote verified without remember keyword');checked('MEM03-08','Actual Host atomic same-topic replacement retains old record as history');
    await send(s,p,'如果采用 C，会更好吗？ MEM03_CANDIDATE');q=await s.state(id);const candidate=q.memoryEntries.find(e=>e.logicalPath==='decisions/candidate.md');assert(candidate);assert.equal(candidate.status,'candidate');checked('MEM03-07','Hypothetical question cannot activate a formal user decision');
    for(const fixture of handoffIntents){await send(s,p,fixture.text);q=await s.state(id);const entry=q.memoryEntries.find(e=>e.logicalPath==='decisions/handoff-'+fixture.id+'.md');assert(entry,'Actual tool call must save '+fixture.id);assert.equal(entry.status,fixture.status);assert.equal(entry.sourceRefs[0].exactQuote,fixture.quote);assert.equal(entry.sourceRefs[0].verified,true);assert.equal(entry.origin,fixture.status==='active'?'user_instruction':'model_observation');checked('MEM03-07','Actual handoff '+fixture.id+' preserves human intent and exact source',{fixture:fixture.id,recordStatus:entry.status,kind:entry.kind});}
    let first;for(let i=0;i<55;i++){const result=await write({name:'decisions/number-'+i+'.md',logicalPath:'decisions/number-'+i+'.md',kind:'decision',topicKey:'number-'+i,content:'常规合成记忆 '+i,operationId:'number-'+i});first??=result;}
    await write({entryId:first.entryId,name:'decisions/number-0.md',logicalPath:'decisions/number-0.md',kind:'decision',topicKey:'number-0',content:'第一个记录更新后使用 atomicSaveCheckpointMEM03。',expectedRevision:1,operationId:'number-update'});
    const query=await s.memorySearch({projectId:id,query:'atomicSaveCheckpointMEM03'});assert(query.current.some(hit=>hit.source.entryId===first.entryId&&hit.source.version===2));checked('MEM03-10','55-plus current records: first updated entry retrieved through actual service');
    const index=await s.memoryFileRead({projectId:id,logicalPath:'MEMORY.md'});assert(index.content.includes('自动生成的索引'));
    await s.memoryIndexWrite({projectId:id,description:'MEM03 隔离验证的项目索引。',pinnedEntryIds:[current.entryId],expectedRevision:index.revision,operationId:'index-meta'});
    const updatedIndex=await s.memoryFileRead({projectId:id,logicalPath:'MEMORY.md'});assert(updatedIndex.content.includes('MEM03 隔离验证的项目索引。'));assert(updatedIndex.content.includes('decisions/storage-b.md'));assert.equal((await s.memoryFileRead({projectId:id,logicalPath:'decisions/number-0.md'})).content,'第一个记录更新后使用 atomicSaveCheckpointMEM03。');
    const exported=await s.memoryExport({projectId:id});assert(exported.files.some(f=>f.logicalPath==='MEMORY.md'&&f.content));assert(exported.entries.length>=59);checked('MEM03-06','Actual logical file/index writes and private memory export share canonical data');
    await send(s,p,'MEM03_PACKET_QUERY atomicSaveCheckpointMEM03');assert(captures.some(c=>c.lastText==='MEM03_PACKET_QUERY atomicSaveCheckpointMEM03'&&c.packetCount===1&&c.containsCritical&&c.containsCurrentB));checked('MEM03-17','Actual provider receives one bounded current Packet with critical and related memory');
    q=await s.state(id);const previousLinks=new Set(q.links.map(l=>l.threadId)),previousReports=q.reports.length;
    await send(s,p,'MEM03_DISPATCH');q=await wait(async()=>{const next=await s.state(id);return next.links.some(l=>!previousLinks.has(l.threadId))&&next.reports.length>previousReports&&next.reports.every(r=>r.delivery==='integrated')&&next;});
    const link=q.links.find(l=>!previousLinks.has(l.threadId)),thread=ctx.agents.get(link.threadSessionId);assert(thread);
    thread.followup({id:randomUUID(),role:'user',source:{kind:'user'},content:[{type:'text',text:'MEM03_DIRECT atomicSaveCheckpointMEM03'}]});await thread.whenIdle();
    await send(s,p,'RELEASE_CONTINUE thread='+link.threadId);await wait(async()=>{const next=await s.state(id);return next.reports.length>=previousReports+3&&next.reports.every(r=>r.delivery==='integrated')&&next;});
    for(const [label,pattern]of [['coordinator',/^MEM03_DISPATCH$/],['new-thread',/MEM03_WORKER/],['thread-user',/^MEM03_DIRECT/],['continued-thread',/^RELEASE_WORKER_CONTINUE$/]]){const proof=captures.find(c=>pattern.test(c.lastText)&&c.packetCount===1&&c.containsCritical&&c.containsCurrentB);assert(proof,'Actual provider lacks current single Packet for '+label);checked('MEM03-16','Actual '+label+' trigger receives current Packet',{sourceKind:proof.lastSourceKind});}
    const forget=await write({name:'forget.md',logicalPath:'forget.md',kind:'decision',topicKey:'forget',content:'MEM03_FORGET_SECRET_982',operationId:'forgotten'});
    await send(s,p,'请忘记这条记忆。 MEM03_FORGET entry='+forget.entryId+' revision='+forget.revision);
    const forgotten=await s.memorySearch({projectId:id,query:'MEM03_FORGET_SECRET_982',includeHistory:true});assert.equal(forgotten.current.length,0);assert.equal(forgotten.history.length,0);await assert.rejects(async()=>s.memoryFileRead({projectId:id,logicalPath:'forget.md'}),{code:'MEMORY_REMOVED'});
    const used=(await s.state(id)).memoryUsedPackets;assert(!JSON.stringify(used).includes('MEM03_FORGET_SECRET_982'));checked('MEM03-19','Actual forgetting removes future reads/search and Used metadata contains no forgotten body');
    const source=await s.libraryImportStream({projectId:id,name:'mem03-evidence.md',operationId:'evidence-library'},[Buffer.from('MEM03_SOURCE_STAYS 版本一')]);
    let evidence=await s.memorySearch({projectId:id,query:'MEM03_SOURCE_STAYS'});assert(evidence.evidence.some(e=>e.source.itemId===source.item.itemId));
    const oldRef=evidence.evidence.find(e=>e.source.itemId===source.item.itemId).source;
    const replaced=await s.libraryImportStream({projectId:id,name:'mem03-evidence.md',operationId:'evidence-replace',replaceItemId:source.item.itemId,expectedVersion:1},[Buffer.from('MEM03_SOURCE_STAYS 版本二 ReplaceNeedleMEM03')]);assert.equal(replaced.item.version,2);
    assert.equal((await s.memorySource({projectId:id,source:oldRef})).stale,true);evidence=await s.memorySearch({projectId:id,query:'ReplaceNeedleMEM03'});assert(evidence.evidence.some(e=>e.source.itemId===source.item.itemId&&e.source.version===2));
    await s.memorySettings({projectId:id,excludedLibraryItemIds:[source.item.itemId]});evidence=await s.memorySearch({projectId:id,query:'MEM03_SOURCE_STAYS'});assert(!evidence.evidence.some(e=>e.source.itemId===source.item.itemId));checked('MEM03-20','Actual Library Replace invalidates old reference; explicit exclusion blocks future evidence');
    q=await s.state(id);const workspace=q.bindings.find(b=>b.threadId===link.threadId)?.workspacePath;assert(workspace&&workspace.startsWith(root),'Only owned workspace fixture may be written');const file=join(workspace,'mem03-proof.md'),content='WorkspaceSourceMEM03 当前源码只读证据。\n';await writeFile(file,content);
    await s.evidenceIndex({projectId:id});evidence=await s.memorySearch({projectId:id,threadId:link.threadId,query:'WorkspaceSourceMEM03'});const code=evidence.evidence.find(e=>e.source.path==='mem03-proof.md');assert(code);assert.equal((await s.memorySource({projectId:id,threadId:link.threadId,source:code.source})).content,content);assert.equal(await readFile(file,'utf8'),content);checked('MEM03-12','Actual explicitly selected owned workspace source indexed and read without modifying it');
    await s.lifecycle({projectId:id,action:'pause'});await assert.rejects(async()=>s.memorySearch({projectId:id,query:'MEM03'}),{code:'PROJECT_INACTIVE'});await s.lifecycle({projectId:id,action:'resume'});checked('MEM03-23','Actual pause fences retrieval; resume preserves data');
    const ordinary=await ctx.agents.create({sessionId:randomUUID(),meta:{cwd:join(root,'launch')},agentOptions:{provider:'release-fixture',model:'scripted'}});ordinary.agent.followup({id:randomUUID(),role:'user',source:{kind:'user'},content:[{type:'text',text:'MEM03_ORDINARY'}]});await ordinary.agent.whenIdle();const ordinaryCapture=captures.find(c=>c.lastText==='MEM03_ORDINARY');assert(ordinaryCapture);assert.equal(ordinaryCapture.packetCount,0);await ordinary.dispose();checked('MEM03-04','Actual ordinary non-Project session has no Project memory injection');
    assert.equal(providerStats.blockedExternalAttempts,0);assert(captures.every(c=>c.provider==='release-fixture'));checked('MEM03-03','All actual provider requests use scripted local fixture',{fixtureRequests:captures.length,externalRequests:0});
    q=await s.state(id);await ctx.sessionPersistence.flush();await save('durable.json',{projectId:id,threadSessionId:old.threadSessionId,runs:q.runs.length,librarySHA256:q.libraryItems[0].sha256,memoryCount:q.memoryEntries.length,linkSessionIds:q.links.map(l=>l.threadSessionId),currentEntryId:current.entryId,firstEntryId:first.entryId});
  }
  ctx.effect(() => {
    const timer = setTimeout(async () => {
      try {
        const bundles = await ctx.pluginManager.listBundles();
        const bundle = bundles.find(b => b.name === 'dsh-project-threads-wave1-spike');
        if (stage === 'disabled' || stage === 'uninstalled') {
          if (stage === 'disabled') await ctx.pluginManager.setBundleEnabled('dsh-project-threads-wave1-spike', false);
          if (stage === 'uninstalled') assert(!bundle?.installed);
          await wait(() => !ctx.get('projectThreads'));
          const handle = await ctx.agents.create({sessionId: randomUUID(), meta: {cwd: join(root, 'launch')},
            agentOptions: {provider: 'release-fixture', model: 'scripted'}});
          assert(handle.agent.id);
          handle.agent.followup({id: randomUUID(), role: 'user', source: {kind: 'user'}, content: [{type: 'text', text: 'RELEASE_ORDINARY'}]});
          await handle.agent.whenIdle();
          assert(handle.agent.session.snapshotEvents().some(e => e.type === 'assistant/message'));
          await handle.dispose();
          await save('provider-'+stage+'.json',{externalRequests:0,...providerStats,captures});
          await save(stage + '.json', {status: 'PASS', pluginAbsent: true, ordinarySessionCreated: true, paidRequests: 0,externalRequests:0,fixtureRequests:captures.length});
          return;
        }
        await ctx.pluginManager.setBundleEnabled('dsh-project-threads-wave1-spike', true);
        const service = await wait(() => ctx.get('projectThreads'));
        const s = service.projects;
        assert(Object.keys(process.env).filter(k=>k.startsWith('DSH_PROJECT_THREADS_')).every(k=>k==='DSH_PROJECT_THREADS_LEGACY_MIGRATION_APPROVED'));
        assert(process.env.DSH_HOME.startsWith(root));
        if (stage === 'cold' || stage === 'reenabled' || stage === 'upgraded') {
          const old = JSON.parse(await readFile(join(root, 'durable.json'), 'utf8'));
          const q = await s.state(old.projectId);
          assert.equal(q.links.length,old.linkSessionIds?.length??1);assert(q.links.some(l=>l.threadSessionId===old.threadSessionId));if(old.linkSessionIds)assert.deepEqual(q.links.map(l=>l.threadSessionId).sort(),old.linkSessionIds.slice().sort());
          assert.equal(q.runs.length, old.runs); assert.equal(q.memoryEntries.length,old.memoryCount??1);
          assert.equal(q.libraryItems[0].sha256, old.librarySHA256);
          assert((await s.libraryRead({projectId: old.projectId, itemId: q.libraryItems[0].itemId})).text.includes('DOCX-4821'));
          checked('MEM03-05','Cold/upgrade preserves Project, Session, memory and Library identity');
          if(typeof s.memorySearch==='function'){if(stage==='upgraded')await mem03Suite(s,q.selectedProject,old);else{await send(s,q.selectedProject,'MEM03_COLD_PACKET');assert(captures.some(c=>c.packetCount===1));checked('MEM03-16','Cold-restored actual provider receives one current Packet');}}
          await save('provider-'+stage+'.json',{externalRequests:0,...providerStats,captures});
          await save(stage + '.json', {status: 'PASS', sameProjectThreadAndMemory: true, noTaskReplay: true, actualDocumentRead: true, paidRequests: 0,externalRequests:0,fixtureRequests:captures.length,assertions});
          return;
        }
        const model = {provider: 'release-fixture', model: 'scripted'};
        const p = await s.create({name: 'Isolated release check', coordinatorModel: model, threadModel: model});
        await s.activate(p.projectId);
        if(typeof s.memorySearch==='function')await s.memoryWrite({projectId:p.projectId,name:'brief.md',logicalPath:'brief.md',kind:'brief',topicKey:'brief',content:'MEM03_CRITICAL_KEEP',expectedRevision:0,reason:'Synthetic Packet trigger proof',operationId:'critical-brief'});
        await s.sendLocal({projectId: p.projectId, text: 'RELEASE_DISPATCH', messageId: randomUUID()});
        await ctx.agents.get(p.coordinatorSessionId).whenIdle();
        await save('dispatch-events.json', ctx.agents.get(p.coordinatorSessionId).session.snapshotEvents());
        let q = await wait(async () => {const q = await s.state(p.projectId); return q.executionRequests.length && q;});
        let request = q.executionRequests[0];
        await s.managedFolder({projectId: p.projectId, requestId: request.requestId, revision: request.revision});
        q = await s.state(p.projectId); request = q.executionRequests[0];
        await s.confirm({projectId: p.projectId, requestId: request.requestId, revision: request.revision,
          confirmationToken: request.confirmationToken, grantScope: 'project'});
        const integrated = count => wait(async () => {const q = await s.state(p.projectId);
          return q.reports.length >= count && q.reports.every(r => r.delivery === 'integrated') && q;});
        q = await integrated(1);
        const link = q.links[0], threadSessionId = link.threadSessionId;
        const inspected = await s.inspect({projectId: p.projectId, threadId: link.threadId});
        assert(inspected);
        const agent = ctx.agents.get(threadSessionId); assert(agent);
        const eventCount = agent.session.snapshotEvents().length;
        agent.followup({id: randomUUID(), role: 'user', source: {kind: 'user'}, content: [{type: 'text', text: 'RELEASE_DIRECT_CONTINUE'}]});
        await agent.whenIdle(); assert(agent.session.snapshotEvents().length > eventCount);
        q = await integrated(2);
        await s.sendLocal({projectId: p.projectId, text: 'RELEASE_CONTINUE thread=' + link.threadId, messageId: randomUUID()});
        q = await integrated(3);
        assert.equal(q.links.length, 1); assert.equal(q.links[0].threadSessionId, threadSessionId);
        assert(q.runs.every(r => r.errors.length === 0));
        await s.memoryWrite({projectId: p.projectId, name: 'Fixture memory', content: 'Synthetic release note',
          expectedRevision: 0, reason: 'Owned offline fixture', operationId: 'release-memory'});
        const bytes = await readFile(new URL('../../tests/fixtures/readers/known.docx', import.meta.url));
        await s.libraryImportStream({projectId: p.projectId, name: 'known.docx', operationId: 'release-library'}, [bytes]);
        q = await s.state(p.projectId);
        assert((await s.libraryRead({projectId: p.projectId, itemId: q.libraryItems[0].itemId})).text.includes('DOCX-4821'));
        await ctx.sessionPersistence.flush();
        await save('durable.json', {projectId:p.projectId,threadSessionId,runs:q.runs.length,librarySHA256:q.libraryItems[0].sha256,memoryCount:q.memoryEntries.length,linkSessionIds:q.links.map(l=>l.threadSessionId)});
        if(typeof s.memorySearch==='function')await mem03Suite(s,p,{threadSessionId});
        await save('provider-'+stage+'.json',{externalRequests:0,...providerStats,captures});
        await save(stage + '.json', {status: 'PASS', normalPluginDefaults: true, projectCreated: true, independentThread: true,
          hostInspection: true, directThreadContinue: true, coordinatorContinueSameSession: true,
          memoryAndActualDocumentRead: true, paidRequests: 0,externalRequests:0,fixtureRequests:captures.length,assertions,guiClaim:false});
      } catch (error) {await save('provider-'+stage+'.json',{externalRequests:0,...providerStats,captures});await save(stage+'-failed.json',{error:error.stack,assertions,fixtureRequests:captures.length,externalRequests:0});}
    }, 600);
    return () => clearTimeout(timer);
  });
}
