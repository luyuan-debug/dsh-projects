import {spawn} from 'node:child_process';
import {mkdir,open} from 'node:fs/promises';
import {join} from 'node:path';
import {fail} from '../../domain/projects.mjs';
/** OS-backed lifetime lease: stale files are not ownership, and are never unlinked. */
export async function acquireProfileLease(ctx,namespace){
 if(process.platform!=='darwin')fail('PROFILE_LEASE_PLATFORM_UNVERIFIED','The local Profile writer lease has only been verified on macOS');
 const c=ctx.storageDomain.config,backend=ctx.storage.backend.get(c.routes?.[namespace]??c.backend);
 if(typeof backend.root!=='string')fail('PROFILE_LEASE_BACKEND_UNVERIFIED','The owned local JSON storage root is required');
 await mkdir(backend.root,{recursive:true,mode:0o700});const path=join(backend.root,'.'+namespace+'-endpoint.lock');
 return acquireFileLease(path);
}
export async function acquireFileLease(path,{prefix='PROFILE',busyCode='PROFILE_ENDPOINT_ALREADY_OWNED'}={}){
 if(process.platform!=='darwin')fail(prefix+'_LEASE_PLATFORM_UNVERIFIED','OS file leases are verified only on macOS');
 const file=await open(path,'a',0o600);await file.close();
 const script="process.stdout.write('MAC03_R1_LEASE_READY\\n');process.stdin.resume();process.stdin.on('end',()=>process.exit(0));";
 const child=spawn('/usr/bin/lockf',['-k','-s','-t','0',path,process.execPath,'-e',script],{env:{PATH:'/usr/bin:/bin',HOME:process.env.HOME,ELECTRON_RUN_AS_NODE:'1'},stdio:['pipe','pipe','pipe']});
 let stderr='';child.stderr.on('data',b=>stderr+=b);
 let releasing,lost,listener;const exited=new Promise(resolve=>child.once('close',(code,signal)=>{const result={code,signal};if(!releasing){lost=Object.assign(new Error('The Project endpoint OS lease was lost'),{code:prefix+'_LEASE_LOST'});listener?.(lost)}resolve(result)}));
 await new Promise((resolve,reject)=>{let out='';const timeout=setTimeout(()=>{child.kill('SIGTERM');reject(Object.assign(new Error('Profile lease initialization timed out'),{code:prefix+'_LEASE_TIMEOUT'}))},5000);child.stdout.on('data',b=>{out+=b;if(out.includes('MAC03_R1_LEASE_READY\n')){clearTimeout(timeout);resolve()}});child.once('error',error=>{clearTimeout(timeout);reject(error)});child.once('close',()=>{clearTimeout(timeout);reject(Object.assign(new Error('Another Project endpoint owns this Profile, or its OS lease is unavailable'),{code:busyCode}))});});
 return {path,pid:child.pid,assert(){if(lost)throw lost;},onLost(fn){listener=fn;if(lost)queueMicrotask(()=>fn(lost));},release(){return releasing??=(async()=>{child.stdin.end();const timer=setTimeout(()=>child.kill('SIGTERM'),5000);const result=await exited;clearTimeout(timer);if(result.code!==0)fail(prefix+'_LEASE_RELEASE_FAILED','Owned lease process did not close normally');})()}};
}
