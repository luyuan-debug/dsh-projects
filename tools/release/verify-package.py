"""Compare every npm tar member to the release tree, including bundled deps."""
import argparse, pathlib, tarfile, hashlib, json
ap = argparse.ArgumentParser()
ap.add_argument('artifact')
a = ap.parse_args()
root = pathlib.Path(__file__).resolve().parents[2]
rows = []
with tarfile.open(a.artifact) as tar:
    for m in tar.getmembers():
        name = pathlib.PurePosixPath(m.name)
        if name.is_absolute() or '..' in name.parts or not m.name.startswith('package/'):
            raise SystemExit('Unsafe package path')
        if m.issym() or m.islnk():
            raise SystemExit('Unexpected link in npm release')
        if not m.isfile(): continue
        relative = m.name.removeprefix('package/')
        if relative.startswith(('tests/', 'tools/', '.git/', 'evidence/', 'logs/')):
            raise SystemExit('Unexpected non-product member')
        data = tar.extractfile(m).read()
        local = root/relative
        if not local.is_file() or local.read_bytes() != data:
            raise SystemExit('Package/source mismatch: '+relative)
        rows.append({'path': relative, 'sha256': hashlib.sha256(data).hexdigest()})
print(json.dumps({'status': 'PASS', 'members': len(rows), 'packageSHA256': hashlib.sha256(pathlib.Path(a.artifact).read_bytes()).hexdigest(), 'files': rows}, indent=2))
