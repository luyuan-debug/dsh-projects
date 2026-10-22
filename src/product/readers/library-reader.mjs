import {selectReader} from './backend-selection.mjs';
import {execFile} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {fail} from '../domain/projects.mjs';
export const ADAPTER_VERSION='mac04r22.1-pdfkit-ooxml-expat';
const helper=fileURLToPath(new URL('./document-macos-arm64',import.meta.url));
const office=fileURLToPath(new URL('./office.py',import.meta.url));
// System Python's stdlib only; no pip, user site, Office application, or network access.
const python='/usr/bin/python3';
let activeReaders=0;
function run(file,args,signal){if(activeReaders>=4)fail('READER_BUSY','Four local reads are active; retry after one completes');activeReaders++;return new Promise((resolve,reject)=>{execFile(file,args,{timeout:20000,maxBuffer:8*1024*1024,signal,env:{PATH:'/usr/bin:/bin',PYTHONNOUSERSITE:'1',PYTHONDONTWRITEBYTECODE:'1'},encoding:'utf8'},(error,stdout)=>{activeReaders--;let value;try{value=JSON.parse(stdout)}catch{}if(value?.error)return reject(Object.assign(Error(value.message),{code:value.error}));if(error)return reject(Object.assign(Error(error.name==='AbortError'?'Read cancelled':'Local reader failed or exceeded 20 seconds / 8 MiB'),{code:error.name==='AbortError'?'READ_CANCELLED':error.killed?'READ_TIMEOUT':'READER_FAILED'}));resolve(value)})})}
export function readerOptions(input){const keys=['mode','start','end','sheet','range','includeNotes','offset','maxBytes','expectedVersion','itemId','projectId','operationId'];for(const k of Object.keys(input))if(!keys.includes(k))fail('READ_INPUT','Unsupported read option: '+k);if(input.mode!==undefined&&!['text','visual'].includes(input.mode))fail('READ_INPUT','Use text or visual mode');for(const k of ['start','end'])if(input[k]!==undefined&&(!Number.isSafeInteger(input[k])||input[k]<1))fail('READ_INPUT','Page/unit numbers must be positive integers');for(const k of ['sheet','range'])if(input[k]!==undefined&&(typeof input[k]!=='string'||input[k].length>200))fail('READ_INPUT','Invalid '+k);if(input.includeNotes!==undefined&&typeof input.includeNotes!=='boolean')fail('READ_INPUT','includeNotes must be boolean');return Object.fromEntries(['mode','start','end','sheet','range','includeNotes'].filter(k=>input[k]!==undefined).map(k=>[k,input[k]]));}
function pageText(value,input){const content=Buffer.from(JSON.stringify(value.records??[],null,2)),offset=input.offset??0,maxBytes=input.maxBytes??65536;if(!Number.isSafeInteger(offset)||offset<0||offset>content.length||!Number.isSafeInteger(maxBytes)||maxBytes<4||maxBytes>65536)fail('READ_LIMIT','Use valid offset and 4 to 65536 bytes');let end=Math.min(content.length,offset+maxBytes);while(end<content.length&&(content[end]&0xc0)===0x80)end--;let text;try{text=new TextDecoder('utf-8',{fatal:true}).decode(content.subarray(offset,end))}catch{fail('READ_OFFSET','Use the preceding nextOffset')};const {records,...metadata}=value;return {...metadata,readable:true,mode:'structured-text',text,offset,nextOffset:end,truncated:end<content.length,serializedBytes:content.length,...offset===0&&end===content.length?{records}:{}};}
/** Byte identity is checked by LibraryBlobs; callers pin the item and reauthorize after await. No persisted parse cache. */
export class LibraryReader{
 constructor({backends=[],preferred='builtin'}={}){this.backends=backends;this.preferred=preferred;}
 capabilities(){return [{id:'builtin',version:ADAPTER_VERSION,installed:true,formats:['text','pdf','png','jpeg','docx','xlsx','pptx'],network:'none',sideEffects:'none'},...this.backends.map(({id,version,formats,network,sideEffects})=>({id,version,formats,network,sideEffects,installed:true}))];}
 async read(blobs,item,input,{signal}={}){
  readerOptions(input);await blobs.verify(item);
  const snapshot=Object.freeze({name:item.name,size:item.size,mediaType:item.mediaType,sha256:item.sha256,version:item.version,open:()=>blobs.handle(item)});
  let validated;const builtin=async()=>validated??({...await this.readBuiltin(blobs,item,input,{signal}),backendId:'builtin',backendVersion:ADAPTER_VERSION});
  if(this.preferred!=='builtin'&&this.backends.some(b=>b.id===this.preferred))validated=await builtin(); // Preserve established structural refusals before invoking an optional implementation.
  // No extra backend is registered by the shipped plugin. This contract accepts only already reviewed offline implementations.
  return selectReader({preferred:this.preferred,backends:this.backends,builtin,snapshot,input,signal});
 }
 async readBuiltin(blobs,item,input,{signal}={}){
  const options=readerOptions(input);
  await blobs.verify(item);const fd=await blobs.handle(item);let head;try{head=Buffer.alloc(16);await fd.read(head,0,16,0)}finally{await fd.close()}
  const pdf=head.subarray(0,5).toString()==='%PDF-',png=head.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),jpeg=head[0]===255&&head[1]===216&&head[2]===255,zip=head[0]===80&&head[1]===75,ole=head.subarray(0,8).equals(Buffer.from('d0cf11e0a1b11ae1','hex'));
  if((pdf||png||jpeg||zip||ole)&&item.size>64*1024*1024)fail('READER_FILE_LIMIT','Local document reader accepts at most 64 MiB; original download remains available');
  let result;
  if(pdf||png||jpeg)result=await run(helper,[blobs.path(item.blobRef),JSON.stringify(options)],signal);
  else if(zip){if(input.mode==='visual')fail('VISUAL_UNSUPPORTED','Office structured reading is available; embedded pictures/charts are not rendered');result=await run(python,['-I',office,blobs.path(item.blobRef),JSON.stringify(options)],signal)}
  else if(ole)fail('LEGACY_OR_ENCRYPTED_OFFICE','Legacy OLE DOC/XLS/PPT or encrypted Office container; not admitted by this reader');
  else if(/\.(pdf|png|jpe?g|docx|xlsx|pptx)$/i.test(item.name))fail('TYPE_MISMATCH','File bytes do not match a supported document signature');
  else if(item.mediaType.startsWith('text/'))return {...await blobs.readText(item,input),adapterVersion:ADAPTER_VERSION,mode:'text',limitations:[]};
  else return {readable:false,reason:'Unsupported bytes; original download remains available',mode:'unsupported',adapterVersion:ADAPTER_VERSION};
  if(result.imageBase64){const {imageBase64,...meta}=result;return {...meta,readable:false,visualAvailable:true,mode:'visual',adapterVersion:ADAPTER_VERSION,imageBytes:Buffer.from(imageBase64,'base64')}}
  return {...pageText(result,input),...(result.format==='pdf'&&!result.records.some(p=>p.hasTextLayer)?{readable:false,visualAvailable:true,reason:'Selected pages have no text layer; request mode visual to inspect the actual page'}:{}),adapterVersion:ADAPTER_VERSION};
 }
}
