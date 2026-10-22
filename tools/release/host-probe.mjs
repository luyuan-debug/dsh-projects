import {writeFile, readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {LlmAdapter} = await import(process.env.RELEASE_LLM_MODULE);
export const inject = ['llm', 'pluginManager', 'agents', 'sessionPersistence'];

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
    if (last?.source?.kind === 'user' && !tail.some(m => m.role === 'tool')) {
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
  ctx.llm.registerAdapter(['release-fixture'], new ReleaseFixture());
  ctx.on('llm/stream', (options, next) => {
    assert.equal(options.provider, 'release-fixture', 'Paid model calls are forbidden');
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
          await save(stage + '.json', {status: 'PASS', pluginAbsent: true, ordinarySessionCreated: true, paidRequests: 0});
          return;
        }
        await ctx.pluginManager.setBundleEnabled('dsh-project-threads-wave1-spike', true);
        const service = await wait(() => ctx.get('projectThreads'));
        const s = service.projects;
        assert.equal(Object.keys(process.env).filter(k => k.startsWith('DSH_PROJECT_THREADS_')).length, 0);
        if (stage === 'cold' || stage === 'reenabled') {
          const old = JSON.parse(await readFile(join(root, 'durable.json'), 'utf8'));
          const q = await s.state(old.projectId);
          assert.equal(q.links.length, 1); assert.equal(q.links[0].threadSessionId, old.threadSessionId);
          assert.equal(q.runs.length, old.runs); assert.equal(q.memoryEntries.length, 1);
          assert.equal(q.libraryItems[0].sha256, old.librarySHA256);
          assert((await s.libraryRead({projectId: old.projectId, itemId: q.libraryItems[0].itemId})).text.includes('DOCX-4821'));
          await save(stage + '.json', {status: 'PASS', sameProjectThreadAndMemory: true, noTaskReplay: true, actualDocumentRead: true, paidRequests: 0});
          return;
        }
        const model = {provider: 'release-fixture', model: 'scripted'};
        const p = await s.create({name: 'Isolated release check', coordinatorModel: model, threadModel: model});
        await s.activate(p.projectId);
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
        await save('durable.json', {projectId: p.projectId, threadSessionId, runs: q.runs.length, librarySHA256: q.libraryItems[0].sha256});
        await save(stage + '.json', {status: 'PASS', normalPluginDefaults: true, projectCreated: true, independentThread: true,
          hostInspection: true, directThreadContinue: true, coordinatorContinueSameSession: true,
          memoryAndActualDocumentRead: true, paidRequests: 0, guiClaim: false});
      } catch (error) { await save(stage + '-failed.json', {error: error.stack}); }
    }, 600);
    return () => clearTimeout(timer);
  });
}
