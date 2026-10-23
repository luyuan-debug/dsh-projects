import path from 'node:path';
import {createHash} from 'node:crypto';
import {constants} from 'node:fs';
import {lstat,realpath,opendir,open} from 'node:fs/promises';
import {setImmediate as yieldEventLoop} from 'node:timers/promises';
import {chunkText} from '../vendor/dsh-project-memory/chunker.js';
import {scanSymbols} from '../vendor/dsh-project-memory/symbols.js';
import {buildBm25} from '../vendor/dsh-project-memory/util/search.js';
import {extractKeywords,extractTermText} from '../vendor/dsh-project-memory/doc-index.js';
import {entryIdPrefix} from '../vendor/dsh-project-memory/util/entry-id.js';

export const DONOR=Object.freeze({repository:'https://github.com/00080000/dsh-project-memory',version:'0.6.3',commit:'21fc69e3e98f3864677e091477b7d543a0e54939',core:['chunkText','scanSymbols','entryIdPrefix','extractKeywords','extractTermText','buildBm25/tokenizeRaw'],mode:'lexical-only'});
const sha=value=>createHash('sha256').update(value).digest('hex');
const inside=(root,file)=>{const rel=path.relative(root,file);return rel!==''&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel)};
const TEXT_EXT=new Set(['.md','.markdown','.txt','.rst','.adoc','.js','.mjs','.cjs','.ts','.mts','.cts','.jsx','.tsx','.py','.go','.rs','.c','.cc','.cpp','.h','.hpp','.cs','.java','.sh','.zsh','.json','.yaml','.yml','.toml','.ini','.css','.scss','.html','.xml','.sql','.csv','.tsv','.vue','.svelte','.swift','.kt','.kts','.rb','.php','.lua','.gd','.godot','.tscn','.tres','.gdextension','.csproj','.sln','.props','.targets']);
const OMIT_DIR=new Set(['node_modules','vendor','dist','build','coverage','target','__pycache__','cache','tmp','obj']);
// Source code names describe their responsibility, not whether they contain secrets.
// Keep obvious credential artifacts out before reading and reject high-confidence
// credential values after bounded decoding. Neither skipped bodies nor values enter logs.
const CREDENTIAL_DATA_EXT=new Set(['','.json','.jsonl','.yaml','.yml','.toml','.ini','.cfg','.conf','.txt','.csv','.tsv','.xml']);
function credentialArtifact(name){
 if(/\.(?:pem|key|p12|pfx|keystore)$/i.test(name)||/^(?:id_(?:rsa|dsa|ecdsa|ed25519)|credentials?)(?:\.pub)?$/i.test(name))return true;
 if(!CREDENTIAL_DATA_EXT.has(path.extname(name).toLowerCase()))return false;
 return /(?:^|[._-])(?:credentials?|secrets?|passwords?|tokens?|private[-_]?key|service[-_]?account|auth|cookies?)(?:[._-]|$)/i.test(name);
}
function credentialContent(value){
 if(/-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----|\b(?:AKIA|ASIA)[A-Z0-9]{16}\b|\bgh[pousr]_[A-Za-z0-9]{30,}\b|\bgithub_pat_[A-Za-z0-9_]{30,}\b|\bxox[baprs]-[A-Za-z0-9-]{20,}/.test(value))return true;
 if(/(?:authorization|proxy-authorization)["']?\s*[:=]\s*["']?(?:Bearer|Basic)\s+[A-Za-z0-9+/_=.-]{20,}/i.test(value))return true;
 // Literal secret assignments are distinct from identifiers or process.env references.
 const assignments=/(?:["']?(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|password|secret[_-]?key)["']?)\s*[:=]\s*["']([^"'\r\n]{20,})["']/gi;
 for(const match of value.matchAll(assignments)){const secret=match[1];if(!/\s|\$\{|<|>|^(?:example|sample|placeholder|dummy|test|your[_-]|replace[_-]|process\.)/i.test(secret)&&/[a-z]/i.test(secret)&&/[0-9+/_=.-]/.test(secret))return true;}
 return false;
}
const AUTH_ERROR=Symbol('authority');
function denied(message){const e=Error(message);e.code='MEMORY_EVIDENCE_REVOKED';e[AUTH_ERROR]=true;return e}
function globRegex(pattern){let out='';for(let i=0;i<pattern.length;i++){const c=pattern[i];if(c==='*'){if(pattern[i+1]==='*'){i++;if(pattern[i+1]==='/'){i++;out+='(?:.*/)?'}else out+='.*'}else out+='[^/]*'}else if(c==='?')out+='[^/]';else if(c==='['){const end=pattern.indexOf(']',i+1);if(end>i){const cls=pattern.slice(i+1,end);out+='['+(cls.startsWith('!')?'^'+cls.slice(1):cls)+']';i=end}else out+='\\['}else if(c==='\\'&&i+1<pattern.length){out+=pattern[++i].replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}else out+=c.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}return out}
function ignoreRules(text,base=''){return text.split(/\r?\n/).flatMap(line=>{let p=line.replace(/(?<!\\)\s+$/,'');if(!p||p.startsWith('#'))return [];let negative=false;if(p[0]==='!'){negative=true;p=p.slice(1)}if(!p)return [];const dir=p.endsWith('/');if(dir)p=p.slice(0,-1);const rooted=p.startsWith('/');if(rooted)p=p.slice(1);const anchored=rooted||p.includes('/');return [{base,negative,dir,re:new RegExp((anchored?'^':'(?:^|/)')+globRegex(p)+'(?:$|/)')}]})}
function ignored(rel,isDir,rules){let result=false;for(const r of rules){const local=r.base?rel.startsWith(r.base+'/')?rel.slice(r.base.length+1):null:rel;if(local===null)continue;if(r.re.test(local)&&(!r.dir||isDir||local.includes('/')))result=!r.negative}return result}
function plainText(bytes){if(bytes.includes(0))return null;try{return new TextDecoder('utf-8',{fatal:true}).decode(bytes)}catch{return null}}
function sectionsFromLibrary(value){
 if(!value||value.readable===false)return [];
 if(Array.isArray(value.records))return value.records.flatMap((r,i)=>{const locator={...(r.page?{page:r.page}:{}),...(r.slide?{slide:r.slide}:{}),...(r.path?{part:r.path}:{}),...(r.cell?{sheet:r.sheet??value.sheet,cell:r.cell}:{}),unit:r.block??i+1};let text='';if(typeof r.text==='string')text=r.text;else if(r.cell)text=String(r.value??'');else if(Array.isArray(r.shapes))text=r.shapes.flatMap(s=>s.paragraphs??(s.rows??[]).map(row=>row.join('\t'))).join('\n');else if(Array.isArray(r.cells))text=r.cells.map(c=>c.text??'').join('\n');
  const table=Array.isArray(r.rows)?r.rows.flatMap((row,ri)=>row.map((cell,ci)=>({text:cell.text??'',locator:{...locator,part:cell.path??r.path,row:ri+1,column:ci+1}}))).filter(c=>c.text):[];
  return [...text?[{text,locator}]:[],...table]});
 if(value.mode==='structured-text')return []; // Partial serialized JSON is not document body with honest locations.
 const text=typeof value.content==='string'?value.content:typeof value.text==='string'?value.text:'';
 return text?[{text,locator:{...(value.offset!==undefined?{offset:value.offset}:{}),...(value.selection?{selection:value.selection}:{})}}]:[];
}

/** Rebuildable, local evidence only. Authority is supplied by the runtime, never by model arguments. */
export class ProjectEvidenceIndex{
 constructor(options={}){this.options={maxFiles:2000,maxDirectories:5000,maxFileBytes:256*1024,maxTotalBytes:32*1024*1024,maxChunks:20000,chunkChars:1500,maxChunksPerFile:128,maxLibraryItems:100,...options};for(const [name,value]of Object.entries(this.options))if(!Number.isSafeInteger(value)||value<1)throw Error(name+' must be a positive safe integer');this.files=new Map();this.corpora=new Map();this.generation=0;}
 clear(){this.files.clear();this.corpora.clear();this.generation++}
 async query({projectId,query='',records=[],resources=[],libraryItems=[],readLibrary,signal,validate=async()=>{},includeHistory=false,limit=8}={}){
  if(typeof projectId!=='string'||!projectId)throw Error('A trusted Project identity is required');
  const generation=this.generation,options=this.options,warnings=[],entries=[],history=[],stats={directoriesVisited:0,filesVisited:0,filesIndexed:0,bytesRead:0,chunks:0,libraryItems:0,cacheHits:0,skipped:{hidden:0,credentialArtifact:0,credentialContent:0,symlink:0,ignored:0,buildCache:0,unsupportedFormat:0,nonText:0,fileSizeLimit:0,nonRegular:0}},localCache=new Map(),readers=new Map();
  const check=async(source)=>{signal?.throwIfAborted();if(generation!==this.generation)throw denied('Evidence index was invalidated');let valid;try{valid=await validate(source)}catch(e){e[AUTH_ERROR]=true;throw e}if(valid===false)throw denied('Project resources changed or permission was revoked');signal?.throwIfAborted()};
  const skipped=reason=>{stats.skipped[reason]++;};
  const softError=(error,label)=>{if(signal?.aborted||error?.[AUTH_ERROR]||error?.code==='MEMORY_EVIDENCE_REVOKED')throw error;warnings.push(label+': '+(error?.code??'READ_FAILED'))};
  const append=(text,title,source,kind='evidence',idBase='')=>{if(!text?.trim())return;const chunks=chunkText(text,options.chunkChars,options.maxChunksPerFile);if(chunks.length===options.maxChunksPerFile&&text.length>chunks.reduce((n,c)=>n+c.text.length,0))warnings.push('SOURCE_CHUNK_LIMIT: '+source.path);for(let i=0;i<chunks.length;i++){if(entries.length+history.length>=options.maxChunks){warnings.push('INDEX_CHUNK_LIMIT');break}const c=chunks[i],line=(source.line??1)+c.line-1,entry={id:sha(projectId+'\0'+idBase+'\0'+i),title:c.title||title,text:c.text,content:c.text,keywords:extractKeywords(c.title||title,c.text),terms:extractTermText(c.text),source:{...source,line,lineEnd:line+(c.text.match(/\n/g)||[]).length},kind,...(source.kind==='memory'?{entryId:source.entryId,logicalPath:source.logicalPath,revision:source.version,status:source.status,scope:source.scope,sourceRefs:source.sourceRefs}:{})};if(kind==='history')history.push(entry);else entries.push(entry)}};
  await check();
  for(const r of records){if(r.projectId&&r.projectId!==projectId)continue;if(r.deleted||r.status==='forgotten'||r.status==='candidate')continue;const active=r.status===undefined||r.status==='active';if(!active&&!includeHistory)continue;const content=String(r.content??r.body??r.text??'');append(content,r.name??r.title??r.logicalPath??r.entryId,{kind:'memory',projectId,entryId:r.entryId,logicalPath:r.logicalPath,path:r.logicalPath??r.name??r.entryId,hash:sha(content),version:r.revision??r.version??1,status:r.status??'active',topicKey:r.topicKey,scope:r.scope,sourceRefs:r.sourceRefs},active?'current':'history','memory:'+r.entryId+':'+(r.revision??r.version??1));if(entries.length%50===0)await yieldEventLoop()}
  // Resource roots are enumerated solely by trusted runtime membership/bindings.
  for(const resource of resources){
   await check(resource);if(!resource.resourceId||!resource.workspaceInstanceId||typeof resource.root!=='string'||!path.isAbsolute(resource.root)){warnings.push('RESOURCE_IDENTITY_REQUIRED');continue}
   let root;try{const st=await lstat(resource.root);if(st.isSymbolicLink()||!st.isDirectory())throw Object.assign(Error('Invalid root'),{code:'RESOURCE_ROOT_SYMLINK'});root=await realpath(resource.root)}catch(e){softError(e,'RESOURCE_UNAVAILABLE');continue}
   const scope=sha(JSON.stringify([projectId,resource.resourceId,resource.workspaceInstanceId,resource.version,root]));
   const read=async(file,max)=>{await check(resource);const rp=await realpath(file);if(!inside(root,rp))throw Object.assign(Error('Escaped root'),{code:'PATH_OUTSIDE_RESOURCE'});const st=await lstat(file);if(st.isSymbolicLink()||!st.isFile()||st.size>max)return null;const fd=await open(file,constants.O_RDONLY|constants.O_NOFOLLOW);try{const current=await fd.stat();if(current.ino!==st.ino||current.dev!==st.dev||current.size>max)throw Object.assign(Error('File changed'),{code:'SOURCE_CHANGED'});const after=await realpath(file);if(after!==rp||!inside(root,after))throw Object.assign(Error('File changed'),{code:'SOURCE_CHANGED'});await check(resource);const bytes=Buffer.alloc(current.size);let total=0;while(total<bytes.length){signal?.throwIfAborted();const result=await fd.read(bytes,total,bytes.length-total,total);if(!result.bytesRead)break;total+=result.bytesRead}const final=await fd.stat();if(final.size!==current.size||final.mtimeMs!==current.mtimeMs||total!==bytes.length)throw Object.assign(Error('File changed during read'),{code:'SOURCE_CHANGED'});await check(resource);return bytes}finally{await fd.close()}};
   readers.set(resource.resourceId+'\0'+resource.workspaceInstanceId,{root,read});
   const explicit=ignoreRules((resource.excludes??[]).join('\n'));
   const walk=async(dir,rel='',inherited=[])=>{await check(resource);if(stats.filesVisited>=options.maxFiles){warnings.push('INDEX_FILE_LIMIT');return}if(stats.bytesRead>=options.maxTotalBytes){warnings.push('INDEX_BYTE_LIMIT');return}if(stats.directoriesVisited>=options.maxDirectories){warnings.push('INDEX_DIRECTORY_LIMIT');return}const dirReal=await realpath(dir);if(dirReal!==root&&!inside(root,dirReal))return;const ds=await lstat(dir);if(ds.isSymbolicLink()||!ds.isDirectory())return;stats.directoriesVisited++;let rules=inherited;try{const bytes=await read(path.join(dir,'.gitignore'),65536);if(bytes)rules=rules.concat(ignoreRules(bytes.toString('utf8'),rel))}catch(e){if(e.code!=='ENOENT')softError(e,'GITIGNORE_UNAVAILABLE')}
    const children=await opendir(dir);for await(const item of children){
     await check(resource);const sub=rel?rel+'/'+item.name:item.name;
     if(item.isSymbolicLink()){skipped('symlink');continue;}
     // Only workflow text is exposed from GitHub's normally hidden metadata tree.
     if((item.name.startsWith('.')&&!(sub==='.github'&&item.isDirectory()))||(rel==='.github'&&!(item.name==='workflows'&&item.isDirectory()))){skipped('hidden');continue;}
     if(item.isFile()&&credentialArtifact(item.name)){skipped('credentialArtifact');continue;}
     if(ignored(sub,item.isDirectory(),[...rules,...explicit])){skipped('ignored');continue;}
     const file=path.join(dir,item.name);
     if(item.isDirectory()){if(OMIT_DIR.has(item.name))skipped('buildCache');else await walk(file,sub,rules);continue;}
     if(!item.isFile()){skipped('nonRegular');continue;}
     stats.filesVisited++;if(stats.filesVisited>options.maxFiles){warnings.push('INDEX_FILE_LIMIT');return;}
     if(!TEXT_EXT.has(path.extname(item.name).toLowerCase())&&!['Makefile','Dockerfile','LICENSE'].includes(item.name)){skipped('unsupportedFormat');continue;}
     try{
      const bytes=await read(file,Math.min(options.maxFileBytes,options.maxTotalBytes-stats.bytesRead));
      if(!bytes){skipped('fileSizeLimit');warnings.push('FILE_SIZE_LIMIT: '+sub);continue;}
      stats.bytesRead+=bytes.length;const text=plainText(bytes);
      if(text===null){skipped('nonText');continue;}
      if(credentialContent(text)){skipped('credentialContent');continue;}
      const hash=sha(bytes),key=scope+':'+sub,cached=this.files.get(key);let extracted;
      if(cached?.hash===hash){extracted=cached.entries;stats.cacheHits++;}
      else{const source={kind:'code',projectId,resourceId:resource.resourceId,workspaceInstanceId:resource.workspaceInstanceId,path:sub,hash,version:resource.version,commit:resource.commit};const before=entries.length;append(text,sub,source,'evidence',scope+':'+entryIdPrefix(sub)+':'+hash);for(const symbol of scanSymbols(sub,text)){if(entries.length>=options.maxChunks)break;entries.push({...symbol,id:sha(scope+':'+symbol.id+':'+hash),text:symbol.text,content:symbol.text,terms:symbol.text,kind:'evidence',source:{...source,line:symbol.sourceLine,symbol:symbol.keywords[0],symbolKind:symbol.keywords[1]}});}extracted=entries.splice(before);}
      localCache.set(key,{hash,entries:extracted});entries.push(...extracted.slice(0,Math.max(0,options.maxChunks-entries.length-history.length)));stats.filesIndexed++;
      if(stats.filesIndexed%8===0)await yieldEventLoop();if(stats.bytesRead>=options.maxTotalBytes){warnings.push('INDEX_BYTE_LIMIT');return;}
     }catch(e){softError(e,'SOURCE_READ_FAILED: '+sub);}
    }};

   try{await walk(root)}catch(e){softError(e,'RESOURCE_SCAN_FAILED')}
  }
  if(libraryItems.length&&!readLibrary)warnings.push('LIBRARY_READER_UNAVAILABLE');
  if(readLibrary)for(const item of libraryItems.slice(0,options.maxLibraryItems)){if(item.deleted)continue;await check(item);try{const value=await readLibrary(item);await check(item);if(value?.version!==undefined&&value.version!==item.version)throw Object.assign(Error('Library version changed'),{code:'LIBRARY_CONFLICT'});if(value?.sha256&&item.sha256&&value.sha256!==item.sha256)throw Object.assign(Error('Library bytes changed'),{code:'LIBRARY_CONFLICT'});if(Array.isArray(value?.warnings))warnings.push(...value.warnings);const sections=sectionsFromLibrary(value);if(!sections.length)warnings.push('LIBRARY_NO_INDEXABLE_TEXT: '+item.itemId);if(value?.truncated||value?.nextStart)warnings.push('LIBRARY_PARTIAL_TEXT: '+item.itemId);for(const part of sections)append(part.text,item.name,{kind:'library',projectId,resourceId:item.resourceId??item.itemId,itemId:item.itemId,path:item.name,hash:item.sha256??sha(part.text),version:item.version,...part.locator},'evidence','library:'+item.itemId+':'+item.version+':'+JSON.stringify(part.locator));stats.libraryItems++}catch(e){softError(e,'LIBRARY_READ_FAILED: '+item.itemId)}}
  if(libraryItems.length>options.maxLibraryItems)warnings.push('LIBRARY_ITEM_LIMIT');
  await check();stats.chunks=entries.length+history.length;
  const safeLimit=Math.max(1,Math.min(50,Number.isSafeInteger(limit)?limit:8));
  const rank=async(docs,bucket)=>{await yieldEventLoop();await check();if(!docs.length||!String(query).trim())return [];const fingerprint=sha(docs.map(d=>d.id+':'+d.source.hash+':'+d.source.version).join('\n')),cacheKey=projectId+':'+bucket;let cached=this.corpora.get(cacheKey);if(cached?.fingerprint!==fingerprint)cached={fingerprint,index:buildBm25(docs,d=>d.title+' '+d.title+' '+d.text+' '+(d.source.path??''),d=>[d.title,d.text])};const result=cached.index.score(String(query)).slice(0,safeLimit).map(({doc,score,matched})=>({...doc,score,matched}));await check();this.corpora.set(cacheKey,cached);return result};
  const current=await rank(entries.filter(e=>e.kind==='current'),'current'),rankedEvidence=await rank(entries.filter(e=>e.kind==='evidence'),'evidence'),old=includeHistory?await rank(history,'history'):[],evidence=[];
  // Re-read the few chosen files after ranking. Never present old line numbers as a current snapshot.
  const verified=new Map();for(const hit of rankedEvidence){const source=hit.source;if(source.kind==='code'){const key=source.resourceId+'\0'+source.workspaceInstanceId+'\0'+source.path;let hash=verified.get(key);if(hash===undefined){const reader=readers.get(source.resourceId+'\0'+source.workspaceInstanceId);try{const bytes=await reader.read(path.join(reader.root,source.path),options.maxFileBytes);hash=bytes?sha(bytes):null}catch(e){softError(e,'SOURCE_RECHECK_FAILED: '+source.path);hash=null}verified.set(key,hash)}if(hash!==source.hash){warnings.push('SOURCE_CHANGED: '+source.path);continue}}await check(source);evidence.push(hit)}
  await check();for(const [key,value]of localCache)this.files.set(key,value);if(this.files.size>options.maxFiles*2){const live=new Set(localCache.keys());for(const key of this.files.keys())if(!live.has(key))this.files.delete(key)}if(this.corpora.size>12)this.corpora.delete(this.corpora.keys().next().value);
  return {current,evidence,history:old,warnings:[...new Set(warnings)],health:warnings.length?'degraded':'ready',donor:DONOR,stats,trust:'untrusted-retrieved-data'};
 }
}
