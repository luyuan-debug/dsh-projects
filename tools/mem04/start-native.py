#!/usr/bin/env python3
"""Launch a byte-identical owned DSH Desktop copy with frozen plugin + mock HTTP.
No UI automation. No formal Profile, existing Hindsight or real model access.
The App stays running for the root agent's explicitly selected full-path CUA.
"""
import argparse, ast, hashlib, json, os, pathlib, re, shutil, signal, subprocess, tarfile, threading, time, uuid
from http.server import ThreadingHTTPServer, BaseHTTPRequestHandler
from urllib.parse import unquote, urlsplit

ap=argparse.ArgumentParser()
ap.add_argument('--artifact',required=True)
ap.add_argument('--expected-sha256',required=True)
ap.add_argument('--root',required=True)
ap.add_argument('--expected-members',type=int,default=794)
ap.add_argument('--cold',action='store_true',help='Reopen only this owned Desktop/Profile without reinstalling or reseeding')
a=ap.parse_args()
root=pathlib.Path(a.root).resolve();marker=root/'.mem04-native-owned'
artifact=pathlib.Path(a.artifact).resolve();package_sha=hashlib.sha256(artifact.read_bytes()).hexdigest()
if package_sha!=a.expected_sha256:raise SystemExit('Explicit artifact SHA256 mismatch')
if a.cold:
    if not marker.is_file():raise SystemExit('Cold launch requires this launcher ownership marker')
    previous=json.loads((root/'native-install-identity.json').read_text())
    if previous['packageSHA256']!=package_sha:raise SystemExit('Cold launch cannot silently replace the installed package')
elif root.exists() and any(root.iterdir()):
    raise SystemExit('Initial native launch requires a fresh empty owned root')
root.mkdir(parents=True,exist_ok=True);marker.write_text('Owned MEM04 isolated Native Desktop; scripted model and mock HTTP only\n')
owned=root/'owned'
for name in ['launch','dsh-home','fixtures','evidence','cache','temp','data','config','agents']:(owned/name).mkdir(parents=True,exist_ok=True)
for name in ['launch','os-home','electron-user','electron-cache','crash']:(root/name).mkdir(exist_ok=True)
source_app=pathlib.Path('/Applications/DeepSeek Harness.app');app=root/'DeepSeek Harness.app'
if not a.cold:
    subprocess.run(['/bin/cp','-cR',str(source_app),str(app)],check=True,timeout=180)
cli=app/'Contents/Resources/runtime/cli/bin/dsh';exe=app/'Contents/MacOS/DeepSeek Harness'
identity_paths=['Contents/Info.plist','Contents/MacOS/DeepSeek Harness','Contents/Resources/app.asar','Contents/Resources/runtime/cli/bin/dsh']
identities=[]
for relative in identity_paths:
    source_hash=hashlib.sha256((source_app/relative).read_bytes()).hexdigest();copy_hash=hashlib.sha256((app/relative).read_bytes()).hexdigest()
    if source_hash!=copy_hash:raise SystemExit('Owned App differs from unchanged official App: '+relative)
    identities.append({'path':relative,'sourceSHA256':source_hash,'ownedSHA256':copy_hash})
(root/'app-copy-identity.json').write_text(json.dumps({'officialApp':str(source_app),'ownedApp':str(app),'method':'cp -cR; no edits or signing','files':identities},indent=2)+'\n')
(owned/'user.npmrc').write_text('auto-install-peers=false\nstrict-peer-dependencies=false\n');(owned/'global.npmrc').write_text('')
store=owned/'cache/pnpm'
env={key:value for key,value in os.environ.items() if key in ['PATH','LANG']}
env.update(HOME=str(root/'os-home'),CFFIXED_USER_HOME=str(root/'os-home'),ZDOTDIR=str(root/'os-home'),DSH_HOME=str(owned/'dsh-home'),DSH_TELEMETRY_MODE='DISABLED',TMPDIR=str(owned/'temp')+'/',XDG_CACHE_HOME=str(owned/'cache'),XDG_DATA_HOME=str(owned/'data'),XDG_CONFIG_HOME=str(owned/'config'),AGENTS_HOME=str(owned/'agents'),MallocNanoZone='0',npm_config_userconfig=str(owned/'user.npmrc'),npm_config_globalconfig=str(owned/'global.npmrc'),npm_config_cache=str(owned/'cache/npm'),DSH_DESKTOP_LOGIN_SHELL_TIMEOUT_MS='1000',DSH_DESKTOP_DIAGNOSTIC_FILE=str(owned/'evidence/desktop-diagnostic.json'))
env.update(DSH_PROJECT_THREADS_ROOT=str(owned),DSH_PROJECT_THREADS_FIXTURES=str(owned/'fixtures'),DSH_PROJECT_THREADS_EVIDENCE=str(owned/'evidence'),DSH_PROJECT_THREADS_LAUNCH=str(owned/'launch'),DSH_PROJECT_THREADS_BIN=str(cli),DSH_PROJECT_THREADS_SOURCE_ROOTS='[]')
def sanitize(value):return re.sub(r'([?&](?:token|grant|key)=)[^\s"<>]+',r'\1[REDACTED]',value,flags=re.I)
def command(argv,label):
    process=subprocess.run(argv,cwd=owned/'launch',env=env,capture_output=True,text=True,timeout=120)
    (owned/'evidence'/(label+'.log')).write_text(sanitize(process.stdout+process.stderr));print(json.dumps({'step':label,'exitCode':process.returncode}),flush=True)
    if process.returncode:raise SystemExit('Owned native setup failed: '+label)
def pnpm_workspace(profile):
    # pnpm 11 reconciles this file on Desktop startup; use the identical offline
    # store for template and desktop so it never removes an installed module tree.
    (profile/'pnpm-workspace.yaml').write_text('storeDir: '+json.dumps(str(store))+'\nautoInstallPeers: false\nstrictPeerDependencies: false\n')
template=owned/'dsh-home/profiles/native-template';profile=owned/'dsh-home/profiles/desktop'
if not a.cold:
    command([str(cli),'--profile','native-template','--from-default-profile','web','--dump-config'],'bootstrap')
    pnpm_workspace(template)
    command([str(cli),'plugin','--profile','native-template','add','file:'+str(artifact),'--offline','--ignore-scripts','--store-dir',str(store)],'install')
    shutil.copytree(template,profile,symlinks=True);pnpm_workspace(profile)
installed=profile/'node_modules/dsh-project-threads-wave1-spike';members=[]
with tarfile.open(artifact) as package:
    for member in package.getmembers():
        if not member.isfile():continue
        relative=member.name.removeprefix('package/');local=installed/relative;body=package.extractfile(member).read()
        if not local.is_file() or local.read_bytes()!=body:raise SystemExit('Installed Desktop member differs: '+relative)
        members.append({'path':relative,'sha256':hashlib.sha256(body).hexdigest()})
if len(members)!=a.expected_members:raise SystemExit('Unexpected package member count; provide the frozen expected count explicitly')
(root/'installed-members.json').write_text(json.dumps(members,indent=2)+'\n')
(root/'native-install-identity.json').write_text(json.dumps({'packageSHA256':package_sha,'installedMembers':len(members),'version':json.loads((installed/'package.json').read_text())['version'],'profile':'desktop','installedRoot':str(installed)},indent=2)+'\n')

# Reuse only the mock contract definitions from our sibling checker. Its CLI/setup
# top-level code is deliberately not executed or imported into this launcher.
checker=pathlib.Path(__file__).with_name('check-host.py');checker_source=checker.read_text();tree=ast.parse(checker_source)
contract_names={'persist_mock','snapshot','remember','MockHandler'}
contract_nodes=[node for node in tree.body if isinstance(node,(ast.FunctionDef,ast.ClassDef)) and node.name in contract_names]
if len(contract_nodes)!=len(contract_names):raise SystemExit('Owned mock contract helper definitions changed unexpectedly')
lock=threading.RLock()
mock_state=json.loads((root/'mock-state.json').read_text()) if a.cold else {'evidence':'OWNED_MOCK_HINDSIGHT_HTTP_NOT_REAL_HINDSIGHT','apiVersion':'1.1.0','requests':[],'documents':{},'operations':{}}
exec(compile(ast.Module(body=contract_nodes,type_ignores=[]),str(checker),'exec'),globals())
with lock:persist_mock()
# Preserve the binding endpoint across --cold so existing receipts retain origin.
if a.cold:
    previous_endpoint=json.loads((root/'native-launch-identity.json').read_text())['mockEndpoint'];port=urlsplit(previous_endpoint).port
else:port=0
server=ThreadingHTTPServer(('127.0.0.1',port),MockHandler);server.daemon_threads=True
server_thread=threading.Thread(target=server.serve_forever,daemon=True);server_thread.start();endpoint='http://127.0.0.1:'+str(server.server_address[1])
probe=pathlib.Path(__file__).with_name('host-probe.mjs').resolve();(profile/'cordis.patch.yml').write_text('- insert:\n    - id: mem04-native-fixture\n      name: '+str(probe)+'\n')
stage='cold' if a.cold else 'warm'
(root/(stage+'-mock-start.json')).write_text(json.dumps(snapshot(),indent=2)+'\n')
env.update(RELEASE_CHECK_ROOT=str(root),RELEASE_CHECK_STAGE=stage,RELEASE_LLM_MODULE=(app/'Contents/Resources/app.asar/dsh/node_modules/@deepseek-ai/dsh-llm/lib/index.js').as_uri(),MEM04_MOCK_ENDPOINT=endpoint,MEM04_NATIVE_APP_PATH=str(app))
(root/'ephemeral-auth.url').unlink(missing_ok=True)
def owned_processes(pid,known=()):
    rows=[]
    for line in subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,comm='],text=True).splitlines():
        fields=line.strip().split(None,2)
        if len(fields)==3:rows.append((int(fields[0]),int(fields[1])))
    ids={pid,*known}
    while True:
        added={item for item,parent in rows if parent in ids}-ids
        if not added:break
        ids.update(added)
    return {item for item,_ in rows if item in ids}
process=None;owned_pids=set();stop=threading.Event()
def shutdown_signal(_signum,_frame):
    stop.set()
    if process and process.poll() is None:os.killpg(process.pid,signal.SIGTERM)
for selected_signal in [signal.SIGINT,signal.SIGTERM]:signal.signal(selected_signal,shutdown_signal)
try:
    process=subprocess.Popen([str(exe),'--user-data-dir='+str(root/'electron-user'),'--disk-cache-dir='+str(root/'electron-cache'),'--crash-dumps-dir='+str(root/'crash')],cwd=owned/'launch',env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
    owned_pids.add(process.pid)
    launch={'pid':process.pid,'processGroup':process.pid,'executable':str(exe),'appPath':str(app),'selectionInstruction':'Select this exact appPath with cua.getApp; never select the official app by name or bundle ID.','dshHome':env['DSH_HOME'],'home':env['HOME'],'cfHome':env['CFFIXED_USER_HOME'],'userDataDir':str(root/'electron-user'),'profile':'desktop','packageSHA256':package_sha,'installedMembers':len(members),'mockEndpoint':endpoint,'mockHindsight':True,'realModelAllowed':False,'stage':stage,'checkerSHA256':hashlib.sha256(checker_source.encode()).hexdigest()}
    (root/'native-launch-identity.json').write_text(json.dumps(launch,indent=2)+'\n');print(json.dumps({'ownedNativePid':process.pid,'appPath':str(app),'stage':stage,'mockHindsight':True,'authUrlPrinted':False}),flush=True)
    def monitor():
        while not stop.wait(.5) and process.poll() is None:
            owned_pids.update(owned_processes(process.pid))
    monitor_thread=threading.Thread(target=monitor,daemon=True);monitor_thread.start()
    with (owned/'evidence'/('native-'+stage+'.log')).open('w') as log:
        for line in process.stdout:
            auth_match=re.search(r'http://127\.0\.0\.1:\d+/\?token=[^\s\"<>]+',line)
            if auth_match:
                auth_path=root/'ephemeral-auth.url';descriptor=os.open(auth_path,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
                with os.fdopen(descriptor,'w') as auth_file:auth_file.write(auth_match.group(0))
                auth_path.chmod(0o600)
            log.write(sanitize(line));log.flush()
    code=process.wait();stop.set();monitor_thread.join(timeout=2)
finally:
    stop.set()
    if process:
        if process.poll() is None:
            os.killpg(process.pid,signal.SIGTERM)
            try:process.wait(timeout=15)
            except subprocess.TimeoutExpired:os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=5)
        live=owned_processes(process.pid,owned_pids)
        if live:
            # Only members observed under this launcher's own process group.
            for pid in live:
                try:
                    if os.getpgid(pid)==process.pid:os.kill(pid,signal.SIGTERM)
                except ProcessLookupError:pass
            time.sleep(.25);live=owned_processes(process.pid,owned_pids)
        (root/'native-exit.json').write_text(json.dumps({'exitCode':process.returncode,'pid':process.pid,'residualOwnedPids':sorted(live)})+'\n');print(json.dumps({'ownedNativeExitCode':process.returncode,'residualOwnedPids':sorted(live)}),flush=True)
    server.shutdown();server.server_close();server_thread.join(timeout=3)
