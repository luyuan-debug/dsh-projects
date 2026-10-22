/** Terminal permission/integrity/cancellation failures never fall through to another parser. */
export const SAFE_FALLBACK_CODES=new Set(['BACKEND_NOT_INSTALLED','BACKEND_FORMAT_UNSUPPORTED','BACKEND_STARTUP_NO_EFFECT']);
export async function selectReader({preferred='builtin',backends=[],builtin,snapshot,input,signal}){
 if(signal?.aborted)throw Object.assign(Error('Read cancelled'),{code:'READ_CANCELLED'});
 if(preferred==='builtin')return builtin();
 const backend=backends.find(b=>b.id===preferred);
 if(!backend)return {...await builtin(),backendFallback:{from:preferred,reason:'BACKEND_NOT_INSTALLED'}};
 if(backend.sideEffects!=='none'||backend.network!=='none')throw Object.assign(Error('External reader requires a separately reviewed, offline read-only contract'),{code:'BACKEND_NOT_AUTHORIZED'});
 let result;
 try{result=await backend.read(snapshot,input,{signal})}
 catch(error){if(signal?.aborted||!SAFE_FALLBACK_CODES.has(error.code)||error.sideEffects!==false)throw error;return {...await builtin(),backendFallback:{from:preferred,reason:error.code}}}
 if(signal?.aborted)throw Object.assign(Error('Read cancelled'),{code:'READ_CANCELLED'});
 if(!result||typeof result!=='object'||typeof result.readable!=='boolean'||!Array.isArray(result.limitations))throw Object.assign(Error('Reader returned an incomplete capability/result contract'),{code:'BACKEND_RESULT_INVALID'});
 return {...result,backendId:backend.id,backendVersion:backend.version};
}
