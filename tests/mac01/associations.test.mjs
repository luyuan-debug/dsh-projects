import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { ThreadAssociations, associationKey } from '../../src/product/domain/thread-associations.mjs';

function barrier() { let resolve; const promise = new Promise(r => { resolve = r; }); return { resolve, promise }; }
const root = process.env.MAC01_TEST_ROOT;
if (!root) throw new Error('MAC01_TEST_ROOT must be an explicit non-temporary directory outside source');
async function fixture() {
  const path = join(root, 'associations-' + randomUUID()); await mkdir(path, { recursive: true });
  const file = join(path, 'links.json'); const records = new Map(); let tail = Promise.resolve();
  const table = { get: key => records.get(key), entries: () => [...records.entries()], async put(key, value) {
    const result = tail.then(async () => { const next = new Map(records); next.set(key, structuredClone(value)); await writeFile(file + '.next', JSON.stringify([...next])); await rename(file + '.next', file); records.clear(); for (const entry of next) records.set(...entry); });
    tail = result.catch(() => {}); return result;
  } };
  const scope = { projectId: randomUUID(), coordinatorSessionId: randomUUID() };
  const scopes = new Map([[scope.projectId, scope]]); const durableSessions = new Map(); const publications = [];
  const calls = { create: 0, resume: 0, release: 0, require: 0 };
  const sessions = {
    async requireUserMessage(_scope, messageId) { calls.require++; if (!['message-a','message-b'].includes(messageId)) throw Object.assign(new Error('not persisted'), { code: 'MESSAGE_NOT_PERSISTED' }); return { seq: messageId === 'message-a' ? 2 : 9 }; },
    async ensureThread(record, { allowCreate }) { if (durableSessions.has(record.threadSessionId)) calls.resume++; else { if (!allowCreate) throw Object.assign(new Error('missing'), { code: 'THREAD_SESSION_MISSING' }); calls.create++; durableSessions.set(record.threadSessionId, { root: true, threadId: record.threadId }); } },
    async releaseThread() { calls.release++; },
    async publish(record) { if (!publications.some(r => r.threadId === record.threadId && r.version >= record.version)) publications.push(structuredClone(record)); },
  };
  const service = () => new ThreadAssociations({ table, scopes, sessions });
  const input = overrides => ({ ...scope, messageId: 'message-a', idempotencyKey: randomUUID(), title: '测试 Thread', ...overrides });
  return { path, file, records, table, scope, scopes, durableSessions, publications, calls, sessions, service, input };
}
test('one persisted message creates one root identity and an on-disk active association', async () => {
  const f = await fixture(), s = f.service(), request = f.input({ extra: 'must not leak into the durable schema' });
  const out = await s.create(request); assert.equal(out.delivery.state, 'persisted'); assert.equal(f.calls.create, 1);
  const disk = JSON.parse(await readFile(f.file, 'utf8')); assert.equal(disk[0][1].phase, 'active'); assert.equal(disk[0][1].extra, undefined);
  assert.equal(out.association.messageSeq, 2); assert.notEqual(out.association.threadId, out.association.threadSessionId); await s.close();
});
test('one message can acquire two distinct Threads; two messages preserve their respective associations', async () => {
  const f = await fixture(), s = f.service();
  const a = await s.create(f.input()), b = await s.create(f.input()), c = await s.create(f.input({ messageId: 'message-b' }));
  assert.equal(new Set([a,b,c].map(x => x.association.threadSessionId)).size, 3);
  assert.deepEqual(s.list(f.scope.projectId).map(x => x.messageSeq), [2,2,9]); await s.close();
});
test('same key is idempotent and a changed request conflicts', async () => {
  const f = await fixture(), s = f.service(), input = f.input(); const a = await s.create(input), b = await s.create(input);
  assert.equal(b.reused, true); assert.deepEqual(a.association, b.association); assert.equal(f.calls.create, 1); assert.equal(f.publications.length, 1);
  await assert.rejects(s.create({ ...input, messageId: 'message-b' }), { code: 'IDEMPOTENCY_CONFLICT' }); await s.close();
});
test('concurrent identical requests share one reserved ID and one creation, using an explicit barrier', async () => {
  const f = await fixture(), entered = barrier(), release = barrier(), ensure = f.sessions.ensureThread;
  f.sessions.ensureThread = async (...args) => { entered.resolve(); await release.promise; return ensure(...args); };
  const s = f.service(), input = f.input(), requests = Array.from({ length: 12 }, () => s.create(input));
  await entered.promise; release.resolve(); const values = await Promise.all(requests);
  assert.equal(new Set(values.map(x => x.association.threadId)).size, 1); assert.equal(f.calls.create, 1); assert.equal(f.records.size, 1); await s.close();
});
test('a Thread creation failure leaves only a pending reservation and no successful card', async () => {
  const f = await fixture(); f.sessions.ensureThread = async () => { throw new Error('factory failure'); };
  const s = f.service(); await assert.rejects(s.create(f.input()), { code: 'CREATE_NOT_COMMITTED' });
  assert.equal(s.list(f.scope.projectId).length, 0); assert.equal(s.pending(f.scope.projectId).length, 1); assert.equal(f.publications.length, 0); assert.equal(f.calls.release, 1);
  assert.equal(JSON.parse(await readFile(f.file, 'utf8'))[0][1].phase, 'pending'); await s.close();
});
test('association commit failure compensates the handle; retry resumes the same durable Thread', async () => {
  const f = await fixture(), put = f.table.put; let fail = true;
  f.table.put = async (key, row) => { if (row.phase === 'active' && fail) { fail = false; throw new Error('disk failure'); } return put(key, row); };
  const s = f.service(), input = f.input(); await assert.rejects(s.create(input), { code: 'CREATE_NOT_COMMITTED' });
  const reserved = s.pending(f.scope.projectId)[0]; assert.equal(f.publications.length, 0); assert.equal(f.calls.release, 1);
  const out = await s.create(input); assert.equal(out.association.threadSessionId, reserved.threadSessionId); assert.equal(f.calls.create, 1); assert.equal(f.calls.resume, 1); assert.equal(f.publications.length, 1); await s.close();
});
test('failed reservation write creates no Session and publishes nothing', async () => {
  const f = await fixture(); f.table.put = async () => { throw new Error('reservation IO'); }; const s = f.service();
  await assert.rejects(s.create(f.input()), /reservation IO/); assert.equal(f.calls.create, 0); assert.equal(f.publications.length, 0); await s.close();
});
test('temporary publication failure records delivery debt; a new service recovers without new IDs', async () => {
  const f = await fixture(), publish = f.sessions.publish; f.sessions.publish = async () => { throw Object.assign(new Error('offline'), { code: 'DELIVERY_DOWN' }); };
  const s = f.service(), input = f.input(); const out = await s.create(input); assert.equal(out.delivery.state, 'pending'); assert.equal(s.list(f.scope.projectId).length, 1); await s.close();
  f.records.clear(); for (const pair of JSON.parse(await readFile(f.file, 'utf8'))) f.records.set(...pair);
  f.sessions.publish = publish; const restarted = f.service(); await restarted.recover(); await restarted.recover();
  assert.equal(f.calls.create, 1); assert.equal(f.publications.length, 1); assert.equal(restarted.list(f.scope.projectId)[0].threadId, out.association.threadId); await restarted.close();
});
test('status changes commit a higher version; replay is repeatable', async () => {
  const f = await fixture(), s = f.service(); const { association: a } = await s.create(f.input());
  const { association: b } = await s.update({ projectId: a.projectId, threadId: a.threadId, status: 'completed' });
  assert.equal(b.version, 2); assert.equal(b.status, 'completed'); assert.equal(f.publications.length, 2);
  await s.recover(); assert.equal(f.publications.length, 2); assert.equal(JSON.parse(await readFile(f.file, 'utf8'))[0][1].version, 2); await s.close();
});
test('a failed status write does not publish or mutate the prior committed association', async () => {
  const f = await fixture(), s = f.service(); const { association: a } = await s.create(f.input()); f.table.put = async () => { throw new Error('status IO'); };
  await assert.rejects(s.update({ projectId: a.projectId, threadId: a.threadId, status: 'completed' }), /status IO/);
  assert.equal(s.list(a.projectId)[0].status, 'created'); assert.equal(f.publications.length, 1); await s.close();
});
test('cold recovery never recreates a missing active Thread Session', async () => {
  const f = await fixture(), s = f.service(); const out = await s.create(f.input()); await s.close(); f.durableSessions.delete(out.association.threadSessionId);
  const restarted = f.service(); await assert.rejects(restarted.recover(), AggregateError); assert.equal(f.calls.create, 1); await restarted.close();
});
test('close rejects new work while draining an already accepted creation', async () => {
  const f = await fixture(), entered = barrier(), release = barrier(), ensure = f.sessions.ensureThread;
  f.sessions.ensureThread = async (...args) => { entered.resolve(); await release.promise; return ensure(...args); };
  const s = f.service(), creating = s.create(f.input()); await entered.promise; const close = s.close(); assert.equal(s.close(), close);
  await assert.rejects(s.create(f.input()), { code: 'SERVICE_CLOSED' }); release.resolve(); await creating; await close;
});
test('unknown scopes and non-durable messages fail before a reservation or Thread', async () => {
  const f = await fixture(), s = f.service(); await assert.rejects(s.create(f.input({ coordinatorSessionId: 'foreign' })), { code: 'SCOPE_MISMATCH' });
  await assert.rejects(s.create(f.input({ messageId: 'missing' })), { code: 'MESSAGE_NOT_PERSISTED' }); assert.equal(f.records.size, 0); assert.equal(f.calls.create, 0); await s.close();
});
