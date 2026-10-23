/** Business failures are returned through the command boundary; resource teardown failures remain fatal. */
export async function executeCommand(lifecycle, operation) {
  const outcome = await lifecycle.submit(async () => {
    try { return { ok: true, value: await operation() }; }
    catch (error) { return { ok: false, error }; }
  });
  if (!outcome.ok) throw outcome.error;
  return outcome.value;
}
/** Only native resource waits/cancellation may bypass command serialization. */
export async function executeIndependent(lifecycle,operation){
  const outcome=await lifecycle.runIndependent(async()=>{try{return {ok:true,value:await operation()};}catch(error){return {ok:false,error};}});
  if(!outcome.ok)throw outcome.error;return outcome.value;
}
