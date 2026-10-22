import {isAbsolute} from 'node:path';
import {fail} from '../../domain/projects.mjs';
const quote=s=>'"'+s.replaceAll('\\','\\\\').replaceAll('"','\\"')+'"';
/** Additional macOS write fence, layered over the native DSH sandbox contract. */
export function gitProtectedSandbox(base,protectedPaths){
 return {async confine(argv,policy,signal){
  if(policy.mode==='danger-full-access')fail('PROJECT_SANDBOX_EXPANSION','Folder authorization does not allow disabling the Project sandbox');
  const result=await base.confine(argv,policy,signal);
  if(process.platform!=='darwin')fail('GIT_CONFINEMENT_PLATFORM_UNVERIFIED','Additional Git metadata confinement has only been verified on macOS');
  const paths=[...new Set(protectedPaths.filter(Boolean))];if(paths.some(p=>!isAbsolute(p)))fail('GIT_CONFINEMENT_PATH','Git protection requires canonical paths');
  const [runner,flag,original,...rest]=result.argv;
  if(!/(^|\/)sandbox-exec$/.test(runner)||flag!=='-p'||typeof original!=='string')fail('GIT_CONFINEMENT_RUNNER_UNVERIFIED','Native runner profile composition is not supported');
  const profile=original+' '+paths.map(p=>'(deny file-write* (subpath '+quote(p)+'))').join(' ');
  return {...result,argv:[runner,flag,profile,...rest]};
 }};
}
