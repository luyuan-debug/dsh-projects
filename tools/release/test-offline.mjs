import {mkdtempSync, readdirSync, mkdirSync, realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import {spawnSync} from 'node:child_process';

// All workspace and Git side effects are confined to a fresh synthetic test root.
const root = realpathSync(mkdtempSync(join(tmpdir(), 'dsh-projects-tests-')));
for (const name of ['mac01', 'mac03', 'temp']) mkdirSync(join(root, name));
const groups = ['wave1-lifecycle', 'mac01', 'mac02', 'mac03r1', 'mac04r1', 'mac04r2', 'final01'];
const macOnly = new Set(['mac04r2/reader.test.mjs']);
const mac = process.argv.includes('--mac');
if (mac && process.platform !== 'darwin') throw new Error('--mac requires macOS');
const files = groups.flatMap(group => readdirSync('tests/' + group)
  .filter(name => name.endsWith('.test.mjs'))
  .filter(name => !macOnly.has(group + '/' + name) || mac)
  .map(name => 'tests/' + group + '/' + name));
const result = spawnSync(process.execPath, ['--test', ...files], {
  stdio: 'inherit',
  env: {...process.env, TMPDIR: join(root, 'temp'), MAC01_TEST_ROOT: join(root, 'mac01'),
    MAC03_TEST_ROOT: join(root, 'mac03'), R2_FIXTURES: resolve('tests/fixtures/readers'),
    MAC02_MIGRATION_SNAPSHOT: resolve('tests/fixtures/migration-snapshot.json')},
});
process.exit(result.status ?? 1);
