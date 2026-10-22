/** Keep only view navigation between Host panels; Session/editor state remains Host-owned. */
export function createProjectNavigation(){
 let latest=null,view={};
 return {rememberState(value){if(Array.isArray(value?.projects))latest=value},rememberView(value){view={...value}},initial(fallback){const state=latest??fallback;const ids=new Set(state.projects.map(p=>p.projectId));const selected=ids.has(view.selected)?view.selected:ids.has(state.preferredProjectId)?state.preferredProjectId:state.projects[0]?.projectId??'';const same=selected===view.selected;return {state,selected,threadId:same?view.threadId??'':'',overview:same?view.overview??true:true,dataTab:same?view.dataTab??'Threads':'Threads',expanded:same?view.expanded??false:false,create:state.projects.length===0}}};
}
