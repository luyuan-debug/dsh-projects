import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,readFile,readdir,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {writeFileSync} from 'node:fs';
import {ProjectEvidenceIndex,DONOR} from '../../src/product/memory/evidence-index.mjs';
import {tokenizeRaw,buildBm25} from '../../src/product/vendor/dsh-project-memory/util/search.js';
import {scanSymbols} from '../../src/product/vendor/dsh-project-memory/symbols.js';
import {entryIdPrefix} from '../../src/product/vendor/dsh-project-memory/util/entry-id.js';
const sha=s=>createHash('sha256').update(s).digest('hex');
const record=(entryId,content,extra={})=>({entryId,content,name:entryId,revision:1,status:'active',...extra});
async function fixture(t){const root=await mkdtemp(path.join(tmpdir(),'mem03-donor-'));t.after(()=>rm(root,{recursive:true,force:true}));return root}
const resource=root=>({root,resourceId:'resource-A',workspaceInstanceId:'workspace-A',version:1});

test('fixed donor tokenizer/BM25/chunker/symbol closure is the actual search path',async()=>{
 assert.equal(DONOR.commit,'21fc69e3e98f3864677e091477b7d543a0e54939');
 assert.ok(tokenizeRaw('工作树 calculateChecksum SaveState').includes('工作'));
 assert.equal(buildBm25([{text:'alpha beta'},{text:'omega'}],d=>d.text).score('alpha')[0].doc.text,'alpha beta');
 assert.equal(buildBm25([{text:'constructor __proto__ toString'}],d=>d.text).score('constructor')[0].score>0,true);
 const symbols=scanSymbols('src/save.ts','export class SaveState {\n calculateChecksum(value: string): number { return 1 }\n}\n');
 assert.ok(symbols.some(s=>s.title.startsWith('SaveState')));assert.ok(symbols.some(s=>s.title.startsWith('calculateChecksum')));
 assert.notEqual(entryIdPrefix('a b.md'),entryIdPrefix('a_b.md'));
 const r=await new ProjectEvidenceIndex().query({projectId:'P',query:'重启 checksum',records:[record('decision','重启后保留 checksum 决定')]});
 assert.equal(r.current[0].source.entryId,'decision');assert.equal(r.donor.mode,'lexical-only');assert.equal(r.health,'ready');
});

test('all active formal records remain searchable after the first fifty; history and candidate stay separate',async()=>{
 const records=Array.from({length:150},(_,i)=>record('r'+i,'ordinary filler '+i));records[129]=record('r129','游戏插件必须独立，Projects 只做可选兼容');
 records.push(record('old','游戏插件必须依赖 Projects',{status:'superseded'}),record('candidate','游戏插件独立候选内容',{status:'candidate'}),record('forgot','游戏插件独立口令',{status:'forgotten'}),record('other','游戏插件独立他项目',{projectId:'P2'}));
 const index=new ProjectEvidenceIndex();const r=await index.query({projectId:'P',query:'游戏插件必须依赖项目插件吗',records});
 assert.ok(r.current.some(e=>e.source.entryId==='r129'));assert.equal(r.history.length,0);assert.ok(r.current.every(e=>!['old','candidate','forgot','other'].includes(e.source.entryId)));
 const history=await index.query({projectId:'P',query:'游戏插件',records,includeHistory:true});assert.equal(history.history[0].source.entryId,'old');assert.equal(history.history[0].source.status,'superseded');
 const updated=await index.query({projectId:'P',query:'游戏插件',records:records.filter(e=>e.entryId!=='r129')});assert.equal(updated.current.length,0);
});

test('memory search exposes exact revision/path/status/scope/source metadata and unique chunk identities',async()=>{
 const logicalPath='decisions/storage.md',sourceRefs=[{kind:'message',sessionId:'session-A',sourceMessageId:'message-A'}];
 const records=[record('same-entry','# storage current plan\nstorage needle current choice.\n\n# storage current quota\nstorage needle current quota.',{logicalPath,revision:3,scope:{kind:'project'},sourceRefs}),record('same-entry','# storage previous plan\nstorage needle previous choice.\n\n# storage previous quota\nstorage needle previous quota.',{logicalPath,revision:2,status:'superseded',scope:{kind:'project'},sourceRefs}),record('archived-entry','storage needle archived thread rule',{logicalPath,revision:1,status:'archived',scope:{kind:'thread',threadId:'thread-A'},sourceRefs:[{kind:'message',sessionId:'session-B',sourceMessageId:'message-B',threadId:'thread-A'}]})];
 const index=new ProjectEvidenceIndex({chunkChars:64}),input={projectId:'P',query:'storage needle',records,includeHistory:true,limit:50};
 const result=await index.query(input);assert.ok(result.current.length>1);assert.ok(result.history.filter(row=>row.entryId==='same-entry').length>1);
 const hits=[...result.current,...result.history];assert.equal(new Set(hits.map(row=>row.id)).size,hits.length);
 for(const hit of hits){const sourceRecord=records.find(row=>row.entryId===hit.source.entryId&&row.revision===hit.source.version);assert.ok(sourceRecord);assert.equal(hit.entryId,sourceRecord.entryId);assert.equal(hit.logicalPath,logicalPath);assert.equal(hit.revision,sourceRecord.revision);assert.equal(hit.status,sourceRecord.status);assert.deepEqual(hit.scope,sourceRecord.scope);assert.deepEqual(hit.sourceRefs,sourceRecord.sourceRefs);assert.equal(hit.kind,sourceRecord.status==='active'?'current':'history');assert.equal(hit.source.logicalPath,logicalPath);assert.equal(hit.source.projectId,'P');assert.equal(hit.source.hash,sha(sourceRecord.content));assert.deepEqual(hit.source.scope,sourceRecord.scope);assert.deepEqual(hit.source.sourceRefs,sourceRecord.sourceRefs)}
 const repeated=await index.query(input);assert.deepEqual(repeated.current.map(hit=>hit.id),result.current.map(hit=>hit.id));assert.deepEqual(repeated.history.map(hit=>hit.id),result.history.map(hit=>hit.id));
 const currentOnly=await index.query({...input,includeHistory:false});assert.deepEqual(currentOnly.history,[]);assert.ok(currentOnly.current.every(hit=>hit.status==='active'&&hit.revision===3));
});

test('two projects and two workspaces sharing paths do not reuse facts or file identity',async t=>{
 const a=await fixture(t),b=await fixture(t);await mkdir(path.join(a,'src'));await mkdir(path.join(b,'src'));await writeFile(path.join(a,'src/save.ts'),'export function calculateChecksum() { return "ALPHA"; }');await writeFile(path.join(b,'src/save.ts'),'export function calculateChecksum() { return "BETA"; }');
 const index=new ProjectEvidenceIndex();const ra=await index.query({projectId:'P-A',query:'calculateChecksum',records:[record('shared','ALPHA formal')],resources:[resource(a)]});
 const rb=await index.query({projectId:'P-A',query:'calculateChecksum',records:[record('shared','ALPHA formal')],resources:[{...resource(b),workspaceInstanceId:'workspace-B'}]});
 assert.ok(ra.evidence.some(e=>e.text.includes('ALPHA')));assert.ok(!rb.evidence.some(e=>e.text.includes('ALPHA')));assert.ok(rb.evidence.some(e=>e.text.includes('BETA')));assert.notEqual(ra.evidence[0].source.hash,rb.evidence[0].source.hash);
 const other=await index.query({projectId:'P-B',query:'ALPHA',records:[record('shared','P-B ONLY')],resources:[]});assert.equal(other.current.length,0);assert.equal(other.evidence.length,0);
});

test('scan excludes symlinks, credential names, binary/hidden files, gitignore and explicit exclusions',async t=>{
 const root=await fixture(t),outside=await fixture(t);await writeFile(path.join(outside,'outside.md'),'hiddenleak');await mkdir(path.join(root,'docs'));await mkdir(path.join(root,'node_modules'));await mkdir(path.join(root,'ignored'));await mkdir(path.join(root,'nested'));
 await writeFile(path.join(root,'.gitignore'),'ignored/\n*.draft.md\n');await writeFile(path.join(root,'nested/.gitignore'),'omit.md\n');
 for(const file of ['.private.md','credentials.json','secrets.json','dump.md','omit.md','sample.draft.md','node_modules/leak.md','ignored/leak.md','nested/omit.md'])await writeFile(path.join(root,file),file==='dump.md'?Buffer.from('hiddenleak\0binary'):'hiddenleak');
 await writeFile(path.join(root,'docs/good.md'),'visibleevidence 工作树编辑器绑定错误');await symlink(path.join(outside,'outside.md'),path.join(root,'link.md'));await symlink(outside,path.join(root,'linked'));
 const before=await readdir(root);const r=await new ProjectEvidenceIndex().query({projectId:'P',query:'hiddenleak visibleevidence',resources:[{...resource(root),excludes:['omit.md']}]});
 assert.ok(r.evidence.length>0);assert.ok(r.evidence.every(e=>e.source.path==='docs/good.md'));assert.ok(!r.evidence.some(e=>e.text.includes('hiddenleak')));assert.deepEqual(await readdir(root),before);
});

test('file hash changes invalidate chunks; selected source hash is rechecked after ranking',async t=>{
 const root=await fixture(t),file=path.join(root,'doc.md');await writeFile(file,'ALPHA fact');const index=new ProjectEvidenceIndex();
 const a=await index.query({projectId:'P',query:'ALPHA',resources:[resource(root)]});assert.equal(a.evidence[0].source.hash,sha('ALPHA fact'));
 await writeFile(file,'BETA fact');assert.equal((await index.query({projectId:'P',query:'ALPHA',resources:[resource(root)]})).evidence.length,0);
 const b=await index.query({projectId:'P',query:'BETA',resources:[resource(root)]});assert.equal(b.evidence[0].source.hash,sha('BETA fact'));assert.ok(b.stats.cacheHits>0);
});

test('an actual file edit after extraction drops the stale ranked citation',async t=>{
 const root=await fixture(t),file=path.join(root,'doc.md');await writeFile(file,'originalneedle from snapshot');let edited=false;const source={...resource(root),get commit(){if(!edited){edited=true;writeFileSync(file,'replacement only')}return 'synthetic-commit'}};
 const result=await new ProjectEvidenceIndex().query({projectId:'P',query:'originalneedle',resources:[source]});assert.equal(result.evidence.length,0);assert.ok(result.warnings.includes('SOURCE_CHANGED: doc.md'));
});

test('nested gitignore patterns, negation, anchored paths and bounded scans are visible',async t=>{
 const root=await fixture(t);await mkdir(path.join(root,'docs'));await writeFile(path.join(root,'.gitignore'),'*.md\n!keep.md\n/rootonly.txt\n');
 for(const f of ['ignore.md','keep.md','rootonly.txt','docs/rootonly.txt'])await writeFile(path.join(root,f),'boundedneedle');
 const result=await new ProjectEvidenceIndex().query({projectId:'P',query:'boundedneedle',resources:[resource(root)]});assert.deepEqual(result.evidence.map(e=>e.source.path).sort(),['docs/rootonly.txt','keep.md']);
 const bounded=await new ProjectEvidenceIndex({maxFiles:1}).query({projectId:'P',query:'boundedneedle',resources:[resource(root)]});assert.ok(bounded.warnings.includes('INDEX_FILE_LIMIT'));assert.ok(bounded.stats.filesIndexed<=1);
});

test('symbols preserve donor language rules and ignore declarations inside comments/strings',()=>{
 const examples=[['save.py','class SaveState:\n    def checksum(self):\n        return 1\n','SaveState'],['save.go','func calculateChecksum(v string) int {\n return 1\n}\n','calculateChecksum'],['save.rs','pub fn calculate_checksum() -> u64 { 1 }','calculate_checksum'],['save.cs','public class SaveState {\n public int CalculateChecksum() {\n return 1;\n }\n}\n','CalculateChecksum'],['save.sh','calculate_checksum() {\n echo ok\n}\n','calculate_checksum']];
 for(const [file,text,name]of examples)assert.ok(scanSymbols(file,text).some(s=>s.keywords.includes(name)),file);
 const symbols=scanSymbols('sample.ts','// export function fakeComment() {}\nconst quote = "export function fakeString() {}";\nexport function realSymbol() {}\n');assert.ok(symbols.some(s=>s.keywords.includes('realSymbol')));assert.ok(!symbols.some(s=>/fake/.test(s.title)));
});

test('Library uses existing reader text and page/paragraph/cell/slide locations, no filename-only image recall',async()=>{
 const items=[{itemId:'pdf',name:'guide.pdf',version:2,sha256:'pdf-hash'},{itemId:'cell',name:'sheet.xlsx',version:3,sha256:'cell-hash'},{itemId:'image',name:'needle.png',version:1,sha256:'image-hash'}];
 const readLibrary=async item=>item.itemId==='pdf'?{version:2,sha256:'pdf-hash',records:[{page:4,text:'needle physical page text'}],readable:true}:item.itemId==='cell'?{version:3,sha256:'cell-hash',sheet:'Sheet1',records:[{cell:'B9',value:'needle cell text'}],readable:true}:{readable:false,visualAvailable:true};
 const r=await new ProjectEvidenceIndex().query({projectId:'P',query:'needle',libraryItems:items,readLibrary});assert.equal(r.evidence.length,2);assert.equal(r.evidence.find(e=>e.source.itemId==='pdf').source.page,4);assert.equal(r.evidence.find(e=>e.source.itemId==='cell').source.cell,'B9');assert.ok(r.warnings.some(w=>w.includes('LIBRARY_NO_INDEXABLE_TEXT: image')));
});

test('Library replace mismatch is visible and cannot return old evidence',async()=>{
 const r=await new ProjectEvidenceIndex().query({projectId:'P',query:'OLD',libraryItems:[{itemId:'d',name:'doc.md',version:2}],readLibrary:async()=>({version:1,text:'OLD',readable:true})});assert.equal(r.evidence.length,0);assert.ok(r.warnings.some(w=>w.includes('LIBRARY_CONFLICT')));
});

test('late read cannot commit after permission revocation, cancellation, or clear',async()=>{
 for(const action of ['revoke','abort','clear']){const index=new ProjectEvidenceIndex(),controller=new AbortController();let allowed=true,release;const gate=new Promise(r=>{release=r});let started;const begin=new Promise(r=>{started=r});const result=index.query({projectId:'P',query:'needle',signal:controller.signal,libraryItems:[{itemId:'d',name:'doc.md',version:1}],readLibrary:async()=>{started();await gate;return {text:'needle',readable:true}},validate:()=>allowed});await begin;if(action==='revoke')allowed=false;if(action==='abort')controller.abort();if(action==='clear')index.clear();release();await assert.rejects(result);assert.equal(index.files.size,0);assert.equal(index.corpora.size,0)}
});

test('missing roots and partial reader failures degrade evidence while formal memory remains usable',async()=>{
 const r=await new ProjectEvidenceIndex().query({projectId:'no-repo',query:'决定',records:[record('r','当前决定')],resources:[],libraryItems:[{itemId:'bad',name:'bad.pdf',version:1}],readLibrary:async()=>{throw Object.assign(Error('reader failed'),{code:'READER_FAILED'})}});assert.equal(r.current.length,1);assert.equal(r.stats.filesVisited,0);assert.equal(r.health,'degraded');assert.ok(r.warnings.some(w=>w.includes('READER_FAILED')));
});

test('vendor imports exclude donor apply, tasks, global store, model, vector, and any file-reading entrypoint',async()=>{
 const root=new URL('../../src/product/vendor/dsh-project-memory/',import.meta.url),files=['chunker.js','symbols.js','doc-index.js','util/search.js','util/text.js','util/entry-id.js'];for(const f of files){const body=await readFile(new URL(f,root),'utf8');const imports=[...body.matchAll(/(?:from\s+|import\s*\()['"]([^'"]+)/g)].map(m=>m[1]);assert.ok(imports.every(s=>s.startsWith('./util/')||s==='./util/search.js'),f+' has unexpected imports '+imports);assert.ok(!/\b(?:fetch|readFileSync|execFile|spawn|leanvec)\s*\(/.test(body))}
});
