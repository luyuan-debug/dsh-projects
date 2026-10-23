import {randomUUID} from 'node:crypto';
import {fail} from '../domain/projects.mjs';

export const DIRECTORY_SELECTION_TIMEOUT_MS=120000;
const validId=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

/** Native wait is a resource, not a serialized Project command or a folder grant. */
export class NativeDirectorySelection{
 constructor({capability,connectSelected,isClosed=()=>false,timeoutMs=DIRECTORY_SELECTION_TIMEOUT_MS,setTimer=setTimeout,clearTimer=clearTimeout,clock=Date.now}){
  Object.assign(this,{capability,connectSelected,isClosed,timeoutMs,setTimer,clearTimer,clock});
  this.records=new Map();this.retired=new Map();this.physical=null;this.closed=false;this.blockedUntil=0;
 }
 prune(){for(const [id,row]of this.retired)if(row.until<=this.clock())this.retired.delete(id);}
 retire(id,reason){this.prune();if(!this.retired.has(id)&&this.retired.size>=256){this.blockedUntil=this.clock()+DIRECTORY_SELECTION_TIMEOUT_MS;return;}this.retired.set(id,{reason,until:this.clock()+DIRECTORY_SELECTION_TIMEOUT_MS});}
 cancelRecord(record,reason){if(!record.reason){record.reason=reason;record.controller.abort(new Error('Directory selection '+reason));}}
 cancel({pickerId}={}){
  if(!validId(pickerId))fail('PICKER_INVALID_ID','The directory selection ID is invalid');
  this.prune();const record=this.records.get(pickerId);
  if(record)this.cancelRecord(record,'cancelled');
  else if(!this.retired.has(pickerId))this.retire(pickerId,'cancelled');
  return {cancelled:!!record||this.retired.get(pickerId)?.reason==='cancelled',reason:record?.reason??this.retired.get(pickerId)?.reason??'cancelled'};
 }
 async pick({pickerId=randomUUID(),signal,commit=operation=>operation()}={}){
  if(!validId(pickerId))fail('PICKER_INVALID_ID','The directory selection ID is invalid');
  if(this.closed||this.isClosed())return {cancelled:true,reason:'closed'};
  this.prune();const retired=this.retired.get(pickerId);
  if(retired)return {cancelled:true,reason:retired.reason==='selected'?'cancelled':retired.reason};
  if(signal?.aborted){this.retire(pickerId,'request_aborted');return {cancelled:true,reason:'request_aborted'};}
  if(this.physical)fail('PICKER_ALREADY_OPEN','A system folder selector is still open or closing; cancel it before starting another');
  if(this.clock()<this.blockedUntil||this.retired.size>=256)fail('PICKER_CAPACITY','Too many recent directory selections; wait two minutes before trying again');
  const picker=this.capability();if(picker?.kind!=='native')fail('NATIVE_PICKER_UNAVAILABLE','This endpoint has no verified native directory picker');
  const record={pickerId,controller:new AbortController(),reason:null};this.records.set(pickerId,record);this.physical=record;
  const controller=record.controller,abort=()=>this.cancelRecord(record,'request_aborted');
  signal?.addEventListener('abort',abort,{once:true});
  const validate=()=>{if(record.reason||controller.signal.aborted||this.closed||this.isClosed())throw Object.assign(new Error('Directory selection is no longer current'),{code:'PICKER_CANCELLED'});};
  const cancelled=new Promise(resolve=>controller.signal.addEventListener('abort',()=>resolve({aborted:true}),{once:true}));
  const timer=this.setTimer(()=>this.cancelRecord(record,'timeout'),this.timeoutMs);
  // Keep the physical slot until the native backend settles, even if it ignores
  // abort. The logical request still finishes promptly and never blocks commands.
  const native=Promise.resolve().then(()=>{validate();return picker.pick(controller.signal);});
  void native.then(()=>{if(this.physical===record)this.physical=null;},()=>{if(this.physical===record)this.physical=null;});
  try{
   const selected=await Promise.race([native.then(path=>({path})),cancelled]);
   if(selected.aborted||record.reason)return {cancelled:true,reason:record.reason??'cancelled'};
   validate();if(selected.path===null){record.reason='cancelled';return {cancelled:true,reason:'cancelled'};}
   if(typeof selected.path!=='string'||!selected.path)fail('NATIVE_PICKER_RESPONSE','The native picker returned an invalid selection');
   return await commit(async()=>{validate();const folder=await this.connectSelected(selected.path,{signal:controller.signal,validate});validate();return {folder};});
  }catch(error){if(record.reason||controller.signal.aborted||this.closed||this.isClosed())return {cancelled:true,reason:record.reason??'closed'};throw error;}
  finally{this.clearTimer(timer);signal?.removeEventListener('abort',abort);this.records.delete(pickerId);this.retire(pickerId,record.reason??'selected');}
 }
 close(){this.closed=true;for(const record of this.records.values())this.cancelRecord(record,'closed');}
}
