#!/usr/bin/env python3
"""Verify the one-ZIP delivery, frozen package and offline Git restoration."""
import argparse, hashlib, io, json, pathlib, subprocess, tarfile, tempfile, zipfile

parser = argparse.ArgumentParser()
parser.add_argument('archive')
args = parser.parse_args()
archive = pathlib.Path(args.archive).resolve()
with zipfile.ZipFile(archive) as bundle:
    if bundle.testzip() is not None:
        raise SystemExit('ZIP CRC mismatch')
    names = bundle.namelist()
    if len(names) != len(set(names)):
        raise SystemExit('Duplicate ZIP member')
    for name in names:
        path = pathlib.PurePosixPath(name)
        if path.is_absolute() or '..' in path.parts:
            raise SystemExit('Unsafe ZIP path')
    prefix = names[0].split('/')[0] + '/'
    manifest = json.loads(bundle.read(prefix + 'MANIFEST.json'))
    observed = {name.removeprefix(prefix) for name in names if not name.endswith('/')}
    if observed != set(manifest['files']) | {'MANIFEST.json'}:
        raise SystemExit('ZIP members differ from manifest')
    for relative, expected in manifest['files'].items():
        if hashlib.sha256(bundle.read(prefix + relative)).hexdigest() != expected:
            raise SystemExit('Manifest mismatch: ' + relative)
    identity = json.loads(bundle.read(prefix + 'SOURCE_AND_PACKAGE_IDENTITY.json'))
    artifact = bundle.read(prefix + identity['packagePath'])
    if hashlib.sha256(artifact).hexdigest() != identity['packageSHA256']:
        raise SystemExit('Artifact identity mismatch')
    with tarfile.open(fileobj=io.BytesIO(artifact)) as package:
        files = [member for member in package.getmembers() if member.isfile()]
        metadata = json.load(package.extractfile('package/package.json'))
        if metadata['version'] != identity['version'] or len(files) != identity['packageMembers']:
            raise SystemExit('Artifact version/member mismatch')
    with tempfile.TemporaryDirectory(prefix='mem04-offline-restore-') as temp:
        root = pathlib.Path(temp)
        source_bundle = root/'source.bundle'
        source_bundle.write_bytes(bundle.read(prefix + 'source/MEM04-source.bundle'))
        restore = root/'restored'
        subprocess.run(['git', 'clone', '--quiet', '--branch', identity['branch'], str(source_bundle), str(restore)], check=True, capture_output=True)
        actual = subprocess.check_output(['git', 'rev-parse', 'HEAD'], cwd=restore, text=True).strip()
        if actual != identity['commit']:
            raise SystemExit('Restored commit mismatch')
        expected_tree = json.loads(bundle.read(prefix + 'source/SOURCE_TREE_SHA256.json'))
        tracked = subprocess.check_output(['git', 'ls-files', '-z'], cwd=restore).decode().split('\0')[:-1]
        if set(tracked) != set(expected_tree):
            raise SystemExit('Restored tracked files mismatch')
        for relative, expected in expected_tree.items():
            if hashlib.sha256((restore/relative).read_bytes()).hexdigest() != expected:
                raise SystemExit('Restored source mismatch: ' + relative)
        dirty = subprocess.check_output(['git', 'status', '--porcelain'], cwd=restore, text=True)
        if dirty:
            raise SystemExit('Restored source is not clean')
print(json.dumps({'status': 'PASS', 'archiveSHA256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'members': len(observed), 'manifestEntries': len(manifest['files']), 'packageMembers': len(files), 'sourceFiles': len(expected_tree), 'commit': actual, 'networkRequests': 0}, indent=2))
