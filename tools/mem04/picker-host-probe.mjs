// Owned test-only in-memory public capability substitution. No DSH core edits.
import {mkdir,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
const {LlmAdapter}=await import(process.env.RELEASE_LLM_MODULE);
export const inject=['llm','pluginManager','agents','sessionPersistence','connection'];
const PROVIDER='picker-fixture';
class PickerFixture extends LlmAdapter{
 providerInfo(provider){return {id:provider,name:'Directory selection protocol fixture'};}
 async listModels(provider){return [{provider,id:'scripted',name:'scripted',inputModalities:['text']}];}
 async resolveModel(provider,id){return {provider,id,name:id,context:{contextWindow:32000}};}
 async *stream(){yield {type:'block-start',index:0,blockType:'text'};yield {type:'text-delta',index:0,text:'Owned directory-picker fixture response.'};yield {type:'block-end',index:0,block:{type:'text',text:'Owned directory-picker fixture response.'}};yield {type:'usage',usage:{inputTokens:1,outputTokens:1}};yield {type:'finish',reason:{kind:'stop'}};}
}
export function apply(ctx){
 const root=process.env.RELEASE_CHECK_ROOT,backend=[],stats={fixtureRequests:0,blockedExternalAttempts:0},selected={a:join(root,'selected-a'),b:join(root,'selected-b')};let descriptorRecord,restore=()=>{};
 const save=(name,value)=>writeFile(join(root,name),JSON.stringify(value,null,2)+'\n');
 const snapshot=()=>({evidence:'REAL_DSH_HTTP_CONTROLLED_PICKER',backend:backend.map((job,index)=>({index,aborted:job.signal.aborted,settled:job.settled})),stats,descriptorRecord,selected});
 ctx.llm.registerAdapter([PROVIDER],new PickerFixture());ctx.on('llm/stream',(options,next)=>{if(options.provider===PROVIDER)stats.fixtureRequests++;else stats.blockedExternalAttempts++;assert.equal(options.provider,PROVIDER,'Real model forbidden');return next();},{prepend:true});
 ctx.effect(()=>{const timer=setTimeout(async()=>{try{
  assert(root&&process.env.DSH_HOME.startsWith(root));await Promise.all(Object.values(selected).map(path=>mkdir(path,{recursive:true})));
  const capability=()=>({kind:'native',pick:signal=>new Promise((resolve,reject)=>{backend.push({signal,resolve,reject,settled:false});})});
  const existing=ctx.get('directoryPicker');
  if(existing){let owner=existing,descriptor;while(owner&&!descriptor){descriptor=Object.getOwnPropertyDescriptor(owner,'capability');if(!descriptor)owner=Object.getPrototypeOf(owner);}
   const own=Object.getOwnPropertyDescriptor(existing,'capability');descriptorRecord={hadService:true,extensible:Object.isExtensible(existing),own:!!own,descriptor:descriptor?{writable:descriptor.writable,configurable:descriptor.configurable,getter:!!descriptor.get,setter:!!descriptor.set}:null};
   if(!Object.isExtensible(existing)||!descriptor||descriptor.writable!==true||own&&own.configurable===false)throw Error('Owned service cannot be safely substituted; no bypass attempted');
   Object.defineProperty(existing,'capability',{configurable:true,writable:true,value:capability});restore=()=>{if(own)Object.defineProperty(existing,'capability',own);else delete existing.capability;};
  }else{ctx.provide('directoryPicker',{capability});descriptorRecord={hadService:false,createdOwnedTestProvider:true};}
  const until=Date.now()+30000;let service;while(!(service=ctx.get('projectThreads'))&&Date.now()<until)await new Promise(resolve=>setTimeout(resolve,25));assert(service,'Projects service not ready');
  const model={provider:PROVIDER,model:'scripted'},one=await service.projects.create({name:'Picker HTTP synthetic A',coordinatorModel:model,threadModel:model}),two=await service.projects.create({name:'Picker HTTP synthetic B',coordinatorModel:model,threadModel:model});
  const reserve=await service.workspaces.reserve({requestId:randomUUID(),projectId:one.projectId,messageId:randomUUID(),task:'Synthetic never-started task for owner denial',title:'Picker denial fixture',executionKind:'local',threadId:randomUUID(),threadSessionId:randomUUID()});
  const state=await service.projects.state(one.projectId),request=state.executionRequests.find(value=>value.requestId===reserve.requestId);
  await save('picker-fixture-ready.json',{status:'PASS',evidence:'REAL_DSH_HTTP_CONTROLLED_PICKER',projectA:one,projectB:two,request,descriptorRecord,selected});
 }catch(error){await save('picker-fixture-failed.json',{error:error.stack,...snapshot()});}},400);return()=>{clearTimeout(timer);restore();};});
 ctx.effect(()=>ctx.connection.fetch.register({path:'/api/mem04-picker-fixture',methods:['GET','POST'],requestBody:'buffered',async fetch(request){try{
  if(request.method==='GET')return Response.json({ok:true,value:snapshot()});
  if(request.headers.get('content-type')?.split(';')[0]!=='application/json')throw Error('JSON required');const body=await request.json();
  if(body.op==='resolve'||body.op==='reject'){
   const job=backend[body.index];if(!job||job.settled)throw Error('Unknown unsettled synthetic job');job.settled=true;
   if(body.op==='reject')job.reject(Error('Synthetic controlled backend rejection'));else{if(!['a','b','cancel'].includes(body.selection))throw Error('Only fixed owned fixture selections allowed');job.resolve(body.selection==='cancel'?null:selected[body.selection]);}
  }else if(body.op==='disable')await ctx.pluginManager.setBundleEnabled('dsh-project-threads-wave1-spike',false);
  else throw Error('Unknown controlled fixture operation');
  await save('picker-fixture-live.json',snapshot());return Response.json({ok:true,value:snapshot()});
 }catch(error){return Response.json({ok:false,error:{code:'FIXTURE_FAILED',message:error.message}},{status:400});}}}));
}
