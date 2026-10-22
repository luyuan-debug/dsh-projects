import * as SearchTools from '@deepseek-ai/dsh-tool-fs-search';
import {LOCAL_TOOLS,SEARCH_TOOLS,effectiveToolPolicy,validateToolPolicy,toolPolicyReason} from '../domain/project-tools.mjs';
import {fail} from '../domain/projects.mjs';
const localSource={read:'@deepseek-ai/dsh-tool-fs',write:'@deepseek-ai/dsh-tool-fs',edit:'@deepseek-ai/dsh-tool-fs',bash:'@deepseek-ai/dsh-tool-bash',workspace_commit:'Project ScopedGit adapter'};
/** Only proven local capabilities are enabled. Unknown live registry entries remain discoverable with a concrete constraint reason. */
export function projectTools({ctx,registry,legacy,coreFor}){
 const agents=new Map();
 function catalog(){
  const actual=new Map(ctx.tools.schemas().map(x=>[x.name,{...x,scope:'Host'}]));
  for(const {agent}of agents.values())for(const row of ctx.tools.schemas(agent))actual.set(row.name,{...row,scope:'Project Session'});
  for(const name of [...LOCAL_TOOLS,...SEARCH_TOOLS])if(!actual.has(name))actual.set(name,{name,description:SEARCH_TOOLS.includes(name)?'宿主只读工作区检索':'已验证的工作区能力',scope:'ON_AUTHORIZED_THREAD',registered:false});
  return [...actual.values()].filter(x=>x.name!=='run_code').map(x=>{
   const core=coreFor('coordinator').includes(x.name)||coreFor('thread').includes(x.name),local=LOCAL_TOOLS.includes(x.name),search=SEARCH_TOOLS.includes(x.name),mcp=x.name.startsWith('mcp__');
   return {name:x.name,description:x.description,registered:x.registered!==false,availability:x.registered===false?'任务获得目录授权后挂载':'已注册',group:core?'core':local||search?'workspace':mcp?'mcp':'host',source:local?localSource[x.name]:search?'@deepseek-ai/dsh-tool-fs-search':mcp?'DSH MCP registry / '+x.name.split('__')[1]:core?'Projects':'Host registry',selectableRoles:local||search?['thread']:[],required:core,available:core||local||search,reason:core?'项目核心能力，保留既有角色与权限':local?'仅在原生审批和当前目录授权内执行':search?'只读检索当前已授权工作区；拒绝自定义根目录，不跟随链接':mcp?'已注册；此构建不暴露可验证的服务端副作用/目录约束合同，尚未审核接通。MCP 注册不等于沙箱覆盖。':'尚未证明本工具可在项目资源边界内约束，默认不启用'};
  }).sort((a,b)=>a.group.localeCompare(b.group)||a.name.localeCompare(b.name));
 }
 function reason(p,role,name){return toolPolicyReason(p,role,name,{core:coreFor(role),catalog:catalog(),legacy})}
 function attach(scope,agent,role,projectId){
  agents.set(agent.id,{agent,role,projectId});scope.effect(()=>()=>agents.delete(agent.id));
  scope.tools.guard(exec=>reason(registry.get(projectId),role,exec.name));
  // Re-check after async native approval and before dispatch; queued calls cannot retain revoked project permission.
  scope.on('tools/execute',async(exec,next)=>{const denied=reason(registry.get(projectId),role,exec.name);if(denied)fail('PROJECT_TOOL_REVOKED',denied);return next()},{prepend:true});
 }
 async function mountSearch(scope){await scope.plugin(SearchTools,{sampleOverCapGlobResults:false}).await()}
 return {catalog,attach,mountSearch,reason,policy:p=>effectiveToolPolicy(p,legacy),validate:v=>validateToolPolicy(v,catalog()),allowed:(p,role,name)=>!reason(p,role,name)};
}
