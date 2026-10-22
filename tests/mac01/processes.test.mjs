import test from 'node:test';
import assert from 'node:assert/strict';
import { parseProcessRows, selectOwned } from '../../tools/mac01/processes.mjs';
test('Darwin ps preserves executable paths containing spaces and filters only owned descendants',()=>{
 const rows=parseProcessRows('  10  1 /Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness\n11 10 /usr/bin/helper\n20 1 unrelated\n');
 assert.equal(rows[0].executable,'/Applications/DeepSeek Harness.app/Contents/MacOS/DeepSeek Harness'); assert.deepEqual(selectOwned(rows,10).map(r=>r.pid),[10,11]);
});
test('Linux ps fixture and retained child PIDs never include unrelated process names or environment',()=>{
 const rows=parseProcessRows('101 1 node\n102 101 node-worker\n103 102 sh\n104 1 unrelated\n');assert.deepEqual(selectOwned(rows,101).map(r=>r.pid),[101,102,103]);assert.deepEqual(selectOwned(rows,999,[103]).map(r=>r.pid),[103]);assert.equal('environment' in rows[0],false);
});
