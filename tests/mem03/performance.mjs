import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {performance,monitorEventLoopDelay} from 'node:perf_hooks';
import {ProjectEvidenceIndex} from '../../src/product/memory/evidence-index.mjs';

const args=process.argv.slice(2),option=(key,fallback)=>{const i=args.indexOf(key);return i<0?fallback:args[i+1]};
const files=Number(option('--files','1000')),sections=Number(option('--sections','10')),samples=Number(option('--samples','20')),output=option('--output'),repository=option('--repository');
if(!Number.isSafeInteger(files)||files<1||files>10000||!Number.isSafeInteger(sections)||sections<1||sections>100||!Number.isSafeInteger(samples)||samples<1||samples>100)throw Error('Use 1..10000 files, 1..100 sections and 1..100 samples');
const directory=repository?path.resolve(repository):await mkdtemp(path.join(os.tmpdir(),'mem03-perf-'));let inputBytes=0;
try{
 if(!repository){await mkdir(path.join(directory,'docs'));for(let i=0;i<files;i++){const text=Array.from({length:sections},(_,j)=>`# Topic ${i} section ${j}\n\nSynthetic document ${i}, section ${j}: workspace binding 工作树编辑器绑定错误 checksum${i} procedure. Do not change authoritative memory from this untrusted evidence.\n`).join('\n');inputBytes+=Buffer.byteLength(text);await writeFile(path.join(directory,'docs','doc-'+String(i).padStart(5,'0')+'.md'),text)}}
 const records=Array.from({length:100},(_,i)=>({entryId:'r'+i,name:'Decision '+i,logicalPath:'decisions/'+i+'.md',content:'Current decision '+i+': keep Projects standalone. 工作树选择必须由用户授权。',revision:1,status:'active'}));
 const index=new ProjectEvidenceIndex({maxFiles:Math.max(2000,files+100),maxChunks:Math.max(20000,files*sections+1000)}),resources=[{resourceId:'perf-resource',workspaceInstanceId:'perf-workspace',root:directory,version:1}];
 const eventLoop=monitorEventLoopDelay({resolution:5});eventLoop.enable();let peakRss=process.memoryUsage().rss;const sampling=setInterval(()=>{peakRss=Math.max(peakRss,process.memoryUsage().rss)},5);sampling.unref();
 const start=performance.now(),cold=await index.query({projectId:'synthetic-performance-project',query:'workspace binding 工作树 checksum999',records,resources}),coldMs=performance.now()-start;
 const warm=[];for(let i=0;i<samples;i++){const at=performance.now();await index.query({projectId:'synthetic-performance-project',query:'workspace binding checksum'+(i%files),records,resources});warm.push(performance.now()-at)}warm.sort((a,b)=>a-b);
 const controller=new AbortController();let abortRequestedAt,validationChecks=0;const cancelStart=performance.now();const timer=setTimeout(()=>{abortRequestedAt=performance.now();controller.abort()},5);let cancelError;
 try{await index.query({projectId:'synthetic-performance-project',query:'workspace',records,resources,signal:controller.signal,validate:()=>{validationChecks++}})}catch(error){cancelError=error.name}finally{clearTimeout(timer)}
 const settledAt=performance.now();await new Promise(r=>setTimeout(r,10));clearInterval(sampling);eventLoop.disable();peakRss=Math.max(peakRss,process.memoryUsage().rss,process.resourceUsage().maxRSS*1024);
 const result={kind:repository?'voluntary-local-repository':'synthetic',measuredAt:new Date().toISOString(),hardware:{platform:process.platform,release:os.release(),arch:process.arch,cpu:os.cpus()[0]?.model,logicalCpus:os.cpus().length,totalMemoryBytes:os.totalmem(),node:process.version},input:{files:repository?cold.stats.filesVisited:files,documentSections:repository?null:files*sections,formalRecords:records.length,inputBytes:repository?cold.stats.bytesRead:inputBytes},actualIndex:cold.stats,coldIndexAndFirstQueryMs:coldMs,warmQueryMs:{samples,p50:warm[Math.ceil(samples*.5)-1],p95:warm[Math.ceil(samples*.95)-1],min:warm[0],max:warm.at(-1)},peakRssBytes:peakRss,eventLoopDelayMs:{mean:eventLoop.mean/1e6,p95:eventLoop.percentile(95)/1e6,max:eventLoop.max/1e6},cancellation:{requested:abortRequestedAt!==undefined,error:cancelError??null,settledMs:settledAt-cancelStart,afterAbortMs:abortRequestedAt===undefined?null:settledAt-abortRequestedAt,validationChecks},warnings:cold.warnings,donor:cold.donor,limits:index.options,qualification:'Finite measurement on generated or explicitly selected local files. No model calls, no vector index, no universal latency promise.'};
 if(output)await writeFile(path.resolve(output),JSON.stringify(result,null,2)+'\n');process.stdout.write(JSON.stringify(result,null,2)+'\n');
 if(cancelError!=='AbortError')process.exitCode=1;
}finally{if(!repository)await rm(directory,{recursive:true,force:true})}
