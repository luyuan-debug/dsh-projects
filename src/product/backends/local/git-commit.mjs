import {mkdir,open,readFile,writeFile,rename,unlink,lstat,copyFile,realpath,readlink} from 'node:fs/promises';
import {join,relative,resolve,isAbsolute} from 'node:path';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import {fail,copy,text,stableKey} from '../../domain/projects.mjs';
import {git,safeRepository,contained,repoSerial,readGitIndex,assertRepositoryLease,repoMetadata} from './workspace-files.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
const optionalRead=readGitIndex;
async function boundBytes(root,path){const fd=await open(path,constants.O_RDONLY|constants.O_NOFOLLOW);try{const s=await fd.stat({bigint:true}),physical=await realpath(path),current=await lstat(path,{bigint:true});if(!s.isFile()||current.isSymbolicLink()||s.ino!==current.ino||s.dev!==current.dev||!contained(root,physical))fail('COMMIT_FILE_IDENTITY','File identity or scope changed');const bytes=await fd.readFile(),after=await fd.stat({bigint:true});if(s.mtimeNs!==after.mtimeNs||s.size!==after.size)fail('GIT_CONCURRENT_EDIT','File changed while being read');return bytes;}finally{await fd.close()}}
async function boundEntry(root,path){
 const parent=await realpath(resolve(path,'..'));if(!contained(root,parent))fail('COMMIT_PATH_IDENTITY','Commit parent is outside the binding');
 let st;try{st=await lstat(path)}catch(e){if(e.code==='ENOENT')return {mode:'0',data:Buffer.alloc(0),deleted:true};throw e;}
 if(st.isSymbolicLink())return {mode:'120000',data:Buffer.from(await readlink(path)),deleted:false};
 if(!st.isFile())fail('COMMIT_FILE_TYPE','Select explicit file or symlink paths, not directories or submodules');
 return {mode:st.mode&0o111?'100755':'100644',data:await boundBytes(root,path),deleted:false};
}
async function unchanged(root,f){const v=await boundEntry(root,f.path);if(v.mode!==f.mode||v.deleted!==f.deleted||hash(v.data)!==f.sha256)fail('GIT_CONCURRENT_EDIT','Selected path changed during commit');return v.data;}
/** Narrow local metadata adapter. No push, merge, reset, helper execution or blanket staging. */
export class ScopedGit {
 constructor({control,tables,root,fault=async()=>{}}){Object.assign(this,{control,tables,root,fault});}
 async commit({sessionId,operationId,paths,message}){
  const binding=await this.control.admit(sessionId);text(message,'commit message',16000);
  if(!Array.isArray(paths)||paths.length<1||paths.some(p=>typeof p!=='string'||!p||p.includes('\0')||isAbsolute(p)))fail('COMMIT_PATHS','Choose explicit relative file paths');
  const repo=await safeRepository(binding.workspacePath);
  if(!repo?.head||!repo.branch)fail('COMMIT_TOPOLOGY_UNSUPPORTED','A committed attached local branch is required');
  return repoSerial(repo.commonDir,()=>this.perform(binding,repo,{operationId:stableKey('git-commit',binding.bindingId,operationId),paths:[...new Set(paths)].sort(),message}));
 }
 async perform(binding,repo,input){
  const old=this.tables.operations.get(input.operationId);
  if(old?.kind==='git-commit'){
   if(old.bindingId!==binding.bindingId||JSON.stringify(old.paths)!==JSON.stringify(input.paths)||old.message!==input.message)fail('COMMIT_OPERATION_CONFLICT','Operation identity already names another commit');
   if(old.phase==='completed'&&old.noChanges){await this.control.admit(binding.threadSessionId);if(repo.head!==old.commit||hash(await optionalRead(join(repo.gitDir,'index')))!==old.beforeIndexSha256)fail('GIT_IDENTITY_CHANGED','Repository changed after the no-change operation');return copy(old);}
   return this.reconcile(old,binding,repo);
  }
  if(repo.commonDir!==binding.repo?.commonDir||repo.gitDir!==binding.repo?.gitDir||repo.branch!==binding.repo?.branch||repo.head!==binding.repo?.head)fail('GIT_IDENTITY_CHANGED','Repository branch/head changed; no commit was attempted');
  const indexPath=join(repo.gitDir,'index'),beforeIndex=await optionalRead(indexPath);
  if(hash(beforeIndex)!==binding.baseline?.indexSha256)fail('GIT_INDEX_CHANGED','Index changed after authorization; unrelated staging was preserved');
  const files=[];
  for(const name of input.paths){
   const path=resolve(binding.workspacePath,name),relativeRepo=relative(repo.root,path);
   if(!contained(binding.workspacePath,path)||relativeRepo.split('/').includes('.git'))fail('COMMIT_PATH_SCOPE','Commit paths must stay inside this binding');
   if(binding.baseline.preexisting.includes(relativeRepo))fail('GIT_PREEXISTING_CHANGES','Selected path had pre-existing user changes; it was preserved');
   const v=await boundEntry(binding.workspacePath,path);files.push({path,name,relativeRepo,sha256:hash(v.data),mode:v.mode,deleted:v.deleted});
  }
  const indexLock=await open(indexPath+'.lock','wx',0o600);const lockIdentity=await indexLock.stat();
  let op;
  try{
   if(hash(await optionalRead(indexPath))!==hash(beforeIndex))fail('GIT_INDEX_CHANGED','Index changed before lock acquisition');
   await mkdir(this.root,{recursive:true,mode:0o700});const commitIndex=join(this.root,input.operationId+'-commit.index'),userIndex=join(this.root,input.operationId+'-user.index');
   await git(repo.root,['read-tree',repo.head],{env:{GIT_INDEX_FILE:commitIndex}});
   if(beforeIndex.length)await writeFile(userIndex,beforeIndex,{mode:0o600});else await git(repo.root,['read-tree',repo.head],{env:{GIT_INDEX_FILE:userIndex}});
   op={kind:'git-commit',...input,bindingId:binding.bindingId,sessionId:binding.threadSessionId,grantId:binding.grantId,grantVersion:binding.grantVersion,expectedHead:repo.head,expectedBranch:repo.branch,gitDir:repo.gitDir,commonDir:repo.commonDir,beforeIndexSha256:hash(beforeIndex),commitIndex,userIndex,files,phase:'prepared',createdAt:Date.now()};
   await this.tables.operations.put(op.operationId,op);await this.fault('commit-prepared',op);
   const entries=[];
   for(const f of files){
    const bytes=await unchanged(binding.workspacePath,f);
    if(f.deleted){entries.push('0 '+('0'.repeat(repo.head.length))+'\t'+f.relativeRepo+'\0');continue;}
    const filter=f.mode==='120000'?['--no-filters']:['--path='+f.relativeRepo];
    const oid=(await git(repo.root,['hash-object','-w',...filter,'--stdin'],{input:bytes})).stdout.trim();entries.push(f.mode+' '+oid+'\t'+f.relativeRepo+'\0');
   }
   for(const path of [commitIndex,userIndex])await git(repo.root,['update-index','-z','--index-info'],{env:{GIT_INDEX_FILE:path},input:entries.join('')});
   const tree=(await git(repo.root,['write-tree'],{env:{GIT_INDEX_FILE:commitIndex}})).stdout.trim(),oldTree=(await git(repo.root,['rev-parse','HEAD^{tree}'])).stdout.trim();
   if(tree===oldTree){op={...op,phase:'completed',noChanges:true,commit:repo.head};await this.tables.operations.put(op.operationId,op);return copy(op);}
   const date=new Date(op.createdAt).toISOString();const env={GIT_AUTHOR_NAME:'DSH Project Thread',GIT_AUTHOR_EMAIL:'dsh-thread@localhost',GIT_COMMITTER_NAME:'DSH Project Thread',GIT_COMMITTER_EMAIL:'dsh-thread@localhost',GIT_AUTHOR_DATE:date,GIT_COMMITTER_DATE:date};
   const commit=(await git(repo.root,['commit-tree',tree,'-p',repo.head,'-m',input.message],{env})).stdout.trim();
   op={...op,phase:'commit-created',tree,commit,newIndexSha256:hash(await readFile(userIndex))};await this.tables.operations.put(op.operationId,op);await this.fault('commit-object-created',op);
   for(const f of files)await unchanged(binding.workspacePath,f);
   await this.control.admit(binding.threadSessionId);
   await git(repo.root,['update-ref',repo.branch,commit,repo.head]);op={...op,phase:'ref-updated'};await this.tables.operations.put(op.operationId,op);await this.fault('commit-ref-updated',op);
   if(hash(await optionalRead(indexPath))!==op.beforeIndexSha256)fail('GIT_INDEX_CHANGED_AFTER_REF','Ref advanced but concurrent index data was preserved; reconcile explicitly');
   await indexLock.writeFile(await readFile(userIndex));await indexLock.sync();await indexLock.close();assertRepositoryLease();await rename(indexPath+'.lock',indexPath);
   op={...op,phase:'completed',updatedAt:Date.now()};await this.tables.operations.put(op.operationId,op);await this.fault('commit-completed-before-binding',op);await this.updateBinding(binding,op);return copy(op);
  }catch(error){
   if(op){const phase=op.phase==='ref-updated'?'outcome-unknown':op.phase;await this.tables.operations.put(op.operationId,{...op,phase,errorCode:error.code??'GIT_FAILURE'});}
   throw error;
  }finally{
   await indexLock.close().catch(()=>{});try{const current=await lstat(indexPath+'.lock');if(current.dev===lockIdentity.dev&&current.ino===lockIdentity.ino)await unlink(indexPath+'.lock')}catch(e){if(e.code!=='ENOENT')throw e;}
  }
 }
 async updateBinding(binding,op){
  await this.control.admit(binding.threadSessionId);
  const current=this.tables.bindings.get(binding.bindingId),actual=await repoMetadata(binding.workspacePath);
  if(!current||current.grantId!==op.grantId||current.grantVersion!==op.grantVersion||current.repo?.gitDir!==op.gitDir||current.repo?.commonDir!==op.commonDir||current.repo?.branch!==op.expectedBranch)fail('GIT_BINDING_CHANGED','Binding authority or repository changed; no projection was overwritten');
  if(!actual||actual.head!==op.commit||actual.branch!==op.expectedBranch||actual.gitDir!==op.gitDir||actual.commonDir!==op.commonDir||hash(await optionalRead(join(actual.gitDir,'index')))!==op.newIndexSha256)fail('GIT_BINDING_FACTS_CHANGED','Ref or index changed before binding repair; no projection was overwritten');
  if(current.repo.head===op.commit&&current.baseline.indexSha256===op.newIndexSha256)return;
  if(current.repo.head!==op.expectedHead||current.baseline.indexSha256!==op.beforeIndexSha256)fail('GIT_BINDING_CHANGED','A newer binding projection was preserved');
  await this.tables.bindings.put(binding.bindingId,{...current,version:current.version+1,repo:{...current.repo,head:op.commit},baseline:{...current.baseline,head:op.commit,indexSha256:op.newIndexSha256}});
 }
 async reconcile(op,binding,repo){
  const unknown=async reason=>{const value={...op,phase:'outcome-unknown',reason,updatedAt:Date.now()};await this.tables.operations.put(op.operationId,value);return copy(value)};
  await this.control.admit(binding.threadSessionId);
  if(!op.commit){return unknown('Commit object was not durably identified; no operation was replayed');}
  if(repo.branch!==op.expectedBranch||repo.gitDir!==op.gitDir||repo.commonDir!==op.commonDir)fail('GIT_IDENTITY_CHANGED','Git identity changed during recovery');
  if(repo.head===op.expectedHead)return unknown('Prepared commit is not on branch; explicit reconciliation is required, no ref was changed');
  if(repo.head!==op.commit)return unknown('Branch moved to another commit; nothing was overwritten');
  const index=join(repo.gitDir,'index'),current=hash(await optionalRead(index));
  if(current!==op.newIndexSha256){
   if(current!==op.beforeIndexSha256)return unknown('Concurrent index changes preserved');
   const bytes=await readFile(op.userIndex);if(hash(bytes)!==op.newIndexSha256)fail('GIT_RECOVERY_DATA_CHANGED','Prepared index data changed; no overwrite was performed');const lock=await open(index+'.lock','wx',0o600);let publish=false;try{if(hash(await optionalRead(index))!==op.beforeIndexSha256)fail('GIT_INDEX_CHANGED','Concurrent index change was preserved');await lock.writeFile(bytes);await lock.sync();publish=true;}finally{await lock.close();if(!publish)await unlink(index+'.lock');}assertRepositoryLease();await rename(index+'.lock',index);
  }
  const completed={...op,phase:'completed',reconciledExistingCommit:true,updatedAt:Date.now()};await this.tables.operations.put(op.operationId,completed);await this.updateBinding(binding,completed);return copy(completed);
 }
}
