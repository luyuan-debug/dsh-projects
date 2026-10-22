/** Client observation references only. No Agent ownership, editor creation, or historical eager resume. */
export function createConversationRetention(sessions){
 const held=new Map();let closed=false;
 function drop(id,expected){const entry=held.get(id);if(!entry||expected&&entry!==expected)return;held.delete(id);try{entry.data.release()}finally{entry.scope.release()}}
 return {acquire(id,projectId){if(closed)throw Error('Project client is disposed');if(!held.has(id)){const scope=sessions.retainAgentScope(id);let data;try{data=sessions.retain(id,{source:'controllerOperation'})}catch(error){scope.release();throw error}const entry={scope,data,projectId};held.set(id,entry);void data.ready.catch(()=>drop(id,entry))}return sessions.retain(id,{source:'controllerOperation'})},releaseProject(projectId){for(const [id,entry]of held)if(entry.projectId===projectId)drop(id)},dispose(){if(closed)return;closed=true;for(const id of held.keys())drop(id)}};
}
