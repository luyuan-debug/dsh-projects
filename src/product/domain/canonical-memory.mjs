import {copy,fail,stableKey,text} from './projects.mjs';
import {describeMemoryEntry} from './memory-entry-preview.mjs';

export const MEMORY_KINDS=['brief','requirement','constraint','decision','open_question','observation','lesson','procedure','reference'];
export const MEMORY_STATUSES=['candidate','active','superseded','archived'];
export const FORMAL_KINDS=new Set(['brief','requirement','constraint','decision','open_question']);
export const MEMORY_SCHEMA_VERSION=2;

export function memoryPath(value){
 text(value,'logicalPath',1000);
 if(value==='MEMORY.md')return value;
 if(value.startsWith('/')||value.includes('\\')||value.includes(':')||/[\x00-\x1f\x7f]/.test(value)||value.split('/').some(x=>!x||x==='.'||x==='..')||!value.endsWith('.md'))fail('MEMORY_PATH','Use a relative Markdown path without traversal');
 return value;
}
export function memoryScope(value={kind:'project'}){
 if(value==='project')return {kind:'project'};
 if(!value||typeof value!=='object'||!['project','thread'].includes(value.kind))fail('MEMORY_SCOPE','Memory scope must be project or thread');
 if(value.kind==='thread'){text(value.threadId,'threadId',200);return {kind:'thread',threadId:value.threadId};}
 return {kind:'project'};
}
export const scopeKey=value=>{const s=memoryScope(value);return s.kind==='project'?'project':'thread:'+s.threadId;};
export const topicIdentity=e=>stableKey(scopeKey(e.scope),e.kind,e.topicKey);
export function visibleScope(e,threadId){return e.scope.kind==='project'||(threadId!==undefined&&e.scope.threadId===threadId);}
export function statusMatches(e,status='active'){
 if(status==='all')return true;
 if(status==='history')return ['superseded','archived'].includes(e.status);
 if(!MEMORY_STATUSES.includes(status))fail('MEMORY_STATUS','Unknown memory status');
 return e.status===status;
}
export function sourceKeys(refs=[]){
 return refs.flatMap(ref=>{
  const messageId=ref.messageId??ref.sourceMessageId;
  // A fresh tool call quoting an old message is still the same forgotten source.
  if(messageId)return [stableKey('memory-source','message',ref.sessionId??null,messageId)];
  if(ref.itemId)return [stableKey('memory-source','library',ref.itemId,ref.version??null)];
  if(ref.callId)return [stableKey('memory-source','call',ref.sessionId??null,ref.callId)];
  if(ref.operationId)return [stableKey('memory-source','ui-edit',ref.operationId)];
  return [];
 }).sort();
}
export function decisionAuthority(actor){return actor?.kind==='user'||(actor?.intent==='explicit-decision'&&Array.isArray(actor.sourceRefs)&&actor.sourceRefs.length>0);}
export function boundSources(actor,input){
 const refs=actor.sourceRefs??(actor.kind==='user'?[{kind:'ui-edit',operationId:input.operationId}]:[{kind:'model-observation',...copy(actor.source??{})}]);
 if(!Array.isArray(refs)||refs.length>100||refs.some(r=>!r||typeof r!=='object'||Array.isArray(r)))fail('MEMORY_SOURCE','Invalid bound memory sources');
 if(input.sourceRefs!==undefined&&JSON.stringify(input.sourceRefs)!==JSON.stringify(refs))fail('MEMORY_SOURCE','Sources must be verified and bound by the current runtime');
 return copy(refs);
}
function safeLegacyPath(name,entryId,used){
 let path;try{path=memoryPath(name);if(path==='MEMORY.md')path=null;}catch{}
 if(!path||used.has(path))path='legacy/'+stableKey(entryId).slice(0,24)+'.md';
 used.add(path);return path;
}
/** Pure additive migration. No guessed user quotes and no second copy of entry bodies. */
export function canonicalDefaults(project){
 if(project.knowledgeVersion>MEMORY_SCHEMA_VERSION)fail('MEMORY_SCHEMA_NEWER','This memory schema needs a newer plugin; export before downgrading');
 for(const key of ['memoryEntries','libraryItems','knowledgeOperations'])if(project[key]!==undefined&&!Array.isArray(project[key]))fail('MEMORY_STORE_CORRUPT','Project '+key+' is not an array; preserve the owned Store for recovery');
 const p={...project,knowledgeVersion:MEMORY_SCHEMA_VERSION,lifecycle:project.lifecycle??'active',contextRevision:project.contextRevision??0,memoryIndexRevision:project.memoryIndexRevision??0,memoryEntries:copy(project.memoryEntries??[]),libraryItems:project.libraryItems??[],knowledgeOperations:project.knowledgeOperations??[],memoryIndexMeta:copy(project.memoryIndexMeta??{description:'',pinnedEntryIds:[],revision:0}),memoryMigration:copy(project.memoryMigration??{version:MEMORY_SCHEMA_VERSION,mappings:[]})};
 if(!p.memoryIndexMeta||typeof p.memoryIndexMeta.description!=='string'||!Array.isArray(p.memoryIndexMeta.pinnedEntryIds)||!Number.isSafeInteger(p.memoryIndexMeta.revision)||p.memoryIndexMeta.revision<0||!Array.isArray(p.memoryMigration?.mappings))fail('MEMORY_STORE_CORRUPT','Memory index metadata is invalid; preserve the owned Store for recovery');
 const used=new Set(p.memoryEntries.filter(e=>!e.deleted&&e.logicalPath).map(e=>e.logicalPath));
 const ids=new Set();
 for(const e of p.memoryEntries){
  if(typeof e.entryId!=='string'||!Number.isSafeInteger(e.revision)||e.revision<1)fail('MEMORY_STORE_CORRUPT','Memory entry identity or revision is invalid');
  if(ids.has(e.entryId))fail('MEMORY_STORE_CORRUPT','Duplicate memory identity; preserve the owned Store for recovery');ids.add(e.entryId);
  if(e.deleted){delete e.content;delete e.source;delete e.sourceRefs;delete e.reason;delete e.name;delete e.logicalPath;delete e.revisions;continue;}
  if(typeof e.content!=='string')fail('MEMORY_STORE_CORRUPT','Memory entry body is not readable; preserve the owned Store for recovery');
  if(!e.logicalPath){e.logicalPath=safeLegacyPath(e.name,e.entryId,used);p.memoryMigration.mappings.push({entryId:e.entryId,name:e.name??null,logicalPath:e.logicalPath});}
  memoryPath(e.logicalPath);e.projectId??=project.projectId;e.kind??=e.origin==='user_instruction'?'decision':'observation';
  if(!MEMORY_KINDS.includes(e.kind))fail('MEMORY_STORE_CORRUPT','Unknown persisted memory kind');
  e.topicKey??='legacy:'+e.entryId;e.scope=memoryScope(e.scope);e.status??='active';
  if(!MEMORY_STATUSES.includes(e.status))fail('MEMORY_STORE_CORRUPT','Unknown persisted memory status');
  e.supersedes??=[];e.sourceRefs??=[{kind:'legacy-source',verified:false}];e.createdAt??=e.updatedAt??project.createdAt??0;
  if(!Array.isArray(e.sourceRefs)||!Array.isArray(e.supersedes)||(e.revisions!==undefined&&!Array.isArray(e.revisions)))fail('MEMORY_STORE_CORRUPT','Memory sources or historical revisions are invalid');
  for(const r of e.revisions??[]){
   if(typeof r.content!=='string'||!Number.isSafeInteger(r.revision)||r.revision<1||r.revision>=e.revision)fail('MEMORY_STORE_CORRUPT','Historical memory revision is invalid');
   r.entryId??=e.entryId;r.projectId??=e.projectId;r.logicalPath??=e.logicalPath;r.scope=memoryScope(r.scope??e.scope);r.kind??=e.kind;r.topicKey??=e.topicKey;r.status='superseded';r.historical=true;r.sourceRefs??=[{kind:'legacy-source',verified:false}];
  }
  if(e.topicKey.startsWith('legacy:'))e.legacySource=true;
 }
 // Preserve ambiguous older state for review instead of choosing a winner.
 const current=new Map();for(const e of p.memoryEntries.filter(e=>!e.deleted&&e.status==='active'&&FORMAL_KINDS.has(e.kind))){const key=topicIdentity(e);current.set(key,[...(current.get(key)??[]),e]);}
 p.memoryMigration.conflicts=[...current.values()].filter(group=>group.length>1).map(group=>({kind:group[0].kind,topicKey:group[0].topicKey,scope:group[0].scope,entryIds:group.map(e=>e.entryId)}));
 for(const conflict of p.memoryMigration.conflicts)for(const id of conflict.entryIds)p.memoryEntries.find(e=>e.entryId===id).legacyConflict=true;
 return p;
}
const escapeLabel=value=>String(value).replace(/[\\\[\]]/g,'\\$&').replace(/[\r\n]/g,' ');
const INDEX_PAGE_SIZE=50;
const KIND_LABELS={brief:'项目概要',requirement:'需求',constraint:'约束',decision:'已定事项',open_question:'未定问题',observation:'观察',lesson:'经验',procedure:'操作步骤',reference:'参考资料'};
const STATUS_LABELS={active:'当前',candidate:'待确认',superseded:'已替代',archived:'已归档'};
export function indexDocument(project,entries){
 const pins=new Set(project.memoryIndexMeta.pinnedEntryIds);
 const priority=e=>e.kind==='brief'?0:pins.has(e.entryId)?1:e.kind==='constraint'?2:3;
 const ordered=[...entries].sort((a,b)=>priority(a)-priority(b)||a.logicalPath.localeCompare(b.logicalPath)),page=ordered.slice(0,INDEX_PAGE_SIZE);
 const lines=['# 项目记忆','',project.memoryIndexMeta.description||'项目概要、当前约定与经验的文件索引。','', '<!-- 自动生成的索引：链接由当前记录生成；说明和置顶项可单独编辑。 -->','',`索引版本：${project.memoryIndexMeta.revision}；记录版本：${project.memoryIndexRevision??0}。共 ${ordered.length} 条，本页 ${page.length} 条（第 1 页，每页最多 ${INDEX_PAGE_SIZE} 条）。`,'','概要、置顶项和关键约束优先。各条说明是正文开头的简短预览，不代表批准或验证结论；未定问题仍待决定。',''];
 for(const e of page)lines.push('- '+(pins.has(e.entryId)?'★ ':'')+'['+escapeLabel(e.name??e.logicalPath)+']('+e.logicalPath.split('/').map(encodeURIComponent).join('/')+') — '+(KIND_LABELS[e.kind]??e.kind)+' ('+e.kind+') · '+(STATUS_LABELS[e.status]??e.status)+' ('+e.status+') · r'+e.revision+(e.legacySource?' · legacy source':'')+(e.legacyConflict?' · legacy conflict: review current versions':'')+'\n  '+escapeLabel(describeMemoryEntry(e).description||'（正文为空）')+(describeMemoryEntry(e).descriptionTruncated?'…（字面预览已截断，非完整正文）':''));
 if(!ordered.length)lines.push('（当前范围没有符合筛选条件的记忆。）');
 if(ordered.length>page.length)lines.push('',`本页省略 ${ordered.length-page.length} 条链接；记录未删除。请在项目设置 → 记忆的文件列表翻页，或使用 project_memory_list 按 offset 翻页 / project_memory_search 查找，再按路径读取正文。不要把本页当作全部项目记忆。`);
 return lines.join('\n')+'\n';
}
