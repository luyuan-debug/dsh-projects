import {fail,copy} from './projects.mjs';
export const LOCAL_TOOLS=['read','write','edit','bash','workspace_commit'];
export const SEARCH_TOOLS=['glob','grep'];
/** Project choices narrow Host capabilities; they never register a transport or grant a path. */
export function effectiveToolPolicy(project,legacy=['read','write','edit','bash']){
 return copy(project.toolPolicy??{version:1,coordinator:[],thread:[...legacy,'workspace_commit']});
}
export function validateToolPolicy(value,catalog){
 if(!value||value.version!==1||Object.keys(value).some(k=>!['version','coordinator','thread'].includes(k)))fail('TOOL_POLICY_INVALID','Invalid project tool policy');
 const out={version:1};
 for(const role of ['coordinator','thread']){
  if(!Array.isArray(value[role])||value[role].length>128||value[role].some(n=>typeof n!=='string')||new Set(value[role]).size!==value[role].length)fail('TOOL_POLICY_INVALID','Provide unique tool names for each role');
  for(const name of value[role]){const row=catalog.find(x=>x.name===name);if(!row||!row.selectableRoles.includes(role))fail('TOOL_POLICY_UNAVAILABLE','Tool is unavailable for '+role+': '+name)}
  out[role]=[...value[role]].sort();
 }
 return out;
}
export function toolPolicyReason(project,role,name,{core=[],catalog=[],legacy}={}){
 if(core.includes(name))return;
 const selected=effectiveToolPolicy(project,legacy)[role];if(!selected.includes(name))return 'PROJECT_TOOL_NOT_SELECTED: '+name;
 const row=catalog.find(x=>x.name===name);if(!row?.selectableRoles.includes(role))return 'PROJECT_TOOL_UNAVAILABLE: '+name;
}
