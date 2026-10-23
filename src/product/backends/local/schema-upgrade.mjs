import {readFile,writeFile,mkdir,rename,open} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fail} from '../../domain/projects.mjs';
const digest=b=>createHash('sha256').update(b).digest('hex');
/** Version-specific adapter for DSH332895e's documented JSON single-unit medium. */
export async function upgradeProjectsUnit({ctx,name,backupRoot,scopes,links,approved,targetVersion=3}) {
 if(!/^[a-z0-9_]+$/.test(name))fail('DOMAIN_NAME','Invalid owned domain name');
 const config=ctx.storageDomain.config,backend=ctx.storage.backend.get(config.routes?.[name]??config.backend);
 if(typeof backend.root!=='string')fail('MIGRATION_BACKEND_UNSUPPORTED','Only the verified local JSON backend can be upgraded here');
 const path=join(resolve(backend.root),name+'.json');let bytes;
 try{bytes=await readFile(path)}catch(error){if(error.code==='ENOENT')return{fresh:true};throw error}
 const raw=JSON.parse(bytes);if(raw.unit?.name!==name)fail('MIGRATION_IDENTITY','Storage unit identity mismatch');
 if(raw.unit.version===targetVersion)return{alreadyUpgraded:true};
 if(![2,3,4].includes(raw.unit.version)||raw.unit.version>=targetVersion)fail('MIGRATION_VERSION','Unsupported Project schema');
 if(!approved)fail('MIGRATION_COORDINATION_REQUIRED','Legacy upgrade needs an explicitly owned, quiescent test Profile or a coordinated user-approved production migration');
 const held=[];
 try{
  // Any MAC02 Host owns at least its Coordinator writer. Do not upgrade over it.
  const ids=new Set([...scopes.entries()].map(([,s])=>s.coordinatorSessionId).concat([...links.entries()].map(([,l])=>l.threadSessionId)));
  for(const id of ids){if(!await ctx.sessionPersistence.stat(id))continue;held.push(await ctx.sessionPersistence.open(id,'write'));}
  const before=digest(bytes);await mkdir(backupRoot,{recursive:true,mode:0o700});const backup=join(backupRoot,name+'-'+before+'.json');
  const snapshot={unit:raw,scopes:[...scopes.entries()],links:[...links.entries()],sourceSha256:before,sourceBytesBase64:bytes.toString('base64'),sourceVersion:raw.unit.version,targetVersion,createdAt:new Date().toISOString()};
  try{await writeFile(backup,JSON.stringify(snapshot,null,2)+'\n',{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST')throw e;const old=JSON.parse(await readFile(backup,'utf8'));if(old.sourceSha256!==before)throw e;}
  if(digest(await readFile(path))!==before)fail('MIGRATION_CONCURRENT_WRITE','Storage changed during backup; no overwrite was performed');
  const next={...raw,unit:{...raw.unit,version:targetVersion}},temporary=path+'.r1-'+randomUUID();const h=await open(temporary,'wx',0o600);
  try{await h.writeFile(JSON.stringify(next,null,2)+'\n');await h.sync()}finally{await h.close()}
  if(digest(await readFile(path))!==before)fail('MIGRATION_CONCURRENT_WRITE','Storage changed before schema publication; temporary backup retained');
  await rename(temporary,path);return{upgraded:true,backup,sourceSha256:before,targetVersion,oldRuntimeFailsVersionCheck:true};
 }finally{for(const h of held.reverse())await h.close()}
}
