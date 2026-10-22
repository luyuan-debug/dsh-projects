/** Metadata-only startup reads may precede Host route publication during plugin enable. Never retry denied operations. */
export async function readInitialProjectState(read,{signal,wait=abortableWait,delays=[50,150,400,1000,2000]}={}){
 for(let attempt=0;;attempt++){
  if(signal?.aborted)throw signal.reason??new DOMException('Aborted','AbortError');
  try{return await read()}
  catch(error){if(signal?.aborted||error.name==='AbortError'||attempt>=delays.length||![404,503].includes(error.status)&&!(error instanceof TypeError))throw error;await wait(delays[attempt],signal)}
 }
}
function abortableWait(ms,signal){return new Promise((resolve,reject)=>{const cleanup=()=>signal?.removeEventListener('abort',abort);const timer=setTimeout(()=>{cleanup();resolve()},ms);const abort=()=>{clearTimeout(timer);cleanup();reject(signal.reason??new DOMException('Aborted','AbortError'))};signal?.addEventListener('abort',abort,{once:true});if(signal?.aborted)abort()})}
