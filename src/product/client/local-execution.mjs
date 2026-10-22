import React from 'react';
import {h,Icon,Button,Menu} from './project-ui.mjs';
/** Public native input-trigger extension; each admitted message has its own immutable id. */
export function installLocalInput(ctx,request,current){
 const submissions=new Map();
 const projectFor=session=>current().projects.find(p=>p.coordinatorSessionId===session.sessionId);
 const claim=session=>{
  const project=projectFor(session);if(!project)return;
  return {name:'project-local',token:'/local ',hint:'在本机执行的新任务，目录仍需单独确认',async submit(args){
   if(!args.trim())return {kind:'error',text:'请输入任务或问题。'};
   const key=session.sessionId+'\0'+args;let id=submissions.get(key);if(!id){id=crypto.randomUUID();submissions.set(key,id)}
   try{await request('project.sendLocal',{projectId:project.projectId,messageId:id,text:args});submissions.delete(key);return {kind:'success'}}catch(error){return {kind:'error',text:error.message}}
  }};
 };
 ctx.effect(()=>ctx.inputTriggers.registerSource({name:'project-local',trigger:'/',order:-20,
  candidates:async session=>projectFor(session)?[{name:'local',label:'Work locally',description:'为这条消息选择本机；文件夹授权另行确认'}]:[],
  onPick:pick=>pick.candidate.name==='local'&&projectFor(pick.session)?{claim:claim(pick.session)}:undefined,
  matchSpace:(session,token)=>token==='/local'&&projectFor(session)?{claim:claim(session)}:undefined,
  matchClaim:async(session,token)=>token==='/local'?claim(session):undefined,
  matchEnter:(session,line)=>/^\/local(?:\s|$)/.test(line)&&projectFor(session)?{claim:claim(session)}:undefined
 }));
 return sessionId=>{
  const binding=ctx.sessions.binding(sessionId);if(!binding)throw new Error('会话尚未打开');
  const shell=ctx.conversation.input.shellFor(binding),draft=shell.draftSnapshot;
  if(draft.command&&!draft.text.startsWith('/local '))throw new Error('请先退出当前输入指令。');
  const active=draft.text.startsWith('/local '),delta=active?-7:7;
  const next={...draft,text:active?draft.text.slice(7):'/local '+draft.text,references:draft.references.map(ref=>({...ref,offset:Math.max(0,ref.offset+delta)}))};delete next.command;
  shell.setDraft(next);shell.focus();
 };
}
export function AuthorizationCards({state,projectId,request,run,refresh,busy=false,inline=false}){
 const operate=(op,input)=>run(async()=>{await request(op,input);await refresh()});
 const choose=(r,patch)=>operate('workspace.choose',{projectId,requestId:r.requestId,revision:r.revision,...patch});
 const [showDismissed,setShowDismissed]=React.useState(false);
 const preparing=(state.executionRequests??[]).filter(r=>r.projectGrantCheckPending||['preparing','delivering'].includes(r.phase));
 const all=(state.executionRequests??[]).filter(r=>!r.projectGrantCheckPending&&!['active','ready','proposed','preparing','delivering'].includes(r.phase));
 const cards=all.filter(r=>r.reason!=='dismissed'||showDismissed);
 const pickFor=r=>run(async()=>{const selected=await request('workspace.pick',{});if(selected.folder)await request('workspace.choose',{projectId,requestId:r.requestId,revision:r.revision,folderId:selected.folder.folderId,workspaceMode:r.workspaceMode});await refresh()});
 if(inline&&!cards.length&&!preparing.length)return null;
 return h('section',{'aria-label':'本地工作区许可',className:'pt-auth'},
  !inline&&h('p',{role:'status'},'本机 DSH 执行端：'+((state.endpoints??[]).some(e=>e.availability==='online')?'在线':'待连接或核验')),
  !inline&&h(Button,{disabled:busy,onClick:()=>operate('workspace.pick',{})},'选择本机文件夹'),
  !inline&&h('details',null,h('summary',null,'已连接文件夹（连接不代表授权）'),(state.folders??[]).map(f=>h('div',{key:f.folderId,className:'pt-resource-entry'},h('p',null,f.identity.canonicalPath),h(Button,{disabled:busy,onClick:()=>operate('workspace.disconnect',{folderId:f.folderId})},'断开连接（影响使用此文件夹的所有线程）')))),
  !inline&&h('details',null,h('summary',null,'已授权目录'),(state.bindings??[]).filter(b=>state.grants?.some(g=>g.grantId===b.grantId&&g.state==='granted')).map(b=>h('div',{key:b.bindingId,className:'pt-resource-entry'},h('p',null,((state.links??[]).find(l=>l.threadId===b.threadId)?.title??'讨论串')+'：'+b.workspacePath),h(Button,{disabled:busy,onClick:()=>operate('workspace.revoke',{grantId:b.grantId})},state.grants?.find(g=>g.grantId===b.grantId)?.scope==='project'?'撤销项目目录授权及其派生线程许可':'撤销该 Thread 授权'),h(Button,{disabled:busy,onClick:()=>operate('workspace.disconnect',{folderId:b.folderId})},'断开此文件夹（影响其全部授权线程）')))),
  !state.localCapabilities?.nativePicker&&h('p',{role:'status'},'此执行端尚无已验证的原生文件夹选择通路。'),
  preparing.length>0&&h('p',{role:'status'},'正在准备已授权的本地工作区…'),
  all.some(r=>r.reason==='dismissed')&&h(Button,{onClick:()=>setShowDismissed(!showDismissed)},showDismissed?'隐藏已关闭请求':'显示已关闭的授权请求'),
  cards.map(r=>{
   const folder=(state.folders??[]).find(f=>f.folderId===r.folderId),source=(state.messages??[]).find(m=>m.id===r.messageId);
   const input={projectId,requestId:r.requestId,revision:r.revision,confirmationToken:r.confirmationToken};
   const workspaceOptions=h('div',{className:'pt-auth-options'},state.managedProjectFolder&&h(Button,{disabled:busy,onClick:()=>operate('workspace.managed',{projectId,requestId:r.requestId,revision:r.revision})},'使用项目管理目录'),state.managedProjectFolder&&!folder&&h('details',null,h('summary',null,'项目管理目录路径'),h('p',null,state.managedProjectFolder)),h('label',null,'文件夹',h('select',{'aria-label':r.title+' 文件夹',value:r.folderId??'',onChange:e=>choose(r,{folderId:e.target.value,workspaceMode:r.workspaceMode==='legacy-fixture'?'legacy-fixture':r.workspaceMode})},h('option',{value:''},'请选择已连接文件夹'),(state.folders??[]).map(f=>h('option',{key:f.folderId,value:f.folderId},f.selectedPath)))),!r.legacy&&h('label',null,'工作区',h('select',{'aria-label':r.title+' 工作区',value:r.workspaceMode,onChange:e=>choose(r,{workspaceMode:e.target.value,folderId:r.folderId})},h('option',{value:'direct'},'直接使用所选目录'),h('option',{value:'worktree'},'创建独立 Git worktree'))),r.workspaceMode==='worktree'?h(React.Fragment,null,h('label',null,'本地 base/ref',h('input',{'aria-label':r.title+' base/ref',defaultValue:r.baseRef??'',placeholder:'留空使用已记录的本地 HEAD',onBlur:e=>{if((e.target.value||undefined)!==r.baseRef)choose(r,{baseRef:e.target.value,folderId:r.folderId,workspaceMode:'worktree'})}})),h('p',null,'新 worktree 从已提交 base 开始，不复制当前未提交修改。')):h('p',null,'直接目录共享现有文件；并发线程可能修改同一文件，这不是独立工作区。'));
   return h('article',{key:r.requestId+'-'+r.revision,'data-origin-message-id':r.messageId,'data-request-id':r.requestId,className:'pt-auth-card'},
    h('div',{className:'pt-auth-heading'},h('strong',{className:'pt-auth-head'},h(Icon,{name:'computer',size:15}),'允许 DSH 在您设备上的文件夹中工作'),h(Menu,{label:r.title+' 请求操作'},h(Button,{role:'menuitem',onClick:()=>operate('workspace.decide',{...input,decision:'dismissed'})},'关闭卡片'))),
    h('p',{className:'pt-help'},folder?'请确认目录、执行模式与授权范围。':'尚未选择这个任务的工作目录。'),
    r.phase==='legacy-intent'||r.phase==='implementation-gap'?h(React.Fragment,null,h('p',{role:'status'},'旧版本执行意图尚未运行，需要明确重新绑定。'),h(Button,{onClick:()=>choose(r,{workspaceMode:'direct'})},'处理旧请求，选择本地工作区')):h(React.Fragment,null,
     (r.phase==='preparation-failed'||r.reason==='LEGACY_AUTHORIZATION_NOT_PROVEN')&&h('p',{role:'alert'},r.phase==='preparation-failed'?'工作区准备失败，请查看详情并重新选择。':'历史可查看，执行前请确认原目录。'),
     h('hr',{className:'pt-auth-divider'}),h(Button,{className:'pt-auth-add','aria-label':'选择此任务的文件夹',disabled:busy,onClick:()=>pickFor(r)},h(Icon,{name:'add',size:14}),folder?'更换文件夹':'添加文件夹'),
     folder&&h('div',{className:'pt-auth-target'},h('p',null,folder.identity.canonicalPath),h('p',{className:'pt-help'},r.workspaceMode==='worktree'?'独立 Git worktree':'直接使用所选目录'),r.baseCommit&&h('p',{className:'pt-help'},'已选 base：'+r.baseCommit)),
     h('details',null,h('summary',null,'目录、模式与任务详情'),workspaceOptions,h('strong',null,r.title),source&&h('p',null,'来自消息：'+source.text),h('p',null,r.task),r.reason&&h('p',{role:'status'},r.reason)),
     h('div',{className:'pt-actions'},folder&&h(Button,{disabled:busy||r.phase==='denied',onClick:()=>operate('workspace.confirm',{...input,grantScope:'thread'})},'仅允许本线程'),folder&&!r.legacy&&h(Button,{disabled:busy||r.phase==='denied',onClick:()=>operate('workspace.confirm',{...input,grantScope:'project'})},'允许本项目后续任务使用此目录和模式'),h(Button,{onClick:()=>operate('workspace.decide',{...input,decision:'denied'})},'拒绝'))));
  }));
}
