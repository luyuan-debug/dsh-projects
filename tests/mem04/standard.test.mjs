import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {ProjectEvidenceIndex} from '../../src/product/memory/evidence-index.mjs';
import {indexDocument} from '../../src/product/domain/canonical-memory.mjs';
import {decisionIntent} from '../../src/product/memory/context.mjs';

async function rootFixture(t){const root=await mkdtemp(path.join(tmpdir(),'mem04-standard-'));t.after(()=>rm(root,{recursive:true,force:true}));return root;}
async function source(root,name,body){const file=path.join(root,name);await mkdir(path.dirname(file),{recursive:true});await writeFile(file,body);}
const resource=root=>({root,resourceId:'synthetic-resource',workspaceInstanceId:'synthetic-workspace',version:1});

test('Standard indexes authentication source identifiers and Godot/.NET/workflow text with honest line locations',async t=>{
 const root=await rootFixture(t),files={
  'src/auth.ts':'export function verifySession() { return "authlogicneedle"; }',
  'src/tokens.ts':'export const tokenName = "refreshlogicneedle";',
  'src/cookie_parser.py':'def parse_cookie(value):\n    return "cookielogicneedle"',
  'src/auth/session.ts':'export const name = "authdirectoryneedle";',
  'project.godot':'[application]\nconfig/name="godotprojectneedle"',
  'scenes/main.tscn':'[gd_scene format=3]\n[node name="sceneneedle" type="Node"]',
  'assets/world.tres':'[gd_resource type="Resource" format=3]\nresource_name="resourceneedle"',
  'addons/native.gdextension':'[configuration]\nentry_symbol="extensionneedle"',
  'Demo.csproj':'<Project><PropertyGroup><Description>csprojectneedle</Description></PropertyGroup></Project>',
  'Demo.sln':'Microsoft Visual Studio Solution File\nProject = "solutionneedle"',
  'Directory.Build.props':'<Project><PropertyGroup><Label>propsneedle</Label></PropertyGroup></Project>',
  'Directory.Build.targets':'<Project><Target Name="targetsneedle" /></Project>',
  '.github/workflows/check.yml':'name: workflowneedle\non: [push]\njobs: {}',
 };
 for(const [name,body] of Object.entries(files))await source(root,name,body);
 const index=new ProjectEvidenceIndex();
 for(const [name,body] of Object.entries(files)){
  const needle=body.match(/[a-z]+needle/)[0],result=await index.query({projectId:'P',query:needle,resources:[resource(root)]});
  assert.ok(result.evidence.some(hit=>hit.source.path===name&&hit.text.includes(needle)),name);
  const hit=result.evidence.find(hit=>hit.source.path===name);assert.equal(hit.source.kind,'code');assert.ok(Number.isSafeInteger(hit.source.line)&&hit.source.line>=1);assert.ok(hit.source.hash);assert.equal(result.stats.filesIndexed,Object.keys(files).length);
 }
});

test('Standard reports skipped reasons and rejects credential values, artifacts, caches, hidden paths and symlink escapes',async t=>{
 const root=await rootFixture(t),outside=await rootFixture(t),secret='ghp_'+'A'.repeat(32),fixtures={
  'src/auth.ts':'export const verify = "visiblelogicneedle";',
  'src/leaked.ts':'export const credential = "'+secret+'"; // protectedneedle',
  'src/basic.ts':'export const headers = { Authorization: "Bearer abcdef0123456789ABCDEF0123456789" }; // protectedneedle',
  'src/key.py':'private = "-----BEGIN PRIVATE KEY-----" # protectedneedle',
  'src/password.ts':'const password = "Abcd0123456789.Qwerty!"; // protectedneedle',
  'credentials.json':'{"key":"protectedneedle"}',
  'tokens.json':'{"key":"protectedneedle"}',
  '.env':'SECRET=protectedneedle',
  '.hidden.md':'protectedneedle',
  '.github/actions/hidden.yml':'protectedneedle',
  'node_modules/pkg/leak.ts':'protectedneedle',
  'obj/build.cs':'protectedneedle',
  'ignored/item.md':'protectedneedle',
  '.gitignore':'ignored/\n',
  'archive.exe':'protectedneedle',
  'binary.md':Buffer.from('protectedneedle\0binary'),
 };
 for(const [name,body] of Object.entries(fixtures))await source(root,name,body);
 await source(outside,'outside.md','protectedneedle');await symlink(path.join(outside,'outside.md'),path.join(root,'linked.md'));await symlink(outside,path.join(root,'linked-dir'));
 const result=await new ProjectEvidenceIndex().query({projectId:'P',query:'protectedneedle visiblelogicneedle',resources:[resource(root)]});
 assert.ok(result.evidence.some(hit=>hit.source.path==='src/auth.ts'));assert.ok(result.evidence.every(hit=>hit.source.path==='src/auth.ts'));
 const skipped=result.stats.skipped;assert.equal(skipped.credentialContent,4);assert.equal(skipped.credentialArtifact,2);assert.equal(skipped.symlink,2);assert.ok(skipped.hidden>=3);assert.equal(skipped.buildCache,2);assert.equal(skipped.ignored,1);assert.equal(skipped.nonText,1);assert.equal(skipped.unsupportedFormat,1);
 assert.ok(!JSON.stringify(result).includes(secret));assert.ok(!JSON.stringify(result.warnings).includes('protectedneedle'));
 await assert.rejects(new ProjectEvidenceIndex().query({projectId:'P',query:'visiblelogicneedle',resources:[resource(root)],validate:()=>false}),{code:'MEMORY_EVIDENCE_REVOKED'});
});

test('Standard keeps size and scan limits explicit after format expansion',async t=>{
 const root=await rootFixture(t);await source(root,'project.godot','x'.repeat(400));await source(root,'source.csproj','needle bounded');
 const result=await new ProjectEvidenceIndex({maxFileBytes:100}).query({projectId:'P',query:'needle',resources:[resource(root)]});
 assert.equal(result.stats.skipped.fileSizeLimit,1);assert.ok(result.warnings.includes('FILE_SIZE_LIMIT: project.godot'));assert.ok(result.evidence.some(hit=>hit.source.path==='source.csproj'));
 const bounded=await new ProjectEvidenceIndex({maxFiles:1}).query({projectId:'P',query:'needle',resources:[resource(root)]});assert.ok(bounded.stats.filesIndexed<=1);assert.ok(bounded.warnings.includes('INDEX_FILE_LIMIT'));
});

test('Standard admits a clear local decision alongside an independent execution question and keeps ambiguity candidate',()=>{
 for(const [text,quote] of [
  ['我们已经决定采用B。下一步怎么做？','我们已经决定采用B'],
  ['我们已经决定采用B。下一步怎么做？',undefined],
  ['我们已决定采用B。下一步如果失败怎么回退？','我们已决定采用B'],
  ['我们已决定采用B。下一步如果失败怎么回退？',undefined],
  ['我不同意A，我们决定采用B。','我们决定采用B'],
  ['之前没有同意A，现在统一采用B。','现在统一采用B'],
  ['我们先用B，后面再评估。','我们先用B'],
  ['不采用云执行，改为本地执行。','不采用云执行，改为本地执行'],
 ])assert.equal(decisionIntent(text,quote),true,text);
 for(const [text,quote] of [
  ['采用B。你觉得呢？','采用B'],
  ['是不是应该采用B？','采用B'],
  ['如果采用B，下一步怎么做？','采用B'],
  ['我在引用别人说“必须采用A”，但这不是我的决定。','必须采用A'],
  ['采用B。我们还没有同意。','采用B'],
  ['采用B。我不同意。','采用B'],
  ['采用B。我们没同意。','采用B'],
  ['假设如下。采用B。你觉得呢？','采用B'],
  ['假设如下。采用B。','采用B'],
  ['这只是候选，暂不决定采用B。','暂不决定采用B'],
 ])assert.equal(decisionIntent(text,quote),false,text);
});

test('MEMORY.md first page is bounded, useful and explicit about categories, revisions and omitted links',()=>{
 const entries=Array.from({length:120},(_,i)=>({entryId:'entry-'+i,logicalPath:'notes/'+String(i).padStart(3,'0')+'.md',name:'记录 '+i,kind:'observation',status:'active',revision:i+1,content:'条目用途 '+i+'。'+'正文'.repeat(100)}));
 entries.push({entryId:'brief',logicalPath:'z/brief.md',kind:'brief',status:'active',revision:3,content:'项目概要说明。'});
 entries.push({entryId:'pin',logicalPath:'z/pinned.md',kind:'decision',status:'active',revision:5,content:'已确认的置顶事项。'});
 entries.push({entryId:'constraint',logicalPath:'z/constraint.md',kind:'constraint',status:'active',revision:2,content:'不能修改正式 Profile。'});
 entries.push({entryId:'question',logicalPath:'a/question.md',kind:'open_question',status:'active',revision:1,content:'是否增加云端支持？'});
 const project={memoryIndexMeta:{description:'这是索引说明。',revision:7,pinnedEntryIds:['pin']},memoryIndexRevision:19},document=indexDocument(project,entries),links=document.match(/^-[^\n]*\]\(/gm)??[];
 assert.equal(links.length,50);assert.ok(document.indexOf('z/brief.md')<document.indexOf('z/pinned.md'));assert.ok(document.indexOf('z/pinned.md')<document.indexOf('z/constraint.md'));assert.ok(document.indexOf('z/constraint.md')<document.indexOf('notes/000.md'));
 for(const part of ['这是索引说明。','共 124 条','本页 50 条','每页最多 50 条','省略 74 条','索引版本：7','记录版本：19','未定问题 (open_question)','待决定','条目用途 0。','r5','project_memory_list','project_memory_search'])assert.ok(document.includes(part),part);
 assert.ok(!document.includes('notes/119.md'));assert.ok(document.includes('…'));assert.ok(document.length<20000);
 // The index is a preview only; canonical input is untouched and every entry remains available to list/search/file read.
 assert.equal(entries.length,124);assert.equal(entries[119].logicalPath,'notes/119.md');assert.equal(indexDocument(project,[]).includes('本页 0 条'),true);
});
