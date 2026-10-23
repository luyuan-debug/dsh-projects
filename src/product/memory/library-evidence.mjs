export const LIBRARY_EVIDENCE_LIMITS=Object.freeze({pageBytes:65536,totalBytes:512*1024,maxUnits:50,maxSheets:8,maxCalls:64});
function preview(text){const bytes=Buffer.from(text),max=65536,note='\n\n[显示前 64 KiB 以内的正文预览；请按来源位置读取后续正文。]';if(bytes.length<=max)return {text,previewTruncated:false};let end=max-Buffer.byteLength(note);while(end>0&&(bytes[end]&0xc0)===0x80)end--;return {text:bytes.subarray(0,end).toString('utf8')+note,previewTruncated:true}}
function structuredPreview(records){return records.map(r=>{const body=typeof r.text==='string'?r.text:r.cell?String(r.value??''):Array.isArray(r.shapes)?r.shapes.flatMap(s=>s.paragraphs??(s.rows??[]).map(row=>row.join('\t'))).join('\n'):Array.isArray(r.rows)?r.rows.map(row=>row.map(c=>c.text??'').join('\t')).join('\n'):'';const where=r.page?'页 '+r.page:r.slide?'幻灯片 '+r.slide:r.cell?'工作表 '+r.sheet+' · '+r.cell:r.path??'';return body?'['+where+']\n'+body:''}).filter(Boolean).join('\n\n')}

/** Adapt the existing inert reader only; never open a new Host path or start a second parser. */
export async function readLibraryEvidence(knowledge,projectId,item,signal){
 const limits=LIBRARY_EVIDENCE_LIMITS,records=[],texts=[],warnings=[];let calls=0,bytes=0,last,first,nextStart=null,nextOffset=0,truncated=false;
 const check=()=>{signal?.throwIfAborted();const now=knowledge.item(projectId,item.itemId);if(now.version!==item.version||now.sha256!==item.sha256)throw Object.assign(Error('Library changed while collecting evidence'),{code:'LIBRARY_CONFLICT'})};
 const read=async selection=>{check();if(++calls>limits.maxCalls)throw Object.assign(Error('Bounded Library read call limit'),{code:'LIBRARY_EVIDENCE_CALL_LIMIT'});const value=await knowledge.libraryRead(projectId,{itemId:item.itemId,expectedVersion:item.version,mode:'text',maxBytes:limits.pageBytes,...selection},{signal,validate:async()=>check()});check();last=value;first??=value;return value};
 // Each selected unit/range may itself have several 64 KiB serialization pages.
 const collect=async(selection,page)=>{let combined='',offset=0,metadata=page;for(;;){const value=page??await read({...selection,offset});page=null;metadata=value;
   if(value.mode!=='structured-text')return {metadata:value,records:[]};
   const part=typeof value.text==='string'?value.text:'';
   if(bytes+Buffer.byteLength(part)>limits.totalBytes){truncated=true;warnings.push('LIBRARY_EVIDENCE_BYTE_LIMIT');return {metadata:value,records:null}}
   bytes+=Buffer.byteLength(part);combined+=part;offset=value.nextOffset;
   if(!value.truncated){let parsed=value.records;if(!parsed){try{parsed=JSON.parse(combined)}catch{throw Object.assign(Error('Structured reader page collection is incomplete'),{code:'LIBRARY_EVIDENCE_SERIALIZATION'})}}if(!Array.isArray(parsed))throw Object.assign(Error('Structured reader did not return records'),{code:'LIBRARY_EVIDENCE_SERIALIZATION'});return {metadata,records:parsed}}
   if(!Number.isSafeInteger(offset)||offset<=0||calls>=limits.maxCalls){truncated=true;warnings.push('LIBRARY_EVIDENCE_CALL_LIMIT');return {metadata:value,records:null}}
  }};
 let page=await read({start:1,end:1});
 if(page.mode!=='structured-text'){
  if(page.readable===false)return {...page,evidenceRead:{calls,bytes:0,limits},warnings};
  for(;;){const content=typeof page.content==='string'?page.content:typeof page.text==='string'?page.text:'';const available=limits.totalBytes-bytes;
   if(Buffer.byteLength(content)>available){truncated=true;warnings.push('LIBRARY_EVIDENCE_BYTE_LIMIT');break}
   texts.push(content);bytes+=Buffer.byteLength(content);nextOffset=page.nextOffset??bytes;
   if(!page.truncated)break;if(calls>=limits.maxCalls||bytes>=limits.totalBytes){truncated=true;warnings.push(bytes>=limits.totalBytes?'LIBRARY_EVIDENCE_BYTE_LIMIT':'LIBRARY_EVIDENCE_CALL_LIMIT');break}
   if(!Number.isSafeInteger(nextOffset)||nextOffset<1)throw Object.assign(Error('Text reader made no progress'),{code:'LIBRARY_EVIDENCE_SERIALIZATION'});
   page=await read({offset:nextOffset});
  }
  check();return {...first,...preview(texts.join('')),content:texts.join(''),offset:0,nextOffset,truncated,readable:true,warnings,evidenceRead:{calls,bytes,limits}};
 }
 if(page.format==='xlsx'){
  const sheets=page.sheets??[{name:page.sheet}],chosen=sheets.slice(0,limits.maxSheets);
  for(const [i,sheet]of chosen.entries()){if(calls>=limits.maxCalls){warnings.push('LIBRARY_EVIDENCE_CALL_LIMIT');break}const selection={sheet:sheet.name,range:'A1:T50'},batch=await collect(selection,i===0?page:undefined);if(batch.records===null)break;records.push(...batch.records.map(r=>({...r,sheet:sheet.name})));if(bytes>=limits.totalBytes)break}
  // The reader offers explicit cell ranges, not whole-workbook extent discovery.
  truncated=true;warnings.push('XLSX_INDEX_RANGE_LIMIT: each selected sheet A1:T50');if(sheets.length>limits.maxSheets)warnings.push('LIBRARY_EVIDENCE_SHEET_LIMIT');
  nextStart=null;
 }else{
  let start=1,selection={start:1,end:1};
  for(;;){const batch=await collect(selection,page);page=null;if(batch.records===null){nextStart=start;break}records.push(...batch.records);nextStart=batch.metadata.nextStart??null;
   if(!nextStart)break;if(nextStart>limits.maxUnits||bytes>=limits.totalBytes||calls>=limits.maxCalls){truncated=true;warnings.push(nextStart>limits.maxUnits?'LIBRARY_EVIDENCE_UNIT_LIMIT':bytes>=limits.totalBytes?'LIBRARY_EVIDENCE_BYTE_LIMIT':'LIBRARY_EVIDENCE_CALL_LIMIT');break}
   start=nextStart;const total=batch.metadata.pageCount??batch.metadata.totalUnits??limits.maxUnits;selection={start,end:Math.min(start+9,total,limits.maxUnits)};
  }
 }
 check();const {text:_serialized,...metadata}=first;
 return {...metadata,records,...preview(structuredPreview(records)),readable:records.some(r=>r.hasTextLayer!==false),mode:'structured-text',truncated,nextStart,warnings,...first.format==='xlsx'?{indexedRanges:records.length?[...new Set(records.map(r=>r.sheet))].map(sheet=>({sheet,range:'A1:T50'})):[],nextRange:{sheet:first.sheet,range:'U1:AN50'}}:{},evidenceRead:{calls,bytes,limits}};
}
