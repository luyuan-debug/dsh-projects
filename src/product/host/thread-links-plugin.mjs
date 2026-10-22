import {Readable} from 'node:stream';
import {mkdir} from 'node:fs/promises';
import {pluginEnvironment} from './managed-environment.mjs';
import { acquireProfileLease } from '../backends/local/profile-lease.mjs';
import { resolveDshHome } from '@deepseek-ai/dsh-home-paths';
import { randomUUID } from 'node:crypto';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { appendPluginRecord } from '@deepseek-ai/dsh-session';
import { AgentOwnerRuntime } from './agent-owner-runtime.mjs';
import { HostLifecycle } from './host-lifecycle.mjs';
import { executeCommand } from './command-admission.mjs';
import { canonicalPath, createFixtureRoot, isWithin, profileDomainName, resolveEnvironment } from './environment.mjs';
import { AssociationError, ThreadAssociations, publicLink } from '../domain/thread-associations.mjs';
import { openAssociationDomain } from '../backends/local/domain-store.mjs';
import { LINK_RECORD, isHumanUserEvent } from '../protocol/thread-card.mjs';
import { installProjects } from './projects-runtime.mjs';
import { validateProjectRequest } from '../protocol/request-policy.mjs';

export const name = 'project-thread-associations';
export const inject = ['agents', 'sessionPersistence', 'storageDomain', 'storage', 'connection', 'workspaceRegistry','llm','tools','systemPrompt','sessionProjections','agentPresets','sandbox'];
export const API_PATH = '/api/project-threads';

export async function apply(ctx, config = {}) {
  const packageRoot = dirname(dirname(dirname(dirname(fileURLToPath(import.meta.url)))));
  const actualProfile = ctx.get('profileContext')?.name;
  const actualHome=await canonicalPath(resolveDshHome());
  config=pluginEnvironment(config,{profile:actualProfile,dshHome:actualHome});
  if (!actualProfile || config.profile !== actualProfile) throw new Error('Explicit configured profile must match the actual DSH profile');
  if (await canonicalPath(resolveDshHome()) !== await canonicalPath(config.dshHome)) throw new Error('Configured DSH data home must match this Host runtime');
  const environment = await resolveEnvironment({ ...config, sourceRoots: [packageRoot, ...(config.sourceRoots ?? [])] });
  for(const path of [environment.allowedRoot,environment.fixturesRoot,environment.evidenceRoot,environment.launchCwd])await mkdir(path,{recursive:true,mode:0o700});
  const namespace = profileDomainName(actualProfile);
  const lease=await acquireProfileLease(ctx,namespace);let leaseOwned=false;ctx.effect(()=>async()=>{if(!leaseOwned)await lease.release();});
  const domain = await openAssociationDomain(ctx.storageDomain, namespace);
  const scopes = domain.table('scopes'); const table = domain.table('links');
  const threadOwners = new AgentOwnerRuntime({ agents: ctx.agents, persistence: ctx.sessionPersistence });
  const coordinatorOwners = new AgentOwnerRuntime({ agents: ctx.agents, persistence: ctx.sessionPersistence });
  let associations, projects; let lifecycleState = 'open';
  const lifecycle = new HostLifecycle({
    runtime: { async dispose() {
      const errors=[];projects?.quiesce();
      for(const close of [()=>threadOwners.dispose(),()=>coordinatorOwners.dispose(),()=>projects?.close(),()=>associations?.close()]){
        try{await close()}catch(error){errors.push(error);ctx.logger.error('Project resource close failed: '+String(error.stack??error));}
      }
      if(errors.length)throw new AggregateError(errors,'Project resources closed with errors');
    } }, store: domain,
  });
  // HostLifecycle expects a closeable store, and domain.close is the public durable-drain operation.
  ctx.effect(() => async () => {
    lifecycleState = 'closing';
    projects?.quiesce(); // Cancel picker/turn admission before waiting for active HTTP operations.
    try { await lifecycle.dispose(); lifecycleState = 'closed'; }
    catch (error) { lifecycleState = 'failed'; throw error; }
    finally { await lease.release(); }
  });
  lease.onLost(error=>{projects?.quiesce();lifecycleState='failed';ctx.logger.error(error.code);void lifecycle.dispose().catch(e=>ctx.logger.error(String(e)));});
  leaseOwned=true;
  const roots = () => [...scopes.entries()].map(([, s]) => s.cwd).concat(projects?[...projects.workspace.tables.bindings.entries()].map(([,b])=>b.workspacePath):[]);
  const fixtureOptions = excluding => ({ allowedRoot: environment.allowedRoot, sourceRoots: environment.sourceRoots, dshHome: environment.dshHome, otherRoots: roots().filter(root => root !== excluding) });
  const requireRootHeader = (header, id, cwd) => {
    if (header.id !== id || header.cwd !== cwd || header.origin != null || header.parentSession != null || (header.delegationDepth ?? 0) !== 0) throw new AssociationError('ROOT_IDENTITY_MISMATCH', 'Expected the persisted independent root Session and original workspace');
  };
  async function durableEvents(sessionId) {
    await ctx.sessionPersistence.flush();
    const handle = await ctx.sessionPersistence.open(sessionId, 'read');
    try { return (await handle.read()).events; } finally { await handle.close(); }
  }
  async function coordinator(scope) {
    lease.assert();
    if (!isWithin(environment.fixturesRoot, await canonicalPath(scope.cwd))) throw new AssociationError('SCOPE_WORKSPACE_OUTSIDE_FIXTURES', 'Stored Coordinator workspace is outside the configured fixture root');
    await createFixtureRoot(scope.cwd, fixtureOptions(scope.cwd));
    const saved = await ctx.sessionPersistence.stat(scope.coordinatorSessionId);
    if (scope.ready && !saved) throw new AssociationError('COORDINATOR_MISSING', 'A persisted Coordinator is missing; no replacement ID was created');
    if (saved) requireRootHeader(saved.header, scope.coordinatorSessionId, scope.cwd);
    const agent = await coordinatorOwners.ensure({ sessionId: scope.coordinatorSessionId, cwd: scope.cwd,preset:projects?.preset('coordinator'), agentOptions: projects?.optionsForCoordinator(scope)??config.agentOptions,setup:(agentCtx,a)=>projects?.setup(agentCtx,a,'coordinator') });
    requireRootHeader(agent.session.header, scope.coordinatorSessionId, scope.cwd);
    await ctx.sessionPersistence.flush();
    const workspace = await ctx.workspaceRegistry.create(scope.cwd, scope.title);
    await workspace.attachSession(scope.coordinatorSessionId);
    if(!scope.ready)await scopes.put(scope.projectId,{...scope,ready:true});
    return agent;
  }
  const sessions = {
    async requireUserMessage(scope, messageId) {
      await coordinator(scope);
      const event = (await durableEvents(scope.coordinatorSessionId)).find(e => isHumanUserEvent(e) && e.data.id === messageId);
      if (!event) throw new AssociationError('MESSAGE_NOT_PERSISTED', 'The addressed original user message is not in durable Coordinator history');
      return { seq: event.seq };
    },
    async ensureThread(record, { allowCreate }) {
      lease.assert();
      const binding=await projects.workspace.control.admit(record.threadSessionId);
      const cwd=binding.workspacePath;
      const saved = await ctx.sessionPersistence.stat(record.threadSessionId);
      if (!saved && !allowCreate) throw new AssociationError('THREAD_SESSION_MISSING', 'Existing association has no durable Thread; it will not be silently recreated');
      if (saved) requireRootHeader(saved.header, record.threadSessionId, cwd);
      const snapshot=projects?await projects.threadSnapshot(record):null;
      const agent = await threadOwners.ensure({ sessionId: record.threadSessionId, cwd,preset:projects?.preset('thread'), agentOptions: snapshot?.model??config.agentOptions,setup:(agentCtx,a)=>projects?.setup(agentCtx,a,'thread',record) });
      requireRootHeader(agent.session.header, record.threadSessionId, cwd);
      await ctx.sessionPersistence.flush();
      const workspace = await ctx.workspaceRegistry.create(cwd, record.title);
      await workspace.attachSession(record.threadSessionId);
      return agent;
    },
    mayRecover: record=>(projects.registry.get(record.projectId).lifecycle??'active')==='active'&&projects.workspace.mayRecover(record),
    releaseThread: id => threadOwners.release(id),
    async publish(record) {
      const scope = scopes.get(record.projectId);
      if (!scope || scope.coordinatorSessionId !== record.coordinatorSessionId) throw new AssociationError('SCOPE_MISMATCH', 'Association Coordinator does not match its registered scope');
      const agent = await coordinator(scope);
      const events = await durableEvents(scope.coordinatorSessionId);
      const message = events.find(e => isHumanUserEvent(e) && e.data.id === record.messageId && e.seq === record.messageSeq);
      if (!message) throw new AssociationError('MESSAGE_NOT_PERSISTED', 'Cannot publish a card without its original persisted user message');
      const delivered = events.some(e => e.type === LINK_RECORD && e.ignorable === true && e.data?.association?.threadId === record.threadId && e.data.association.version >= record.version);
      if (!delivered) {
        appendPluginRecord(agent.session, LINK_RECORD, { association: publicLink(record) });
        await ctx.sessionPersistence.flush();
      }
    },
  };
  associations = new ThreadAssociations({ table, scopes, sessions });
  async function createScope(title,{defer=false}={}) {
    const scope={projectId:randomUUID(),coordinatorSessionId:randomUUID(),title,cwd:'',createdAt:Date.now(),ready:false};
    scope.cwd=join(environment.fixturesRoot,'coordinator-'+scope.coordinatorSessionId);
    await scopes.put(scope.projectId,scope);
    if(!defer){await coordinator(scope);await ctx.sessionPersistence.flush();}
    return scopes.get(scope.projectId);
  }
  projects=await installProjects({ctx,config,namespace,scopes,links:table,associations,coordinator,threadOwners,coordinatorOwners,createScope,environment,threadAgent:(record,options)=>sessions.ensureThread(record,options)});
  await projects.prepareRecovery();
  for (const [, scope] of scopes.entries()) if (scope.ready&&!scope.deleted&&!['deleting','deleted'].includes(projects.registry.get(scope.projectId).lifecycle)) await coordinator(scope);
  await associations.recover();
  await projects.recover();
  const service = {
    environment, namespace,
    async bootstrap({ title = 'MAC-01 测试对话' } = {}) {
      if (!config.developmentEntry) throw new AssociationError('DEVELOPMENT_ENTRY_DISABLED', 'Manual development scope creation is disabled');
      if (typeof title !== 'string' || !title.trim() || title.length > 200) throw new AssociationError('INVALID_REQUEST', 'A bounded scope title is required');
      const p=await projects.public.create({name:title,coordinatorModel:config.agentOptions?.provider?config.agentOptions:null,threadModel:config.agentOptions?.provider?config.agentOptions:null});
      return scopes.get(p.projectId);
    },
    create: request => associations.create(request),
    update: request => associations.update(request),
    async state(projectId) {
      const ready = [...scopes.entries()].map(([, s]) => s).filter(s => s.ready);
      const selected = projectId ? ready.find(s => s.projectId === projectId) : undefined;
      const messages = selected ? (await durableEvents(selected.coordinatorSessionId)).filter(isHumanUserEvent).map(e => ({ id: e.data.id, seq: e.seq, text: (e.data.content ?? []).filter(c => c.type === 'text').map(c => c.text).join(' ').slice(0,300) })) : [];
      return { developmentEntry: Boolean(config.developmentEntry), scopes: ready, selected: selected ?? null, messages, links: selected ? associations.list(selected.projectId) : [], pending: selected ? associations.pending(selected.projectId) : [], archiveDeleteSemantics: 'PROJECT_DATA_DELETE_WITH_RETAINED_ARCHIVED_HOST_SESSIONS' };
    },
    async reconcile() { await associations.recover(); return { recovered: true }; },
    get ownerState() { return { threadSessionIds: threadOwners.liveSessionIds, coordinatorSessionIds: coordinatorOwners.liveSessionIds, threadState: threadOwners.state, coordinatorState: coordinatorOwners.state, lifecycleState, ...projects?.shutdownDiagnostics() }; },
  };
  lease.assert();
  ctx.provide('projectThreads', {
    projects:projects.public,
    workspaces:projects.workspace.control,
    namespace, environment,
    bootstrap: input => executeCommand(lifecycle, () => service.bootstrap(input)),
    create: input => executeCommand(lifecycle, () => service.create(input)),
    update: input => executeCommand(lifecycle, () => service.update(input)),
    state: projectId => executeCommand(lifecycle, () => service.state(projectId)),
    reconcile: () => executeCommand(lifecycle, () => service.reconcile()),
    inspect: () => service.ownerState,
  });
  ctx.effect(()=>ctx.connection.fetch.register({path:API_PATH+'/library/upload',methods:['POST'],requestBody:'streaming',async fetch(request){
    try{return await executeCommand(lifecycle,async()=>{validateProjectRequest(request,'application/octet-stream');const input=Object.fromEntries(new URL(request.url).searchParams);if(input.expectedVersion!==undefined)input.expectedVersion=Number(input.expectedVersion);const value=await projects.public.libraryImportStream(input,request.body,request.signal);return Response.json({ok:true,value});});}
    catch(error){return Response.json({ok:false,error:{code:String(error.code??'LIBRARY_FAILED'),message:typeof error.code==='string'?error.message:'Library import failed; check Host diagnostics'}},{status:400})}
  }}));
  // The Host streaming mode supplies a request body, which GET cannot carry. Download requests remain buffered; response bytes still stream.
  ctx.effect(()=>ctx.connection.fetch.register({path:API_PATH+'/library/preview',methods:['GET'],requestBody:'buffered',async fetch(request){
    try{return await executeCommand(lifecycle,async()=>{const input=Object.fromEntries(new URL(request.url).searchParams);for(const key of ['expectedVersion','start','end'])if(input[key]!==undefined)input[key]=Number(input[key]);const {bytes}=await projects.public.libraryPreview(input);return new Response(bytes,{headers:{'content-type':'image/png','x-content-type-options':'nosniff','cache-control':'no-store','content-security-policy':"default-src 'none'; sandbox"}});});}catch(error){return Response.json({ok:false,error:{code:error.code??'PREVIEW_FAILED',message:error.message}},{status:400})}
  }}));
  ctx.effect(()=>ctx.connection.fetch.register({path:API_PATH+'/library',methods:['GET'],requestBody:'buffered',async fetch(request){
    try{return await executeCommand(lifecycle,async()=>{const input=Object.fromEntries(new URL(request.url).searchParams),{item,stream}=projects.public.libraryDownload(input);return new Response(Readable.toWeb(Readable.from(stream)),{headers:{'content-type':'application/octet-stream','content-length':String(item.size),'content-disposition':"attachment; filename*=UTF-8''"+encodeURIComponent(item.name.split('/').at(-1)),'x-content-type-options':'nosniff','cache-control':'no-store','content-security-policy':"default-src 'none'; sandbox"}});});}
    catch(error){return Response.json({ok:false,error:{code:String(error.code??'LIBRARY_FAILED'),message:typeof error.code==='string'?error.message:'Library download failed; check Host diagnostics'}},{status:400})}
  }}));
  ctx.effect(() => ctx.connection.fetch.register({
    path: API_PATH, methods: ['GET','POST'], requestBody: 'buffered',
    async fetch(request) {
      try {
        const result = await executeCommand(lifecycle, async () => {
          if (request.method === 'GET') {
            const projectId=new URL(request.url).searchParams.get('projectId');
            return {...await service.state(projectId),...await projects.public.state(projectId)};
          }
          try{validateProjectRequest(request)}catch(error){throw new AssociationError(error.message,'Same-origin application/json Project operation required');}
          const raw = await request.text(); if (raw.length > 65536) throw new AssociationError('INVALID_REQUEST', 'Request is too large');
          const body = JSON.parse(raw);
          const operations={'project.lifecycle':input=>projects.public.lifecycle(input),'memory.write':input=>projects.public.memoryWrite(input),'memory.delete':input=>projects.public.memoryDelete(input),'memory.read':input=>projects.public.memoryRead(input),'library.read':input=>projects.public.libraryRead(input),'library.delete':input=>projects.public.libraryDelete(input),'project.sendLocal':input=>projects.public.sendLocal(input,'authenticated-owner-ui'),'workspace.managed':input=>projects.public.managedFolder(input),'workspace.pick':()=>projects.public.pickFolder(),'workspace.choose':input=>projects.public.choose(input),'workspace.confirm':input=>projects.public.confirm(input,'authenticated-owner-ui'),'workspace.decide':input=>projects.public.decide(input),'workspace.revoke':input=>projects.public.revoke(input),'workspace.disconnect':input=>projects.public.disconnect(input),'project.activate':input=>projects.public.activate(input.projectId),'project.create':input=>projects.public.create(input),'project.update':input=>projects.public.update(input),'project.models':input=>projects.public.models(input.provider),'project.restart':input=>projects.public.restart(input.projectId),'coordinator.stop':input=>projects.public.stopCoordinator(input.projectId),'thread.stop':input=>projects.public.stop(input),'proposal.start':input=>projects.public.start(input),'report.retry':input=>projects.public.retryReport(input)};
          if(operations[body.op])return operations[body.op](body.input??{});
          if(!config.developmentEntry)throw new AssociationError('DEVELOPMENT_ENTRY_DISABLED','Manual test operations are disabled');
          if (body.op === 'bootstrap') return service.bootstrap(body.input);
          if (body.op === 'create') return service.create(body.input ?? {});
          if (body.op === 'update') return service.update(body.input ?? {});
          if (body.op === 'reconcile') return service.reconcile();
          throw new AssociationError('INVALID_REQUEST', 'Unknown association operation');
        });
        return Response.json({ ok: true, value: result });
      } catch (error) {
        ctx.logger.warn('project thread operation failed: ' + String(error.code ?? error.name));
        return Response.json({ ok: false, error: { code: String(error.code ?? 'OPERATION_FAILED'), message: error instanceof AssociationError||typeof error.code==='string'&&/^[A-Z][A-Z0-9_]+$/.test(error.code) ? error.message : 'Thread operation failed; see Host diagnostics' } }, { status: 400 });
      }
    },
  }));
}
