"""Real isolated DSH lifecycle check, scripted model only; never opens production."""
import argparse, pathlib, os, subprocess, json, time, signal, re, tarfile, hashlib, threading

ap = argparse.ArgumentParser()
ap.add_argument('--dsh-bin', required=True)
ap.add_argument('--artifact', required=True)
ap.add_argument('--root', required=True)
ap.add_argument('--upgrade-from', help='Optional older package used to create data before upgrading')
a = ap.parse_args()
root = pathlib.Path(a.root).resolve()
if root.exists() and not (root / '.release-owned').exists():
    raise SystemExit('Refuse an existing directory without this check ownership marker')
root.mkdir(parents=True, exist_ok=True)
(root / '.release-owned').write_text('Owned isolated release lifecycle check\n')
for n in ['launch', 'temp', 'cache', 'os-home']:
    (root / n).mkdir(exist_ok=True)
for n in ['user.npmrc', 'global.npmrc']:
    (root / n).write_text('auto-install-peers=false\nstrict-peer-dependencies=false\n')
env = {k: os.environ[k] for k in ['PATH', 'LANG'] if k in os.environ}
env.update(HOME=str(root/'os-home'), DSH_HOME=str(root/'dsh-home'), DSH_TELEMETRY_MODE='DISABLED',
           TMPDIR=str(root/'temp'), XDG_CACHE_HOME=str(root/'cache'), XDG_DATA_HOME=str(root/'data'),
           XDG_CONFIG_HOME=str(root/'config'), AGENTS_HOME=str(root/'agents'),
           npm_config_auto_install_peers='false', npm_config_strict_peer_dependencies='false',
           npm_config_userconfig=str(root/'user.npmrc'), npm_config_globalconfig=str(root/'global.npmrc'),
           npm_config_cache=str(root/'cache/npm'))
artifact = pathlib.Path(a.artifact).resolve()
profile = 'release-check'
repo = pathlib.Path(__file__).resolve().parents[2]
probe = pathlib.Path(__file__).with_name('host-probe.mjs')
overlay = root/'probe.yml'
overlay.write_text('- insert:\n    - id: release-check-probe\n      name: '+str(probe)+'\n')
resources = pathlib.Path(a.dsh_bin).resolve().parents[3]
env.update(RELEASE_CHECK_ROOT=str(root), RELEASE_LLM_MODULE=(resources/'app.asar/dsh/node_modules/@deepseek-ai/dsh-llm/lib/index.js').as_uri())
def sanitized(value):
    return re.sub(r'([?&](?:token|grant|key)=)[^\s"<>]+', r'\1[REDACTED]', value, flags=re.I)
def command(argv, label, allow_failure=False):
    p = subprocess.run(argv, cwd=root/'launch', env=env, capture_output=True, text=True, timeout=100)
    (root/(label+'.log')).write_text(sanitized(p.stdout+p.stderr))
    print(json.dumps({'step': label, 'exitCode': p.returncode}), flush=True)
    if p.returncode and not allow_failure:
        raise RuntimeError('Isolated command failed; see '+label+'.log')
    return p.returncode
def owned_processes(pid, known=()):
    rows = []
    for line in subprocess.check_output(['/bin/ps', '-axo', 'pid=,ppid=,comm='], text=True).splitlines():
        fields = line.strip().split(None, 2)
        if len(fields) == 3: rows.append((int(fields[0]), int(fields[1])))
    ids = {pid, *known}
    while True:
        added = {p for p, parent in rows if parent in ids} - ids
        if not added: break
        ids.update(added)
    return {p for p, _ in rows if p in ids}
def stage(name):
    stage_env = dict(env, RELEASE_CHECK_STAGE=name)
    output = (root/(name+'.log')).open('w')
    p = subprocess.Popen([a.dsh_bin, '--profile', profile, '--patch', str(overlay), '--no-open', '--host', '127.0.0.1', '--port', '0'],
                         cwd=root/'launch', env=stage_env, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    def drain():
        for line in p.stdout:
            output.write(sanitized(line)); output.flush()
    reader = threading.Thread(target=drain); reader.start()
    deadline = time.monotonic()+65
    owned = {p.pid}
    try:
        while p.poll() is None and time.monotonic() < deadline:
            owned.update(owned_processes(p.pid))
            if (root/(name+'.json')).exists() or (root/(name+'-failed.json')).exists(): break
            time.sleep(.15)
    finally:
        if p.poll() is None: p.send_signal(signal.SIGTERM)
        try: p.wait(timeout=15)
        except subprocess.TimeoutExpired:
            os.killpg(p.pid, signal.SIGKILL); p.wait(timeout=5)
        reader.join(timeout=5); output.close()
        log = root/(name+'.log'); log.write_text(sanitized(log.read_text()))
    live = owned_processes(p.pid, owned)
    result = {'stage': name, 'exitCode': p.returncode, 'residualOwnedPids': sorted(live)}
    if (root/(name+'-failed.json')).exists():
        result['failure'] = json.loads((root/(name+'-failed.json')).read_text())
    result['passed'] = (root/(name+'.json')).exists() and p.returncode == 0 and not live
    print(json.dumps(result), flush=True)
    if not result['passed']: raise RuntimeError('Host stage failed: '+name)
    return result

cli = a.dsh_bin
command([cli, '--profile', profile, '--from-default-profile', 'web', '--dump-config'], 'bootstrap')
store = str(root/'cache/pnpm')
installed = root/'dsh-home/profiles'/profile/'node_modules/dsh-project-threads-wave1-spike'
def install_package(package, label):
    command([cli, 'plugin', '--profile', profile, 'add', 'file:'+str(package), '--offline', '--ignore-scripts', '--store-dir', store], label)
    members = []
    with tarfile.open(package) as tar:
        for m in tar.getmembers():
            if m.isfile():
                local = installed/m.name.removeprefix('package/')
                data = tar.extractfile(m).read()
                assert local.is_file() and local.read_bytes() == data, 'Installed member mismatch'
                members.append({'path': m.name.removeprefix('package/'), 'sha256': hashlib.sha256(data).hexdigest()})
    return members
runs = []
baseline_version = None
if a.upgrade_from:
    baseline = pathlib.Path(a.upgrade_from).resolve()
    install_package(baseline, 'install-baseline')
    baseline_version = json.loads((installed/'package.json').read_text())['version']
    runs.extend([stage('warm'), stage('cold')])
members = install_package(artifact, 'upgrade' if a.upgrade_from else 'install')
installed_version = json.loads((installed/'package.json').read_text())['version']
(root/'installed-members.json').write_text(json.dumps(members, indent=2))
peer_exit = command([cli, 'plugin', '--profile', profile, 'peers', 'check'], 'peers', True)
runs.extend([stage('upgraded')] if a.upgrade_from else [stage('warm'), stage('cold')])
runs.extend([stage('disabled'), stage('reenabled')])
command([cli, 'plugin', '--profile', profile, 'remove', 'dsh-project-threads-wave1-spike', '--store-dir', store], 'uninstall')
runs.append(stage('uninstalled'))
summary = {'status': 'PASS', 'packageSHA256': hashlib.sha256(artifact.read_bytes()).hexdigest(), 'installedMembers': len(members),
           'installedVersion': installed_version, 'upgradeFromVersion': baseline_version,
           'peerCheckExitCode': peer_exit, 'runs': runs, 'paidRequests': 0, 'evidence': 'REAL_HOST_SCRIPTED_MODEL', 'desktopClaim': False}
(root/'summary.json').write_text(json.dumps(summary, indent=2)+'\n')
print(json.dumps(summary), flush=True)
