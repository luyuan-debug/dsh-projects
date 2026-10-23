import React from 'react';
import {h,Icon,Button,Menu,ErrorNotice,Details} from './project-ui.mjs';

const pickerErrors={PICKER_ALREADY_OPEN:'上一次系统选择器仍在关闭，请先取消该窗口或稍后重试。',PICKER_CAPACITY:'目录选择请求暂时达到上限，请稍后重试。',PICKER_INVALID_ID:'目录选择请求无效，请刷新界面后重试。',NATIVE_PICKER_UNAVAILABLE:'此执行端没有可用的原生目录选择器。',HOST_CLOSING:'本地执行端正在关闭，请重新连接后重试。'};
const pickerError=error=>{const detail=String(error?.message??error),code=typeof error?.code==='string'?error.code:'';return {message:pickerErrors[code]??'目录选择未完成，请重试；若系统选择器仍在，请先取消该窗口。',detail:(code?code+': ':'')+detail}};
const pickerOutcome=reason=>({cancelled:'已取消本次选择；任务授权未改变。',request_aborted:'目录选择请求已中止；任务授权未改变。',closed:'本地执行端已关闭，未应用目录选择。',superseded:'本次选择已被替代，未应用返回的目录。'}[reason]??'目录选择已取消；任务授权未改变。');

/** Both task cards and the settings folder button use the same cancellable flow. */
function useDirectorySelection({state,projectId,request,run,refresh}){
 const [selection,setSelection]=React.useState({pending:false,target:null,notice:'',error:null});
 const active=React.useRef(null),live=React.useRef(true),generation=React.useRef(0),current=React.useRef(null);current.current={state,projectId,request,run,refresh};
 const cancel=(reason='cancelled',silent=false)=>{
  const attempt=active.current;if(!attempt)return Promise.resolve();
  active.current=null;const token=++generation.current;clearTimeout(attempt.timer);attempt.controller.abort();attempt.interrupt?.({cancelled:true,reason});
  if(live.current&&!silent)setSelection(old=>({...old,pending:false,target:null,notice:reason==='timeout'?'等待超过服务的 120 秒上限，已停止本地等待并请求关闭选择器；可重新选择。':pickerOutcome(reason)}));
  const controller=new AbortController();let timer;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Object.assign(Error('Cancellation acknowledgement timed out'),{code:'PICKER_CANCEL_TIMEOUT'}))},5000)});
  return Promise.race([attempt.request('workspace.cancelPick',{pickerId:attempt.pickerId},undefined,controller.signal),deadline]).catch(error=>{if(live.current&&!silent&&generation.current===token)setSelection(old=>({...old,error:{message:'已停止本地等待，但未能确认系统选择器已关闭。请取消该窗口后再重试；其他操作仍可使用。',detail:(error?.code?error.code+': ':'')+String(error?.message??error)}}))}).finally(()=>clearTimeout(timer));
 };
 React.useEffect(()=>{live.current=true;setSelection({pending:false,target:null,notice:'',error:null});return()=>{live.current=false;void cancel('closed',true)}},[projectId]);
 React.useEffect(()=>{const attempt=active.current;if(!attempt||attempt.phase!=='picking'||!attempt.target)return;const latest=state.executionRequests?.find(row=>row.requestId===attempt.target.requestId);if(!latest||latest.revision!==attempt.target.revision||latest.workspaceMode!==attempt.target.workspaceMode||['active','ready','proposed','denied','preparing','delivering'].includes(latest.phase))void cancel('superseded')},[state.executionRequests]);
 const pick=async task=>{
  if(active.current)return;
  const target=task?{projectId,requestId:task.requestId,revision:task.revision,workspaceMode:task.workspaceMode}:null;
  const attempt={pickerId:crypto.randomUUID(),controller:new AbortController(),target,request,phase:'picking'},token=++generation.current;
  const valid=()=>live.current&&generation.current===token&&active.current===attempt;active.current=attempt;
  setSelection(old=>({...old,pending:true,target:target?.requestId??null,notice:''}));
  const interrupted=new Promise(resolve=>{attempt.interrupt=resolve});attempt.timer=setTimeout(()=>{void cancel('timeout')},125000);
  try{
   const selected=await Promise.race([request('workspace.pick',{pickerId:attempt.pickerId},undefined,attempt.controller.signal),interrupted]);if(!valid())return;
   clearTimeout(attempt.timer);
   if(selected?.cancelled){setSelection(old=>({...old,pending:false,target:null,notice:selected.reason==='timeout'?'目录选择已超时（上限 120 秒），未改变任务授权。可重新选择。':pickerOutcome(selected.reason)}));return;}
   if(!selected?.folder?.folderId)throw Object.assign(Error('Picker returned no selected folder'),{code:'PICKER_INVALID_RESPONSE'});
   attempt.phase='applying';setSelection(old=>({...old,pending:false,target:null}));
   if(target){
    const latest=current.current.state.executionRequests?.find(row=>row.requestId===target.requestId);
    if(!latest||latest.revision!==target.revision||latest.workspaceMode!==target.workspaceMode||['active','ready','proposed','denied','preparing','delivering'].includes(latest.phase)){setSelection(old=>({...old,notice:'任务请求已变化，未应用本次目录选择。请重新选择。'}));return;}
    let applied=false;await run(async()=>{if(!valid())return;await request('workspace.choose',{...target,folderId:selected.folder.folderId},undefined,attempt.controller.signal);applied=true;if(valid())await refresh()});if(!applied)return;
   }else if(valid())await refresh();
   if(valid())setSelection(old=>({...old,error:null,notice:target?'已选择目录，请继续确认任务授权范围。':'文件夹已连接；连接不代表授予任务权限。'}));
  }catch(error){if(valid()&&error?.name!=='AbortError')setSelection(old=>({...old,error:pickerError(error)}));}
  finally{clearTimeout(attempt.timer);if(active.current===attempt){active.current=null;if(live.current)setSelection(old=>({...old,pending:false,target:null}));}}
 };
 return {selection,pick,cancel,dismissError:()=>setSelection(old=>({...old,error:null}))};
}
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
 const {selection,pick,cancel,dismissError}=useDirectorySelection({state,projectId,request,run,refresh});
 const operate=(op,input)=>{void cancel('superseded');return run(async()=>{await request(op,input);await refresh()})};
 const choose=(r,patch)=>operate('workspace.choose',{projectId,requestId:r.requestId,revision:r.revision,...patch});
 const [showDismissed,setShowDismissed]=React.useState(false);
 const preparing=(state.executionRequests??[]).filter(r=>r.projectGrantCheckPending||['preparing','delivering'].includes(r.phase));
 const all=(state.executionRequests??[]).filter(r=>!r.projectGrantCheckPending&&!['active','ready','proposed','preparing','delivering'].includes(r.phase));
 const cards=all.filter(r=>r.reason!=='dismissed'||showDismissed);
 if(inline&&!cards.length&&!preparing.length&&!selection.pending&&!selection.error&&!selection.notice)return null;
 return h('section',{'aria-label':'本地工作区许可',className:'pt-auth'},
  selection.pending&&h('div',{className:'pt-banner',role:'status','aria-label':'目录选择状态','aria-busy':true},h('span',null,'请在系统窗口选择目录。最长等待 120 秒；其他操作仍可使用。'),h(Button,{onClick:()=>cancel()},'取消目录选择')),
  selection.notice&&h('p',{role:'status',className:'pt-help'},selection.notice),
  selection.error&&h('div',null,h(ErrorNotice,{message:selection.error.message,onDismiss:dismissError}),h(Details,{label:'目录选择错误详情',value:selection.error.detail})),
  !inline&&h('p',{role:'status'},'本机 DSH 执行端：'+((state.endpoints??[]).some(e=>e.availability==='online')?'在线':'待连接或核验')),
  !inline&&h(Button,{disabled:busy||selection.pending,onClick:()=>pick()},'选择本机文件夹'),
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
     h('hr',{className:'pt-auth-divider'}),h(Button,{className:'pt-auth-add','aria-label':'选择此任务的文件夹',disabled:busy||selection.pending,onClick:()=>pick(r)},h(Icon,{name:'add',size:14}),folder?'更换文件夹':'添加文件夹'),
     folder&&h('div',{className:'pt-auth-target'},h('p',null,folder.identity.canonicalPath),h('p',{className:'pt-help'},r.workspaceMode==='worktree'?'独立 Git worktree':'直接使用所选目录'),r.baseCommit&&h('p',{className:'pt-help'},'已选 base：'+r.baseCommit)),
     h('details',null,h('summary',null,'目录、模式与任务详情'),workspaceOptions,h('strong',null,r.title),source&&h('p',null,'来自消息：'+source.text),h('p',null,r.task),r.reason&&h('p',{role:'status'},r.reason)),
     h('div',{className:'pt-actions'},folder&&h(Button,{disabled:busy||r.phase==='denied',onClick:()=>operate('workspace.confirm',{...input,grantScope:'thread'})},'仅允许本线程'),folder&&!r.legacy&&h(Button,{disabled:busy||r.phase==='denied',onClick:()=>operate('workspace.confirm',{...input,grantScope:'project'})},'允许本项目后续任务使用此目录和模式'),h(Button,{onClick:()=>operate('workspace.decide',{...input,decision:'denied'})},'拒绝'))));
  }));
}
