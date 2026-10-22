import { randomUUID, createHash } from 'node:crypto';
export const copy = value => structuredClone(value);
export function fail(code, message) { throw Object.assign(new Error(message), { code }); }
export function text(value, field, max=16000, empty=false) {
  if (typeof value !== 'string' || (!empty && !value.trim()) || value.length>max) fail('INVALID_REQUEST', 'Invalid '+field);
  return value;
}
export const stableKey = (...parts) => createHash('sha256').update(JSON.stringify(parts)).digest('hex');
export function modelConfig(value) {
  if (value == null) return null;
  const {provider,model,reasoningEffort}=value;
  text(provider,'provider',200);text(model,'model',200);
  if(reasoningEffort!==undefined)text(reasoningEffort,'reasoningEffort',80);
  return {provider,model,...reasoningEffort===undefined?{}:{reasoningEffort}};
}
export function projectGoal(value) {
  if(typeof value!=='string'||Array.from(value).length>32000)fail('GOAL_LIMIT','goal must contain at most 32000 Unicode code points');
  return value;
}
export function projectInstructions(value) {
  if(typeof value!=='string'||Array.from(value).length>16000)fail('INSTRUCTIONS_LIMIT','instructions must contain at most 16000 Unicode code points');
  return value;
}
/** Additive, resumable migration. The original links/scopes and free statuses are never rewritten. */
export async function migrateMac01(scopes, links, projects) {
  for(const [,s] of scopes.entries()) {
    if(!s.ready || projects.get(s.projectId))continue;
    const old=[...links.entries()].map(([,x])=>x).filter(x=>x.projectId===s.projectId);
    await projects.put(s.projectId,{schemaVersion:2,projectId:s.projectId,name:s.title,goal:'',instructions:'',settingsVersion:1,coordinatorSessionId:s.coordinatorSessionId,coordinatorGeneration:1,coordinatorModel:null,threadModel:null,executionMode:'local',contextRefs:[],threadIds:old.filter(x=>x.phase==='active').map(x=>x.threadId),createdAt:s.createdAt,updatedAt:s.createdAt,migration:{from:1,historicalStatuses:old.map(x=>({threadId:x.threadId,status:x.status}))}});
  }
}
export class Projects {
  constructor({table,createScope,validateModel,defaultModel=async()=>null}){Object.assign(this,{table,createScope,validateModel,defaultModel});this.locks=new Map();}
  get(id){const p=this.table.get(id);if(!p)fail('PROJECT_NOT_FOUND','Project not found');return copy(p);}
  list(){return [...this.table.entries()].map(([,x])=>copy(x));}
  async create(input){
    const name=text(input.name,'name',200),goal=projectGoal(input.goal??''),instructions=projectInstructions(input.instructions??'');
    const inherited=await this.defaultModel();
    const coordinatorModel=modelConfig(Object.hasOwn(input,'coordinatorModel')?input.coordinatorModel:inherited),threadModel=modelConfig(Object.hasOwn(input,'threadModel')?input.threadModel:inherited);
    for(const model of [coordinatorModel,threadModel])if(model)await this.validateModel(model);
    const scope=await this.createScope(name,{defer:true});
    const p={schemaVersion:4,lifecycle:'active',contextRevision:0,memoryIndexRevision:0,projectId:scope.projectId,name,goal,instructions,settingsVersion:1,coordinatorSessionId:scope.coordinatorSessionId,coordinatorGeneration:1,coordinatorModel,threadModel,executionMode:'local',contextRefs:[],threadIds:[],createdAt:Date.now(),updatedAt:Date.now()};
    await this.table.put(p.projectId,p);return copy(p);
  }
  serial(id,op){const result=(this.locks.get(id)??Promise.resolve()).then(op);const tail=result.then(()=>{},()=>{});this.locks.set(id,tail);void tail.then(()=>{if(this.locks.get(id)===tail)this.locks.delete(id)});return result;}
  update(id,input){return this.serial(id,async()=>{
    const p=this.get(id),next={...p};if(input.expectedSettingsVersion!==undefined&&input.expectedSettingsVersion!==p.settingsVersion)fail('STALE_PROJECT_SETTINGS','Project settings changed in another view; reopen before saving');
    if(Object.hasOwn(input,'name'))next.name=text(input.name,'name',200);
    if(Object.hasOwn(input,'goal'))next.goal=projectGoal(input.goal);
    if(Object.hasOwn(input,'instructions'))next.instructions=projectInstructions(input.instructions);
    if(Object.hasOwn(input,'toolPolicy'))next.toolPolicy=copy(input.toolPolicy);
    for(const f of ['coordinatorModel','threadModel'])if(Object.hasOwn(input,f)){next[f]=modelConfig(input[f]);if(next[f])await this.validateModel(next[f]);}
    next.settingsVersion++;next.updatedAt=Date.now();await this.table.put(id,next);return copy(next);
  });}
  register(id,threadId){return this.serial(id,async()=>{const p=this.get(id);if(!p.threadIds.includes(threadId)){p.threadIds.push(threadId);p.updatedAt=Date.now();await this.table.put(id,p)}return p;});}
  generation(id){return this.serial(id,async()=>{const p=this.get(id);p.coordinatorGeneration++;await this.table.put(id,p);return p;});}
}
export function authority({agent,registeredAgent,initiator,project,events,callId,requireHuman=true,requestedMessageId}) {
  if(agent!==registeredAgent||agent!==initiator||agent.id!==project.coordinatorSessionId||agent.status!=='running')fail('TOOL_AUTHORITY','Exact active Coordinator driver required');
  const start=events.findLastIndex(e=>e.type==='turn/start');
  if(start<0)fail('TOOL_AUTHORITY','An open turn is required');
  if(events.slice(start+1).some(e=>e.type==='turn/end'))fail('TOOL_AUTHORITY','Turn already closed');
  const candidates=events.slice(start+1).filter(e=>e.type==='user/message'&&e.data.source?.kind==='user');
  let human;if(requestedMessageId!==undefined){human=candidates.find(e=>e.data.id===requestedMessageId);if(!human)fail('HUMAN_MESSAGE_SCOPE','The selected origin is not a genuine human message in this live turn');}else if(candidates.length===1)human=candidates[0];else if(requireHuman&&candidates.length>1)fail('AMBIGUOUS_HUMAN_SOURCE','Choose originMessageId for the specific request: '+JSON.stringify(candidates.map(e=>({messageId:e.data.id,text:(e.data.content??[]).filter(c=>c.type==='text').map(c=>c.text).join(' ').slice(0,240)}))));
  if(requireHuman&&!human)fail('HUMAN_AUTHORITY_REQUIRED','Reports and output data cannot delegate work');
  text(callId,'callId',200);
  return {projectId:project.projectId,coordinatorSessionId:agent.id,generation:project.coordinatorGeneration,messageId:human?.data.id??null,dispatchId:stableKey(project.projectId,project.coordinatorGeneration,events[start].data.turn,callId)};
}
export function boundThread(links,projectId,threadId){const link=links.find(x=>x.projectId===projectId&&x.threadId===threadId);if(!link)fail('THREAD_SCOPE','Thread does not belong to this Project');return link;}
export function runState(reason,waiting,errors){if(waiting||errors?.length||reason?.kind!=='completed')return {activity:'Waiting on you',reason:waiting??(errors?.length?{kind:'tool-error',errors}:reason??'Unknown termination'),resolved:false,pr:null};return {activity:'Idle',reason:null,resolved:false,pr:null};}
