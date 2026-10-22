"""Bounded release-tree/history scanner; never emits matched values."""
import argparse, hashlib, json, pathlib, re, subprocess, getpass, tarfile, zipfile, io

ap = argparse.ArgumentParser()
ap.add_argument('--history', action='store_true')
ap.add_argument('--package')
args = ap.parse_args()
root = pathlib.Path(__file__).resolve().parents[2]
rules = {
    'github-token': rb'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{30,})',
    'api-key': rb'(?:sk-[A-Za-z0-9_-]{20,}|AKIA[A-Z0-9]{16}|AIza[A-Za-z0-9_-]{30,})',
    'private-key': rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
    'bearer-credential': rb'(?i)(?:authorization\s*[:=]\s*[\x22\x27]?Bearer\s+)[A-Za-z0-9._-]{12,}',
    'credential-assignment': rb'(?i)(?:api[_-]?key|access[_-]?token|oauth[_-]?token|password|cookie)\s*[\x22\x27]?\s*[:=]\s*[\x22\x27]([^\x22\x27\s]{8,})[\x22\x27]',
    'user-absolute-path': rb'/(?:Users/[A-Za-z0-9_.-]+|home/[A-Za-z0-9_.-]+|root/)[^\s\x00\x22\x27<>]*',
    'email': rb'[A-Za-z0-9_.+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}',
}
allow_path = root / 'tools/release/security-allowlist.json'
allow = json.loads(allow_path.read_text()) if allow_path.exists() else []
findings = []
def scan(name, data, revision='working-tree'):
    digest = hashlib.sha256(data).hexdigest()
    for kind, pattern in rules.items():
        for match in re.finditer(pattern, data):
            line = data[:match.start()].count(b'\n') + 1
            accepted = next((row for row in allow if row['path'] == name and row['type'] == kind and row['sha256'] == digest and row['line'] == line), None)
            findings.append({'path': name, 'type': kind, 'line': line, 'revision': revision,
                             'sha256': digest, 'status': 'ALLOWLISTED' if accepted else 'BLOCK',
                             'reason': accepted['reason'] if accepted else 'Requires explicit review'})
    local_account = getpass.getuser().encode()
    if len(local_account) > 3 and local_account.lower() in data.lower():
        line = data[:data.lower().index(local_account.lower())].count(b'\n') + 1
        accepted = next((row for row in allow if row['path'] == name and row['type'] == 'local-account'
                         and row['sha256'] == digest and row['line'] == line), None)
        findings.append({'path': name, 'type': 'local-account', 'line': line, 'sha256': digest,
                         'revision': revision, 'status': 'ALLOWLISTED' if accepted else 'BLOCK',
                         'reason': accepted['reason'] if accepted else 'Requires explicit review'})
    if name.endswith(('.docx', '.xlsx', '.pptx')):
        try:
            with zipfile.ZipFile(io.BytesIO(data)) as z:
                # Synthetic adverse fixtures may deliberately be highly compressed.
                for member in z.infolist():
                    if member.file_size <= 1000000:
                        scan(name + '!' + member.filename, z.read(member), revision)
        except (zipfile.BadZipFile, RuntimeError):
            pass

excluded = {'.git', 'node_modules', 'work', 'release-artifacts', '__pycache__'}
files = [p for p in root.rglob('*') if p.is_file() and not any(x in excluded for x in p.relative_to(root).parts)]
for p in files:
    name = p.relative_to(root).as_posix()
    if p.name.startswith('.env') or p.suffix in {'.pem', '.key', '.p12', '.pfx', '.log', '.jsonl', '.bundle', '.tgz', '.zip'}:
        findings.append({'path': name, 'type': 'prohibited-file', 'revision': 'working-tree', 'status': 'BLOCK'})
    scan(name, p.read_bytes())

history_commits = []
if args.history:
    history_commits = subprocess.check_output(['git', 'rev-list', '--all'], cwd=root, text=True).splitlines()
    for commit in history_commits:
        scan('<commit-metadata>', subprocess.check_output(['git', 'show', '-s', '--format=fuller', commit], cwd=root), commit)
        listing = subprocess.check_output(['git', 'ls-tree', '-r', '-z', commit], cwd=root)
        for row in listing.split(b'\0'):
            if not row:
                continue
            metadata, path = row.split(b'\t', 1)
            oid = metadata.split()[2].decode()
            name = path.decode()
            scan(name, subprocess.check_output(['git', 'cat-file', 'blob', oid], cwd=root), commit)
if args.package:
    with tarfile.open(args.package) as tar:
        for m in tar.getmembers():
            if m.isfile():
                # Strip npm's package/ so policy entries apply to the source member too.
                name = m.name.removeprefix('package/')
                scan(name, tar.extractfile(m).read(), 'release-package')
print(json.dumps({'files': len(files), 'historyCommits': history_commits,
                  'findings': findings, 'blocked': sum(f['status'] == 'BLOCK' for f in findings)}, indent=2))
raise SystemExit(1 if any(f['status'] == 'BLOCK' for f in findings) else 0)
