/** Literal, bounded link descriptions. No model, retrieval or persistence. */
export const MEMORY_DESCRIPTION_CODEPOINTS=100;
export function describeMemoryEntry(entry){
 const lines=String(entry.content??'').split(/\r?\n/).map(line=>line.trim()).filter(Boolean);
 const points=Array.from(lines[0]??'');
 return {description:points.slice(0,MEMORY_DESCRIPTION_CODEPOINTS).join(''),descriptionTruncated:points.length>MEMORY_DESCRIPTION_CODEPOINTS||lines.length>1};
}
export function memoryIndexEntry(entry){
 return {path:entry.logicalPath,id:entry.entryId,name:entry.name??entry.logicalPath,topicKey:entry.topicKey??entry.logicalPath,kind:entry.kind,revision:entry.revision,status:entry.status??'active',scope:entry.scope??{kind:'project'},...describeMemoryEntry(entry)};
}
/** Usage receipts carry identities/layers only, never descriptions or user titles. */
export function memoryIndexReference(entry){
 return {entryId:entry.entryId??entry.id,revision:entry.revision,logicalPath:entry.logicalPath??entry.path,kind:entry.kind,status:entry.status??'active',scope:entry.scope??{kind:'project'},descriptionTruncated:entry.descriptionTruncated===true,delivery:'index-preview'};
}
