import {fail} from './projects.mjs';

/** Persist the execution fence and recovery targets before any fallible Host cleanup. */
export class ProjectLifecycle{
 constructor({registry,sessionIds,stop,archive,unarchive,revoke,removeData,drain=async()=>{}}){Object.assign(this,{registry,sessionIds,stop,archive,unarchive,revoke,removeData,drain});this.locks=new Map();}
 serial(id,operation){const result=(this.locks.get(id)??Promise.resolve()).then(operation),tail=result.then(()=>{},()=>{});this.locks.set(id,tail);void tail.then(()=>{if(this.locks.get(id)===tail)this.locks.delete(id)});return result;}
 commit(id,fields){return this.registry.serial(id,async()=>{const p=this.registry.get(id),next={...p,...fields,lifecycleRevision:(p.lifecycleRevision??0)+1,updatedAt:Date.now()};await this.registry.table.put(id,next);return next;});}
 async recover(limit=20){const results=[];for(const p of this.registry.list().filter(p=>p.lifecycle==='deleting'||p.lifecycle==='deleted'&&p.cleanup?.state!=='complete').slice(0,limit)){try{results.push(await this.change(p.projectId,'delete',{projectId:p.projectId,name:p.name,retainSessionHistory:true}))}catch(e){results.push({projectId:p.projectId,cleanupPending:true,code:e.code??'CLEANUP_FAILED'})}}return results;}
 change(id,action,confirmation){return this.serial(id,async()=>{
  let p=this.registry.get(id);const state=p.lifecycle??'active';
  if(action==='resume'||action==='unarchive'){
   const required=action==='resume'?'paused':'archived';if(state!==required)fail('PROJECT_STATE','Expected '+required+', found '+state);
   for(const sid of this.sessionIds(p))await this.stop(sid);await this.drain(id);
   if(action==='unarchive')for(const sid of this.sessionIds(p))await this.unarchive(sid);
   await this.commit(id,{lifecycle:'active',lifecycleErrors:[]});return {projectId:id,lifecycle:'active',replayedTasks:0};
  }
  if(!['pause','archive','delete'].includes(action))fail('LIFECYCLE_ACTION','Unknown Project action');
  if(state==='deleted'&&action!=='delete')fail('PROJECT_DELETED','Project was already removed');
  if(action==='pause'&&!['active','paused','pausing'].includes(state)||action==='archive'&&state==='deleting')fail('PROJECT_STATE','This action is unavailable while Project is '+state);
  if(action==='delete'&&(confirmation?.projectId!==id||confirmation?.name!==p.name||confirmation?.retainSessionHistory!==true))fail('DELETE_CONFIRMATION','Confirm exact Project name/id and retained DSH conversation history');
  const target=action==='pause'?'paused':action==='archive'?'archived':'deleted';
  const deletedResult=()=>({projectId:id,lifecycle:'deleted',sessionDeletion:'USER_SELECTED_BEHAVIOR',retainedSessionIds:p.ownedSessionIds??[],pluginDataRemoved:true,sourceFilesRemoved:false});
  if(action==='delete'&&p.cleanup?.state==='complete')return deletedResult();
  if(state===target&&action!=='delete')return {projectId:id,lifecycle:target};
  const ownedSessionIds=[...new Set([...this.sessionIds(p),...(p.ownedSessionIds??[])])];
  p=await this.commit(id,{lifecycle:action==='pause'?'pausing':action==='archive'?'archiving':'deleting',...(action==='delete'?{ownedSessionIds,cleanup:{...p.cleanup,state:'pending',attempts:(p.cleanup?.attempts??0)+1}}:{})});
  try{
   const outcomes=await Promise.allSettled(ownedSessionIds.map(sid=>this.stop(sid))),errors=outcomes.filter(r=>r.status==='rejected').map(r=>String(r.reason.code??r.reason.message));
   if(errors.length){await this.commit(id,{lifecycleErrors:errors,...(action==='delete'?{cleanup:{...p.cleanup,state:'failed',errors}}:{})});return {projectId:id,lifecycle:p.lifecycle,errors,stopped:false,pluginDataRemoved:false};}
   await this.drain(id);
   if(action!=='pause')for(const sid of ownedSessionIds)await this.archive(sid);
   if(action==='delete'){
    await this.revoke(id);
    // Preserve identities and cleanup intent even after project content is cleared.
    p=await this.commit(id,{ownedSessionIds,threadIds:[],contextRefs:[],memoryEntries:[],libraryItems:[],knowledgeOperations:[],cleanup:{...p.cleanup,state:'pending'}});
    await this.removeData(id);
    // Only this durable commit means cleanup completed. Retry repeats idempotent owned steps.
    await this.registry.serial(id,()=>this.registry.table.put(id,{schemaVersion:4,knowledgeVersion:1,projectId:id,name:p.name,lifecycle:'deleted',lifecycleRevision:p.lifecycleRevision+1,coordinatorSessionId:p.coordinatorSessionId,ownedSessionIds,threadIds:[],contextRefs:[],memoryEntries:[],libraryItems:[],knowledgeOperations:[],cleanup:{state:'complete',attempts:p.cleanup.attempts},deletedAt:Date.now()}));
    return deletedResult();
   }
   await this.commit(id,{lifecycle:target,lifecycleErrors:[]});return {projectId:id,lifecycle:target,stopped:true,historyPreserved:true};
  }catch(error){await this.commit(id,{lifecycleErrors:[error.code??'CLEANUP_FAILED'],...(action==='delete'?{cleanup:{...p.cleanup,state:'failed',error:error.code??'CLEANUP_FAILED'}}:{})});throw error;}
 });}
}
