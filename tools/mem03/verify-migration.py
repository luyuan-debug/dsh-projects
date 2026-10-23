"""Compare an owned actual Host's schema-4 backup with its post-upgrade state.

This is state comparison from a real fixture, not a real-model or desktop test.
It never opens a production Profile and prints no memory bodies or source text.
"""
import argparse
import base64
import hashlib
import json
import pathlib

parser = argparse.ArgumentParser()
parser.add_argument('--root', required=True)
args = parser.parse_args()
root = pathlib.Path(args.root).resolve()
assert (root / '.mem03-owned').is_file(), 'An owned MEM03 test root is required'
backups = list(root.glob('data/**/migration-backups/*projects*.json'))
assert len(backups) == 1, 'Expected one coordinated schema-4 to schema-5 backup'
backup = json.loads(backups[0].read_text())
original = base64.b64decode(backup['sourceBytesBase64'])
assert hashlib.sha256(original).hexdigest() == backup['sourceSha256']
old = json.loads(original)
current_path = next((root / 'dsh-home/storages').glob('*projects.json'))
new = json.loads(current_path.read_text())
assert old['unit']['version'] == 4 and new['unit']['version'] == 5
checks = []
for project_id, project in old['tables']['projects'].items():
    current = new['tables']['projects'][project_id]
    assert current['projectId'] == project['projectId']
    assert current['coordinatorSessionId'] == project['coordinatorSessionId']
    assert set(project['threadIds']).issubset(current['threadIds'])
    for entry in project['memoryEntries']:
        actual = next(value for value in current['memoryEntries'] if value['entryId'] == entry['entryId'])
        for field in ['entryId', 'name', 'content', 'revision', 'origin', 'source', 'reason', 'updatedAt', 'deleted']:
            if field in entry:
                assert actual[field] == entry[field], 'An existing memory field changed: ' + field
        if not entry.get('deleted'):
            assert actual['sourceRefs'] == [{'kind': 'legacy-source', 'verified': False}]
    for item in project['libraryItems']:
        assert next(value for value in current['libraryItems'] if value['itemId'] == item['itemId']) == item
    checks.append({'projectId': project_id, 'coordinatorSessionIdPreserved': True, 'oldThreadIdsPreserved': True,
                   'memoryIdsBodiesRevisionsOriginsSourcesPreserved': len(project['memoryEntries']),
                   'legacySourceNotForged': True, 'libraryItemsEntireMetadataPreserved': len(project['libraryItems'])})
report = {'status': 'PASS', 'evidence': 'REAL_DSH_FIXTURE_STATE_COMPARISON', 'sourceSchema': 4, 'targetSchema': 5,
          'backupSourceSHA256': backup['sourceSha256'], 'backupSourceBytesHashVerified': True, 'checks': checks}
(root / 'migration-preservation.json').write_text(json.dumps(report, indent=2) + '\n')
print(json.dumps(report))
