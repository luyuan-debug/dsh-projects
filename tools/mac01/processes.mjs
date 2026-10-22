import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const execute = promisify(execFile);
export function parseProcessRows(text) {
  return text.split(/\r?\n/).flatMap(line => {
    const match = /^\s*(\d+)\s+(\d+)\s+(.+?)\s*$/.exec(line);
    return match ? [{ pid: Number(match[1]), ppid: Number(match[2]), executable: match[3] }] : [];
  });
}
export async function darwinProcesses() {
  const { stdout } = await execute('/bin/ps', ['-axo', 'pid=,ppid=,comm='], { maxBuffer: 4 * 1024 * 1024 });
  return parseProcessRows(stdout);
}
export async function linuxProcesses() {
  const { stdout } = await execute('ps', ['-eo', 'pid=,ppid=,comm='], { maxBuffer: 4 * 1024 * 1024 });
  return parseProcessRows(stdout);
}
export function selectOwned(rows, rootPid, knownPids = []) {
  const owned = new Set([rootPid, ...knownPids]);
  for (;;) { const additions = rows.filter(row => owned.has(row.ppid) && !owned.has(row.pid)); if (!additions.length) break; for (const row of additions) owned.add(row.pid); }
  return rows.filter(row => owned.has(row.pid));
}
export async function ownedProcesses(rootPid, knownPids = [], platform = process.platform) {
  const rows = platform === 'darwin' ? await darwinProcesses() : platform === 'linux' ? await linuxProcesses() : (() => { throw new Error('Unsupported process inventory platform: ' + platform); })();
  return selectOwned(rows, rootPid, knownPids);
}
