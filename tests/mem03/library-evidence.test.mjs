import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,realpath,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {Projects} from '../../src/product/domain/projects.mjs';
import {ProjectKnowledge} from '../../src/product/domain/project-knowledge.mjs';
import {LibraryBlobs} from '../../src/product/backends/local/library-blobs.mjs';
import {ProjectEvidenceIndex} from '../../src/product/memory/evidence-index.mjs';
import {readLibraryEvidence,LIBRARY_EVIDENCE_LIMITS} from '../../src/product/memory/library-evidence.mjs';
const fixtures=fileURLToPath(new URL('../fixtures/readers/',import.meta.url));
const user={kind:'user',origin:'user_instruction',source:{kind:'user-input'}};
async function fixture(t){const root=await realpath(await mkdtemp(join(tmpdir(),'mem03-library-evidence-'))),data=new Map(),table={get:k=>structuredClone(data.get(k)),entries:()=>[...data].map(([k,v])=>[k,structuredClone(v)]),put:async(k,v)=>data.set(k,structuredClone(v))},registry=new Projects({table,createScope:async()=>({projectId:randomUUID(),coordinatorSessionId:randomUUID()}),validateModel:async()=>{}}),project=await registry.create({name:'Library evidence synthetic fixture'}),blobs=new LibraryBlobs(join(root,'blobs')),knowledge=new ProjectKnowledge({registry,blobs});await knowledge.initialize();t.after(()=>rm(root,{recursive:true,force:true}));
 return {root,knowledge,blobs,projectId:project.projectId,publish:async(name,bytes=undefined)=>{const staged=await blobs.stage([bytes??await readFile(join(fixtures,name))],name),result=await knowledge.publish(project.projectId,{name,operationId:randomUUID()},user,staged);return result.item}}}
async function search(f,item,query){return new ProjectEvidenceIndex().query({projectId:f.projectId,query,libraryItems:[item],readLibrary:item=>readLibraryEvidence(f.knowledge,f.projectId,item)})}

test('real LibraryBlobs and ProjectKnowledge text pages exceed 64KiB without READ_LIMIT or UTF8 loss',async t=>{
 const f=await fixture(t),content='中文 evidence marker paginated '.repeat(5000),item=await f.publish('long.txt',Buffer.from(content)),value=await readLibraryEvidence(f.knowledge,f.projectId,item);
 assert.equal(value.content,content);assert.equal(value.truncated,false);assert.ok(value.evidenceRead.calls>1);assert.ok(value.evidenceRead.bytes>65536);assert.equal(value.nextOffset,Buffer.byteLength(content));assert.equal(value.previewTruncated,true);assert.ok(Buffer.byteLength(value.text)<=65536);
 assert.ok((await search(f,item,'paginated')).evidence.length>0);
});

test('actual PDF reader preserves physical page sources and does not turn scanned page into filename body',{skip:process.platform!=='darwin'||process.arch!=='arm64'},async t=>{
 const f=await fixture(t),item=await f.publish('known.pdf'),value=await readLibraryEvidence(f.knowledge,f.projectId,item);assert.ok(value.records.some(r=>r.page===1&&r.text.includes('PDF-3710')));assert.ok(value.records.some(r=>r.page===2&&r.hasTextLayer===false));assert.equal(value.truncated,false);
 const hits=await search(f,item,'PDF-3710');assert.ok(hits.evidence.some(h=>h.source.page===1));assert.ok(hits.evidence.every(h=>h.source.hash===item.sha256));
 const image=await f.publish('visual.png'),v=await readLibraryEvidence(f.knowledge,f.projectId,image);assert.equal(v.readable,false);assert.equal(v.text,undefined);
});

test('actual DOCX reader returns paragraphs and table cells with part locations',async t=>{
 const f=await fixture(t),item=await f.publish('known.docx'),value=await readLibraryEvidence(f.knowledge,f.projectId,item);assert.ok(value.records.some(r=>r.text?.includes('DOCX-4821')));assert.ok(value.records.some(r=>r.kind==='table'&&r.rows[1][1].text==='73'));assert.equal(value.truncated,false);
 const hits=await search(f,item,'DOCX-4821');assert.ok(hits.evidence.some(h=>h.source.part?.startsWith('word/document.xml/')));
 const cells=await search(f,item,'73');assert.ok(cells.evidence.some(h=>h.source.part?.includes('/tc[')));
});

test('actual XLSX reader collects sheet identity, cell address and honestly reports the bounded ranges',async t=>{
 const f=await fixture(t),item=await f.publish('known.xlsx'),value=await readLibraryEvidence(f.knowledge,f.projectId,item);assert.equal(value.records.find(r=>r.sheet==='预算表'&&r.cell==='B2').value,'73');assert.ok(value.indexedRanges.some(r=>r.sheet==='预算表'&&r.range==='A1:T50'));assert.equal(value.truncated,true);assert.ok(value.warnings.some(w=>w.startsWith('XLSX_INDEX_RANGE_LIMIT')));
 const hits=await search(f,item,'73');assert.ok(hits.evidence.some(h=>h.source.sheet==='预算表'&&h.source.cell==='B2'));assert.ok(hits.warnings.some(w=>w.startsWith('XLSX_INDEX_RANGE_LIMIT')));
});

test('actual PPTX reader keeps slide text and table values, without speaker notes being auto-indexed',async t=>{
 const f=await fixture(t),item=await f.publish('known.pptx'),value=await readLibraryEvidence(f.knowledge,f.projectId,item);assert.ok(value.records.some(r=>r.shapes.some(s=>s.paragraphs?.some(p=>p.includes('PPTX-5932')))));assert.ok(!JSON.stringify(value.records).includes('NOTES-6043'));
 const hits=await search(f,item,'PPTX-5932');assert.ok(hits.evidence.some(h=>h.source.slide===1));const tables=await search(f,item,'17');assert.ok(tables.evidence.some(h=>h.source.slide===1&&h.text.includes('17')));
});

test('real oversized structured serialization is paged before parsing and over-limit JSON is never indexed',async t=>{
 const f=await fixture(t);const build=count=>execFileSync('/usr/bin/python3',['-I','-c',`import sys,zipfile,io
base=sys.argv[1];count=int(sys.argv[2]);out=io.BytesIO()
with zipfile.ZipFile(base) as source,zipfile.ZipFile(out,'w',compression=zipfile.ZIP_STORED) as dest:
 for name in source.namelist():
  data=source.read(name)
  if name=='word/document.xml':data=('<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>serializedneedle '+('x'*count)+'</w:t></w:r></w:p></w:body></w:document>').encode()
  dest.writestr(name,data)
sys.stdout.buffer.write(out.getvalue())`,join(fixtures,'known.docx'),String(count)],{maxBuffer:2*1024*1024});
 const item=await f.publish('paged.docx',build(90000)),value=await readLibraryEvidence(f.knowledge,f.projectId,item);assert.equal(value.truncated,false);assert.ok(value.evidenceRead.calls>1);assert.ok(value.records[0].text.startsWith('serializedneedle '));assert.equal(value.records[0].text.length,90000+'serializedneedle '.length);assert.equal(value.previewTruncated,true);assert.ok(Buffer.byteLength(value.text)<=65536);assert.ok(value.text.startsWith('[word/document.xml/'));
 const giant=await f.publish('bounded.docx',build(600000)),bounded=await readLibraryEvidence(f.knowledge,f.projectId,giant);assert.equal(bounded.truncated,true);assert.deepEqual(bounded.records,[]);assert.equal(bounded.nextStart,1);assert.ok(bounded.evidenceRead.bytes<=LIBRARY_EVIDENCE_LIMITS.totalBytes);assert.ok(bounded.warnings.includes('LIBRARY_EVIDENCE_BYTE_LIMIT'));assert.equal((await search(f,giant,'serializedneedle')).evidence.length,0);
});

test('cancellation and Library replace revoke an actual reader result',async t=>{
 const f=await fixture(t),item=await f.publish('known.docx'),controller=new AbortController();controller.abort();await assert.rejects(readLibraryEvidence(f.knowledge,f.projectId,item,controller.signal),{name:'AbortError'});
 const staged=await f.blobs.stage([Buffer.from('replacement')],'known.docx');await f.knowledge.publish(f.projectId,{name:'known.docx',operationId:randomUUID(),replaceItemId:item.itemId,expectedVersion:item.version},user,staged);await assert.rejects(readLibraryEvidence(f.knowledge,f.projectId,item),{code:'LIBRARY_CONFLICT'});
});
