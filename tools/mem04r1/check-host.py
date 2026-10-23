#!/usr/bin/env python3
"""Real isolated DSH Host + scripted model + owned mock Hindsight HTTP contract.
This is NOT a real Hindsight or real model test. It never touches a formal Profile.
"""
import argparse, hashlib, json, os, pathlib, re, signal, subprocess, sys, tarfile, threading, time, uuid, socket
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import unquote, urlsplit

ap = argparse.ArgumentParser()
ap.add_argument('--dsh-bin', required=True)
ap.add_argument('--artifact', required=True)
ap.add_argument('--root', required=True)
ap.add_argument('--expected-sha256', required=True)
ap.add_argument('--preflight', action='store_true', help='Exploratory candidate; does not count as final same-package acceptance')
a = ap.parse_args()
root = pathlib.Path(a.root).resolve()
if root.exists() and not (root/'.mem04-r1-owned').is_file():
    raise SystemExit('Refuse an existing directory without the MEM04 ownership marker')
root.mkdir(parents=True, exist_ok=True)
(root/'.mem04-r1-owned').write_text('Owned isolated MEM04 scripted-model/mock-HTTP Host test\n')
artifact = pathlib.Path(a.artifact).resolve()
package_sha = hashlib.sha256(artifact.read_bytes()).hexdigest()
if package_sha != a.expected_sha256:
    raise SystemExit('Candidate SHA256 differs from the explicit expected hash')
for name in ['launch', 'temp', 'cache', 'os-home']:
    (root/name).mkdir(exist_ok=True)
for name in ['user.npmrc', 'global.npmrc']:
    (root/name).write_text('auto-install-peers=false\nstrict-peer-dependencies=false\n')
lock = threading.RLock()
mock_state = {'evidence': 'OWNED_MOCK_HINDSIGHT_HTTP_NOT_REAL_HINDSIGHT', 'apiVersion': '1.1.0', 'requests': [], 'documents': {}, 'operations': {}}
def persist_mock():
    # Host only reads this synthetic fixture state. Atomic replace avoids torn snapshots.
    temp = root/'mock-state.json.next'
    temp.write_text(json.dumps(mock_state, indent=2)+'\n')
    temp.replace(root/'mock-state.json')
def snapshot():
    with lock:
        return json.loads(json.dumps(mock_state))
def remember(kind, method, path, body=None, bank_id=None):
    with lock:
        mock_state['requests'].append({'kind': kind, 'method': method, 'path': path, 'bankId': bank_id, 'body': body})
        persist_mock()
def read_mode():
    file=root/'mock-mode.json'
    if not file.exists():return {'health':'ok','bankStatus':200,'healthDelayMs':0}
    for attempt in range(3):
        try:
            value=json.loads(file.read_text())
            if value.get('health','ok') not in ['ok','disconnect','unhealthy'] or value.get('bankStatus',200) not in [200,404,401]:raise ValueError('Invalid owned mock mode')
            return value
        except (ValueError,OSError):
            time.sleep(.005)
    return {'health':'disconnect','bankStatus':401,'invalidMode':True}
class MockHandler(BaseHTTPRequestHandler):
    def log_message(self,*_):pass
    def reply(self,value,status=200):
        encoded=json.dumps(value).encode()
        try:
            self.send_response(status);self.send_header('Content-Type','application/json');self.send_header('Content-Length',str(len(encoded)));self.end_headers();self.wfile.write(encoded)
        except (BrokenPipeError,ConnectionResetError):pass
    def do_GET(self):
        if self.client_address[0]!='127.0.0.1' or self.headers.get('Authorization'):return self.reply({'detail':'owned credential-free mock only'},403)
        path=urlsplit(self.path).path;mode=read_mode()
        if path=='/health':
            remember('health',self.command,path,{'mode':mode});time.sleep(max(0,min(1000,int(mode.get('healthDelayMs',0))))/1000)
            if mode.get('health')=='disconnect':
                try:self.connection.shutdown(socket.SHUT_RDWR)
                except OSError:pass
                self.connection.close();return
            return self.reply({'status':'healthy' if mode.get('health','ok')=='ok' else 'unhealthy'})
        if path=='/version':remember('version',self.command,path);return self.reply({'api_version':'1.1.0'})
        match=re.fullmatch(r'/v1/default/banks/([^/]+)/profile',path)
        if match:
            bank_id=unquote(match[1]);remember('profile',self.command,path,{'status':mode.get('bankStatus',200)},bank_id)
            return self.reply({'bank_id':bank_id,'name':'Owned synthetic R1 bank'} if mode.get('bankStatus',200)==200 else {'detail':'synthetic bank unavailable'},mode.get('bankStatus',200))
        remember('unexpected',self.command,path);return self.reply({'detail':'Only metadata check routes are allowed in R1'},405)
    def do_POST(self):remember('forbidden',self.command,urlsplit(self.path).path);self.reply({'detail':'No Recall/Retain/model operation in R1 fixture'},405)
    do_PUT=do_POST
    do_DELETE=do_POST

server=ThreadingHTTPServer(('127.0.0.1',0),MockHandler)
server.daemon_threads=True
with lock: persist_mock()
server_thread=threading.Thread(target=server.serve_forever,daemon=True);server_thread.start()
endpoint='http://127.0.0.1:'+str(server.server_address[1])
env={key:os.environ[key] for key in ['PATH','LANG'] if key in os.environ}
env.update(HOME=str(root/'os-home'),CFFIXED_USER_HOME=str(root/'os-home'),DSH_HOME=str(root/'dsh-home'),DSH_TELEMETRY_MODE='DISABLED',TMPDIR=str(root/'temp'),XDG_CACHE_HOME=str(root/'cache'),XDG_DATA_HOME=str(root/'data'),XDG_CONFIG_HOME=str(root/'config'),AGENTS_HOME=str(root/'agents'),npm_config_auto_install_peers='false',npm_config_strict_peer_dependencies='false',npm_config_userconfig=str(root/'user.npmrc'),npm_config_globalconfig=str(root/'global.npmrc'),npm_config_cache=str(root/'cache/npm'),MEM04_R1_MOCK_ENDPOINT=endpoint)
profile='mem04-r1-owned-check'
probe=pathlib.Path(__file__).with_name('host-probe.mjs').resolve()
overlay=root/'probe.yml';overlay.write_text('- insert:\n    - id: mem04-host-probe\n      name: '+str(probe)+'\n')
resources=pathlib.Path(a.dsh_bin).resolve().parents[3]
env.update(RELEASE_CHECK_ROOT=str(root),RELEASE_LLM_MODULE=(resources/'app.asar/dsh/node_modules/@deepseek-ai/dsh-llm/lib/index.js').as_uri())
def sanitized(value):
    return re.sub(r'([?&](?:token|grant|key)=)[^\s"<>]+',r'\1[REDACTED]',value,flags=re.I)
def command(argv,label,allow_failure=False):
    process=subprocess.run(argv,cwd=root/'launch',env=env,capture_output=True,text=True,timeout=100)
    (root/(label+'.log')).write_text(sanitized(process.stdout+process.stderr))
    print(json.dumps({'step':label,'exitCode':process.returncode}),flush=True)
    if process.returncode and not allow_failure: raise RuntimeError('Owned command failed; see '+label+'.log')
    return process.returncode
def owned_processes(pid,known=()):
    rows=[]
    for line in subprocess.check_output(['/bin/ps','-axo','pid=,ppid=,comm='],text=True).splitlines():
        fields=line.strip().split(None,2)
        if len(fields)==3: rows.append((int(fields[0]),int(fields[1])))
    ids={pid,*known}
    while True:
        added={item for item,parent in rows if parent in ids}-ids
        if not added: break
        ids.update(added)
    return {item for item,_ in rows if item in ids}
def stage(name):
    for suffix in ['.json','-failed.json']:
        (root/(name+suffix)).unlink(missing_ok=True)
    (root/(name+'-mock-start.json')).write_text(json.dumps(snapshot(),indent=2))
    output=(root/(name+'.log')).open('w')
    process=subprocess.Popen([a.dsh_bin,'--profile',profile,'--patch',str(overlay),'--no-open','--host','127.0.0.1','--port','0'],cwd=root/'launch',env=dict(env,RELEASE_CHECK_STAGE=name),stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,start_new_session=True)
    def drain():
        for line in process.stdout: output.write(sanitized(line));output.flush()
    reader=threading.Thread(target=drain);reader.start();deadline=time.monotonic()+200;owned={process.pid}
    try:
        while process.poll() is None and time.monotonic()<deadline:
            owned.update(owned_processes(process.pid))
            if (root/(name+'.json')).exists() or (root/(name+'-failed.json')).exists(): break
            time.sleep(.15)
    finally:
        if process.poll() is None: process.send_signal(signal.SIGTERM)
        try: process.wait(timeout=20)
        except subprocess.TimeoutExpired: os.killpg(process.pid,signal.SIGKILL);process.wait(timeout=5)
        reader.join(timeout=5);output.close()
    live=owned_processes(process.pid,owned)
    result={'stage':name,'exitCode':process.returncode,'residualOwnedPids':sorted(live),'passed':(root/(name+'.json')).exists() and process.returncode==0 and not live}
    if (root/(name+'-failed.json')).exists(): result['failure']=json.loads((root/(name+'-failed.json')).read_text())
    (root/(name+'-stage-result.json')).write_text(json.dumps(result,indent=2)+'\n');print(json.dumps(result),flush=True)
    if not result['passed']: raise RuntimeError('Real owned Host stage failed: '+name)
    return result
try:
    cli=a.dsh_bin;command([cli,'--profile',profile,'--from-default-profile','web','--dump-config'],'bootstrap')
    store=str(root/'cache/pnpm');command([cli,'plugin','--profile',profile,'add','file:'+str(artifact),'--offline','--ignore-scripts','--store-dir',store],'install')
    installed=root/'dsh-home/profiles'/profile/'node_modules/dsh-project-threads-wave1-spike';members=[]
    with tarfile.open(artifact) as package:
        for member in package.getmembers():
            if member.isfile():
                local=installed/member.name.removeprefix('package/');body=package.extractfile(member).read()
                assert local.is_file() and local.read_bytes()==body,'Installed member differs from candidate'
                members.append({'path':member.name.removeprefix('package/'),'sha256':hashlib.sha256(body).hexdigest()})
    (root/'installed-members.json').write_text(json.dumps(members,indent=2))
    version=json.loads((installed/'package.json').read_text())['version'];peer_exit=command([cli,'plugin','--profile',profile,'peers','check'],'peers',True)
    runs=[stage('warm'),stage('cold'),stage('disabled'),stage('reenabled')]
    command([cli,'plugin','--profile',profile,'remove','dsh-project-threads-wave1-spike','--store-dir',store],'uninstall');runs.append(stage('uninstalled'))
    provider=[json.loads(path.read_text()) for path in root.glob('provider-*.json')]
    assert provider and all(row['blockedExternalAttempts']==0 and all(c['provider']=='mem04-r1-fixture' for c in row['captures']) for row in provider),'Unexpected external model call'
    summary={'status':'PASS','qualification':'preflight-not-final-acceptance' if a.preflight else 'frozen-package-Host-acceptance','packageSHA256':package_sha,'installedVersion':version,'installedMembers':len(members),'peerCheckExitCode':peer_exit,'runs':runs,'fixtureRequests':sum(row['fixtureRequests'] for row in provider),'blockedExternalAttempts':0,'realModelRequests':0,'realHindsightRequests':0,'mockHindsight':True,'desktopClaim':False,'evidence':'REAL_DSH_R1_SCRIPTED_MODEL_MOCK_METADATA_HTTP','mockCounts':{kind:sum(row['kind']==kind for row in snapshot()['requests']) for kind in ['health','version','profile','forbidden','unexpected']}}
    assert summary['mockCounts']['unexpected']==0 and summary['mockCounts']['forbidden']==0
    (root/'summary.json').write_text(json.dumps(summary,indent=2)+'\n');print(json.dumps(summary),flush=True)
finally:
    server.shutdown();server.server_close();server_thread.join(timeout=3)
