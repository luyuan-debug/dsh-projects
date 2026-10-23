#!/usr/bin/env python3
"""REAL_DSH_HTTP_CONTROLLED_PICKER. Owned public capability fixture, not real native UI.
No formal Profile, real model, Hindsight, DSH core edit or application signing.
"""
import argparse,concurrent.futures,hashlib,http.client,http.cookiejar,json,os,pathlib,re,signal,subprocess,tarfile,threading,time,uuid
import urllib.request,urllib.error,urllib.parse
ap=argparse.ArgumentParser();ap.add_argument('--dsh-bin',required=True);ap.add_argument('--artifact',required=True);ap.add_argument('--expected-sha256',required=True);ap.add_argument('--root',required=True);ap.add_argument('--skip-real-timeout',action='store_true');a=ap.parse_args()
root=pathlib.Path(a.root).resolve()
if root.exists() and any(root.iterdir()):raise SystemExit('Fresh empty owned root required')
root.mkdir(parents=True,exist_ok=True);(root/'.mem04-picker-http-owned').write_text('Owned HTTP directory picker test\n')
artifact=pathlib.Path(a.artifact).resolve();package_sha=hashlib.sha256(artifact.read_bytes()).hexdigest()
if package_sha!=a.expected_sha256:raise SystemExit('Explicit package SHA mismatch')
for name in ['launch','os-home','cache','temp','data','config']:(root/name).mkdir()
(root/'user.npmrc').write_text('auto-install-peers=false\nstrict-peer-dependencies=false\n');(root/'global.npmrc').write_text('')
env={key:os.environ[key] for key in ['PATH','LANG'] if key in os.environ};env.update(HOME=str(root/'os-home'),CFFIXED_USER_HOME=str(root/'os-home'),ZDOTDIR=str(root/'os-home'),DSH_HOME=str(root/'dsh-home'),DSH_TELEMETRY_MODE='DISABLED',TMPDIR=str(root/'temp')+'/',XDG_DATA_HOME=str(root/'data'),XDG_CONFIG_HOME=str(root/'config'),XDG_CACHE_HOME=str(root/'cache'),npm_config_userconfig=str(root/'user.npmrc'),npm_config_globalconfig=str(root/'global.npmrc'),npm_config_cache=str(root/'cache/npm'))
profile='mem04-picker-http';store=root/'cache/pnpm';probe=pathlib.Path(__file__).with_name('picker-host-probe.mjs').resolve();overlay=root/'picker-probe.yml';overlay.write_text('- insert:\n    - id: mem04-controlled-picker-probe\n      name: '+str(probe)+'\n')
resources=pathlib.Path(a.dsh_bin).resolve().parents[3];env.update(RELEASE_CHECK_ROOT=str(root),RELEASE_LLM_MODULE=(resources/'app.asar/dsh/node_modules/@deepseek-ai/dsh-llm/lib/index.js').as_uri())
def sanitize(value):return re.sub(r'([?&](?:token|grant|key)=)[^\s"<>]+',r'\1[REDACTED]',value,flags=re.I)
def command(argv,label):
 result=subprocess.run(argv,cwd=root/'launch',env=env,capture_output=True,text=True,timeout=120);(root/(label+'.log')).write_text(sanitize(result.stdout+result.stderr));print(json.dumps({'step':label,'exitCode':result.returncode}),flush=True)
 if result.returncode:raise RuntimeError('Owned setup failed: '+label)
command([a.dsh_bin,'--profile',profile,'--from-default-profile','web','--dump-config'],'bootstrap')
command([a.dsh_bin,'plugin','--profile',profile,'add','file:'+str(artifact),'--offline','--ignore-scripts','--store-dir',str(store)],'install')
installed=root/'dsh-home/profiles'/profile/'node_modules/dsh-project-threads-wave1-spike';members=[]
with tarfile.open(artifact) as package:
 for member in package.getmembers():
  if member.isfile():
   body=package.extractfile(member).read();relative=member.name.removeprefix('package/');assert (installed/relative).read_bytes()==body,'Installed member mismatch';members.append({'path':relative,'sha256':hashlib.sha256(body).hexdigest()})
(root/'installed-members.json').write_text(json.dumps(members,indent=2)+'\n')
process=subprocess.Popen([a.dsh_bin,'--profile',profile,'--patch',str(overlay),'--no-open','--host','127.0.0.1','--port','0'],cwd=root/'launch',env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
auth_ready=threading.Event();auth_url=[None];owned={process.pid};log=(root/'host.log').open('w');checks=[];pool=concurrent.futures.ThreadPoolExecutor(max_workers=6)
def drain():
 for line in process.stdout:
  found=re.search(r'http://127\.0\.0\.1:\d+/\?token=[^\s\"<>]+',line)
  if found:auth_url[0]=found.group(0);auth_ready.set()
  log.write(sanitize(line));log.flush()
reader=threading.Thread(target=drain,daemon=True);reader.start()
def checked(name,**details):checks.append({'name':name,'status':'PASS','evidence':'REAL_DSH_HTTP_CONTROLLED_PICKER',**details});print(json.dumps({'check':name,'status':'PASS'}),flush=True)
def wait_until(fn,label,timeout=30):
 end=time.monotonic()+timeout
 while time.monotonic()<end:
  result=fn()
  if result:return result
  time.sleep(.025)
 raise RuntimeError('Timeout waiting for '+label)
try:
 assert auth_ready.wait(30),'No owned Host authorization URL';jar=http.cookiejar.CookieJar();opener=urllib.request.build_opener(urllib.request.HTTPCookieProcessor(jar));response=opener.open(auth_url[0],timeout=10);response.close();parsed=urllib.parse.urlsplit(auth_url[0]);origin='http://'+parsed.netloc;cookie='; '.join(item.name+'='+item.value for item in jar);auth_url[0]=None
 assert cookie,'Owned authorization failed; no cookie acquired'
 def api(op=None,input=None,path='/api/project-threads',timeout=10):
  payload=None if op is None else json.dumps({'op':op,'input':input or {}}).encode();headers={'Cookie':cookie,'Origin':origin}
  if payload is not None:headers['Content-Type']='application/json'
  request=urllib.request.Request(origin+path,data=payload,headers=headers)
  try:
   with urllib.request.urlopen(request,timeout=timeout) as response:return json.loads(response.read())
  except urllib.error.HTTPError as error:return json.loads(error.read())
 def control(op,index=None,selection=None):
  body={'op':op}
  if index is not None:body['index']=index
  if selection is not None:body['selection']=selection
  request=urllib.request.Request(origin+'/api/mem04-picker-fixture',data=json.dumps(body).encode(),headers={'Cookie':cookie,'Origin':origin,'Content-Type':'application/json'})
  with urllib.request.urlopen(request,timeout=10) as response:return json.loads(response.read())
 def fixture_state():return api(path='/api/mem04-picker-fixture')['value']
 def state(project):
  value=api(path='/api/project-threads?projectId='+project);assert value['ok'],value;return value['value']
 def backend_count():return len(fixture_state()['backend'])
 ready=wait_until(lambda:json.loads((root/'picker-fixture-ready.json').read_text()) if (root/'picker-fixture-ready.json').exists() else (_ for _ in ()).throw(RuntimeError((root/'picker-fixture-failed.json').read_text())) if (root/'picker-fixture-failed.json').exists() else None,'fixture ready')
 project_a=ready['projectA']['projectId'];project_b=ready['projectB']['projectId'];request=ready['request'];assert state(project_a)['localCapabilities']['nativePicker']
 picker_id=str(uuid.uuid4());future=pool.submit(api,'workspace.pick',{'pickerId':picker_id},timeout=135);wait_until(lambda:backend_count()==1,'pending picker')
 started=time.monotonic();value=state(project_a);latency=time.monotonic()-started;assert latency<1.5
 denied=api('workspace.decide',{'projectId':project_a,'requestId':request['requestId'],'revision':request['revision'],'confirmationToken':request['confirmationToken'],'decision':'denied'});assert denied['ok'],denied
 other=api('project.update',{'projectId':project_b,'name':'Other Project remains responsive'});assert other['ok'],other
 checked('Pending picker does not block real HTTP GET/state, request denial or another Project mutation',stateSeconds=latency)
 busy=api('workspace.pick',{'pickerId':str(uuid.uuid4())});assert not busy['ok'] and busy['error']['code']=='PICKER_ALREADY_OPEN',busy
 cancelled=api('workspace.cancelPick',{'pickerId':picker_id});assert cancelled['ok'],cancelled
 selected=future.result(timeout=3);assert selected['ok'] and selected['value']=={'cancelled':True,'reason':'cancelled'},selected
 assert fixture_state()['backend'][0]['aborted'];assert not state(project_a)['folders'];control('resolve',0,'a');time.sleep(.08);assert not state(project_a)['folders'];checked('HTTP owner cancellation and ignored-abort late native result do not register a folder')
 before=backend_count();early=str(uuid.uuid4());assert api('workspace.cancelPick',{'pickerId':early})['ok'];early_result=api('workspace.pick',{'pickerId':early});assert early_result['ok'] and early_result['value']['cancelled'];assert backend_count()==before;checked('Cancel-before-pick HTTP race consumes a tombstone without opening native selector')
 # Abort the actual network connection while a native backend deliberately ignores AbortSignal.
 disconnect_id=str(uuid.uuid4());connection=http.client.HTTPConnection(parsed.hostname,parsed.port,timeout=10);body=json.dumps({'op':'workspace.pick','input':{'pickerId':disconnect_id}});connection.request('POST','/api/project-threads',body=body,headers={'Cookie':cookie,'Origin':origin,'Content-Type':'application/json'});wait_until(lambda:backend_count()==before+1,'disconnect picker');connection.close()
 wait_until(lambda:fixture_state()['backend'][before]['aborted'],'HTTP disconnect propagated to picker',timeout=5);assert state(project_b)['selectedProject']['projectId']==project_b;control('resolve',before,'a');time.sleep(.08);assert not state(project_a)['folders'];checked('Real HTTP disconnect aborts the picker while other HTTP commands remain responsive')
 # Arbitrary HTTP paths cannot register a directory or bypass the native chooser.
 bad=api('workspace.pick',{'pickerId':str(uuid.uuid4()),'path':'/synthetic/untrusted-http-path'});assert not bad['ok'],bad;assert not state(project_a)['folders'];checked('HTTP arbitrary path is rejected before native directory registration',errorCode=bad['error']['code'])
 # Native-selected registration is independent from the request confirmation/grant.
 index=backend_count();success=pool.submit(api,'workspace.pick',{'pickerId':str(uuid.uuid4())},timeout=10);wait_until(lambda:backend_count()==index+1,'successful picker');control('resolve',index,'b');selected=success.result(timeout=3);assert selected['ok'] and selected['value']['folder']['selectedPath']==ready['selected']['b'],selected
 selected_state=state(project_a);assert selected_state['grants']==[] and selected_state['bindings']==[];assert selected_state['executionRequests'][0]['phase']=='denied';checked('Actual selected folder registration still creates no grant or Thread binding')
 if not a.skip_real_timeout:
  index=backend_count();start=time.monotonic();timed=pool.submit(api,'workspace.pick',{'pickerId':str(uuid.uuid4())},timeout=135);wait_until(lambda:backend_count()==index+1,'timeout picker');print(json.dumps({'check':'Real 120-second Host timeout','state':'WAITING','maximumSeconds':120}),flush=True)
  result=timed.result(timeout=130);elapsed=time.monotonic()-start;assert result['ok'] and result['value']=={'cancelled':True,'reason':'timeout'},result;assert 119<=elapsed<126;assert state(project_b)['selectedProject']['projectId']==project_b;control('resolve',index,'a');time.sleep(.08);assert all(folder['selectedPath']!=ready['selected']['a'] for folder in state(project_a)['folders']);checked('Real HTTP 120-second timeout releases request independent of ignored backend abort',elapsedSeconds=elapsed)
 index=backend_count();closing=pool.submit(api,'workspace.pick',{'pickerId':str(uuid.uuid4())},timeout=15);wait_until(lambda:backend_count()==index+1,'closing picker');control('disable');result=closing.result(timeout=5);assert result['ok'] and result['value']=={'cancelled':True,'reason':'closed'},result;assert fixture_state()['backend'][index]['aborted'];control('resolve',index,'a');time.sleep(.08);checked('Disabling plugin cancels pending independent HTTP picker and drains despite ignored abort')
 stats=fixture_state()['stats'];assert stats['blockedExternalAttempts']==0
 summary={'status':'PASS','packageSHA256':package_sha,'installedMembers':len(members),'checks':checks,'real120SecondTimeoutValidated':not a.skip_real_timeout,'providerStats':stats,'realModelCalls':0,'realHindsightCalls':0,'evidence':'REAL_DSH_HTTP_CONTROLLED_PICKER','realNativePickerClaim':False,'authTokenArchived':False};(root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
except Exception as error:
 (root/'failed.json').write_text(json.dumps({'errorType':type(error).__name__,'message':sanitize(str(error)),'checks':checks,'evidence':'REAL_DSH_HTTP_CONTROLLED_PICKER'},indent=2)+'\n');raise
finally:
 if process.poll() is None:os.killpg(process.pid,signal.SIGTERM)
 try:process.wait(timeout=20)
 except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=5)
 pool.shutdown(wait=True,cancel_futures=True);reader.join(timeout=3);log.close()
 rows=[]
 for line in subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,pgid='],text=True).splitlines():
  values=list(map(int,line.split()))
  if len(values)==3 and values[2]==process.pid:rows.append(values[0])
 cleanup={'exitCode':process.returncode,'residualOwnedProcessGroupPids':rows};(root/'cleanup.json').write_text(json.dumps(cleanup)+'\n');print(json.dumps({'cleanup':cleanup}),flush=True)
 if rows:raise RuntimeError('Owned process group residuals detected')
