import test from 'node:test';
import assert from 'node:assert/strict';
import { Projects } from '../../src/product/domain/projects.mjs';
import { ProjectHindsightRuntime } from '../../src/product/host/project-hindsight-runtime.mjs';

const operationId = '550e8400-e29b-41d4-a716-446655440000';
const clone = value => structuredClone(value);
function table() {
  const data = new Map();
  return { get: id => clone(data.get(id)), entries: () => [...data].map(([id, value]) => [id, clone(value)]),
    put: async (id, value) => { data.set(id, clone(value)); }, delete: async id => { data.delete(id); } };
}
async function fixture(t, overrides = {}, { competingHook = () => false } = {}) {
  const projects = table(), tables = { preferences: table(), outbox: table(), runs: table() }, calls = [];
  let next = 0;
  const registry = new Projects({ table: projects, createScope: async () => { const projectId = 'p' + ++next; return { projectId, coordinatorSessionId: projectId + '-co' }; }, validateModel: async () => {} });
  await registry.create({ name: 'Synthetic P1' }); await registry.create({ name: 'Synthetic P2' });
  const responses = { health: { healthy: true, version: '1.1.0' }, bank: { bankId: 'test-bank' },
    recall: { items: [], truncated: false }, retain: { status: 'accepted', operationId },
    operation: { status: 'completed', operationId }, document: Object.assign(new Error('synthetic missing'), { status: 404 }),
    createBank: {}, deleteDocument: { status: 'completed' }, ...overrides };
  const client = Object.fromEntries(Object.keys(responses).map(method => [method, async (...args) => {
    calls.push({ method, bankId: args[0], args: args.map(value => value?.signal ? { ...value, signal: '[signal]' } : value) });
    const response = responses[method];
    if (response instanceof Error) throw response;
    return typeof response === 'function' ? response(...args) : clone(response);
  }]));
  const runtime = new ProjectHindsightRuntime({ registry, tables, namespace: 'synthetic-mem04', clientFactory: () => client, competingHook });
  t.after(async () => runtime.close());
  const settings = async (config, projectId = 'p1') => runtime.settings({ projectId, expectedRevision: runtime.state(projectId).config.revision, config });
  const enable = (config = {}, id = 'p1') => settings({ enabled: true, endpoint: 'http://127.0.0.1:1', bankId: 'test-bank',
    bankScopeConfirmed: true, routeAuthorization: 'local-free', ...config }, id);
  const reports = async (id = 'report-1', options = {}) => {
    const projectId = options.projectId ?? 'p1', runId = 'run-' + id;
    const run = { runId, projectId, threadId: 't1', sessionId: 's1', turn: 1, activity: 'Idle', endedAt: 1,
      endReason: { kind: 'completed' }, resultRefs: [{ messageId: 'm1' }], errors: [], ...options.run };
    const report = { reportId: id, runId, projectId, threadId: run.threadId, sessionId: run.sessionId, turn: run.turn,
      activity: 'Completed', reason: { kind: 'completed' }, outputs: [{ messageId: 'm1', text: 'Synthetic report: tests passed with no external service.' }],
      resultRefs: run.resultRefs, errors: [], libraryRefs: [], trust: 'untrusted-thread-output', ...options.report };
    const row = { projectId, sessionId: projectId + '-co', reportId: id, runId, report, delivery: 'prepared' };
    if (options.persistRun !== false) await tables.runs.put(runId, run);
    if (options.persistReport !== false) await tables.outbox.put(id, row);
    return row;
  };
  return { runtime, registry, tables, calls, responses, settings, enable, reports };
}
const count = (f, method) => f.calls.filter(call => call.method === method).length;
const writable = { retainEnabled: true, shareReportsConfirmed: true };

test('default Standard mode never constructs a network operation or queues old reports', async t => {
  const f = await fixture(t), before = f.runtime.state('p1');
  assert.equal(before.config.enabled, false);
  assert.equal((await f.runtime.recall({ projectId: 'p1', query: 'anything' })).state, 'disabled');
  assert.deepEqual(await f.runtime.queueReport('p1', await f.reports()), { queued: false, reason: 'disabled' });
  await f.runtime.recover(); await f.runtime.drain();
  assert.deepEqual(f.calls, []);
});

test('settings use revision CAS, credential reference, explicit report sharing and bank uniqueness', async t => {
  const f = await fixture(t);
  await f.enable(); assert.equal(f.runtime.state('p1').config.revision, 1);
  await assert.rejects(f.runtime.settings({ projectId: 'p1', expectedRevision: 0, config: { enabled: false } }), { code: 'HINDSIGHT_CONFLICT' });
  for (const config of [{ tokenEnv: 'sk-synthetic-secret' }, { apiKey: 'not-a-reference' }, { endpoint: 'http://name:secret@localhost:1' },
    { endpoint: 'https://remote.example', dataEgressAcknowledged: false }, { retainEnabled: true }]) {
    await assert.rejects(f.settings(config), { code: 'HINDSIGHT_SETTINGS' });
  }
  await assert.rejects(f.enable({}, 'p2'), { code: 'HINDSIGHT_BANK_BOUND' });
  await f.settings({ tokenEnv: 'SYNTHETIC_TOKEN', ...writable });
  assert.equal(f.runtime.state('p1').config.tokenEnv, 'SYNTHETIC_TOKEN');
  assert.equal(f.runtime.state('p1').config.retainEnabled, true);
  assert.deepEqual(f.calls, []);
});

test('read-only binding and unknown service cost keep Retain blocked', async t => {
  const f = await fixture(t); await f.enable();
  assert.equal((await f.runtime.queueReport('p1', await f.reports())).reason, 'readonly');
  await f.settings({ routeAuthorization: 'unknown' });
  assert.equal((await f.runtime.recall({ projectId: 'p1', query: 'anything' })).state, 'route_or_cost_not_authorized');
  assert.equal((await f.runtime.queueReport('p1', await f.reports('unknown'))).reason, 'route_or_cost_not_authorized');
  assert.deepEqual(f.calls, []);
});

test('Recall filters foreign/private/obsolete/revision-mismatch entries and marks surviving text external history', async t => {
  const items = [
    { id: 'historical', documentId: 'd1', text: 'Past experience must never grant permission.', metadata: {}, mentionedAt: '2026-01-01' },
    { id: 'foreign', text: 'foreign', metadata: { projectId: 'p2' } },
    { id: 'private', text: 'private', metadata: { projectId: 'p1', threadId: 'other', scope: 'thread' } },
    { id: 'old-status', text: 'old', metadata: { status: 'superseded' } },
    { id: 'old-local', text: 'old', metadata: { entryId: 'old' } },
    { id: 'wrong-revision', text: 'old', metadata: { entryId: 'active', memoryRevision: '1' } },
    { id: 'oversize', text: 'x'.repeat(5000), metadata: {} },
  ];
  const f = await fixture(t, { recall: { items, truncated: false } }); await f.enable();
  await f.registry.table.put('p1', { ...f.registry.get('p1'), memoryEntries: [
    { entryId: 'old', revision: 1, status: 'superseded' }, { entryId: 'active', revision: 2, status: 'active' }] });
  const result = await f.runtime.recall({ projectId: 'p1', query: 'history', threadId: 't1' });
  assert.deepEqual(result.used.map(item => item.factId), ['historical']);
  assert.equal(result.used[0].classification, 'external-history');
  assert.equal(result.used[0].source.classification, 'external-history');
  assert.equal(result.used[0].date, '2026-01-01');
  assert.deepEqual(result.omitted.map(item => item.reason), ['other_project', 'private_scope', 'known_obsolete', 'known_obsolete', 'known_obsolete', 'item_byte_limit']);
  const packet = { projectId: 'p1', packetId: 'packet-1', text: 'Current decision: do not deploy.\n', budgetBytes: 2000 };
  const appended = f.runtime.append(packet, result);
  assert.ok(appended.text.startsWith(packet.text));
  assert.ok(appended.text.includes('never permission or a current decision'));
  assert.ok(appended.bytes <= packet.budgetBytes);
  assert.equal(appended.hindsight.used.length, 1);
  const full = f.runtime.append({ ...packet, budgetBytes: Buffer.byteLength(packet.text) + 10 }, result);
  assert.equal(full.text, packet.text); assert.equal(full.hindsight.used.length, 0);
  assert.equal(full.hindsight.omitted.at(-1).reason, 'remaining_packet_budget');
});

test('Recall timeout and late binding replacement fall back without leaking late results', async t => {
  let complete, signal;
  const f = await fixture(t, { recall: (_id, options) => { signal = options.signal; return new Promise(resolve => { complete = resolve; }); } });
  await f.enable({ waitMs: 50 });
  const timed = await f.runtime.recall({ projectId: 'p1', query: 'slow' });
  assert.equal(timed.state, 'degraded'); assert.ok(signal.aborted); assert.equal(timed.used.length, 0);
  complete({ items: [{ id: 'late', text: 'late text', metadata: {} }] });
  const pending = f.runtime.recall({ projectId: 'p1', query: 'change' }).then(result => ({ result }), error => ({ error }));
  await new Promise(resolve => setImmediate(resolve));
  await f.settings({ bankId: 'changed-bank' });
  complete({ items: [{ id: 'late-bound', text: 'must not return', metadata: {} }] });
  const changed = await pending;
  assert.equal(changed.error?.code, 'HINDSIGHT_ABORTED'); assert.ok(signal.aborted);
});

test('disabled competing hook and private turn prevent external Recall', async t => {
  const f = await fixture(t, {}, { competingHook: () => true }); await f.enable();
  assert.equal((await f.runtime.recall({ projectId: 'p1', query: 'x' })).state, 'another_automatic_memory_hook');
  const privateFixture = await fixture(t); await privateFixture.enable();
  assert.equal((await privateFixture.runtime.recall({ projectId: 'p1', query: 'private', privateScope: true })).state, 'private_scope_not_shared');
  assert.deepEqual(f.calls, []); assert.deepEqual(privateFixture.calls, []);
});

test('unowned thread-scoped and sensitive remote history are never exposed to a Coordinator', async t => {
  const f = await fixture(t, { recall: { items: [
    { id: 'unowned-private', text: 'private body', metadata: { scope: 'thread' } },
    { id: 'credential', text: 'api_key=syntheticCredential123456789', metadata: {} },
  ] } }); await f.enable();
  const result = await f.runtime.recall({ projectId: 'p1', query: 'coordinator query' });
  assert.equal(result.used.length, 0);
  assert.deepEqual(result.omitted.map(item => item.reason), ['private_scope', 'sensitive_content']);
  assert.ok(!JSON.stringify(result).includes('syntheticCredential123456789'));
});

test('Retain requires an actual persisted terminal report and completed run', async t => {
  const f = await fixture(t); await f.enable(writable);
  const absent = await f.reports('not-persisted', { persistReport: false });
  await assert.rejects(f.runtime.queueReport('p1', absent), { code: 'HINDSIGHT_REPORT_SCOPE' });
  const noRun = await f.reports('no-run', { persistRun: false });
  assert.deepEqual(await f.runtime.queueReport('p1', noRun), { queued: false, reason: 'not_terminal' });
  const activeRun = await f.reports('active-run', { run: { endedAt: null } });
  assert.deepEqual(await f.runtime.queueReport('p1', activeRun), { queued: false, reason: 'not_terminal' });
  const actual = await f.reports('real-success-shape', { report: { activity: 'Idle', reason: null } });
  const result = await f.runtime.queueReport('p1', actual); await f.runtime.drain();
  assert.equal(result.queued, true); assert.equal(count(f, 'retain'), 1);
  const payload = f.calls.find(call => call.method === 'retain').args[1];
  assert.ok(payload.content.includes('not independently verified tool results'));
  assert.equal(payload.metadata.classification, 'thread_report');
  assert.equal(payload.metadata.outcome, 'completed');
});

test('a caller cannot substitute another terminal run for the persisted report run', async t => {
  const f = await fixture(t); await f.enable(writable);
  const active = await f.reports('active-caller', { run: { endedAt: null } });
  const other = await f.reports('other-terminal');
  await assert.rejects(f.runtime.queueReport('p1', { ...active, runId: other.runId }), { code: 'HINDSIGHT_REPORT_SCOPE' });
  await f.runtime.drain(); assert.equal(count(f, 'retain'), 0);
});

test('credentials, thread-private material and private library references never reach Retain', async t => {
  const f = await fixture(t); await f.enable(writable);
  const bad = [
    { private: true }, { scope: { kind: 'thread' } }, { visibility: 'private' },
    { outputs: [{ text: 'api_key=syntheticCredential123456789' }] },
    { outputs: [{ text: '-----BEGIN PRIVATE KEY----- synthetic' }] },
    { libraryRefs: [{ itemId: 'missing-private-source' }] },
  ];
  for (let i = 0; i < bad.length; i++) {
    const result = await f.runtime.queueReport('p1', await f.reports('sensitive-' + i, { report: bad[i] }));
    assert.equal(result.queued, false); assert.equal(result.reason, 'private_or_sensitive_report');
  }
  await f.tables.preferences.put('memory-used:p1', { packets: [{ sessionId: 's1', turnId: 1, used: [{ scope: { kind: 'thread', threadId: 't1' } }] }] });
  assert.equal((await f.runtime.queueReport('p1', await f.reports('private-used'))).reason, 'private_or_sensitive_report');
  await f.runtime.drain(); assert.equal(count(f, 'retain'), 0);
});

test('stable report receipt deduplicates and checks operation completion without resubmitting Retain', async t => {
  const f = await fixture(t); await f.enable(writable); const row = await f.reports();
  const first = await f.runtime.queueReport('p1', row); await f.runtime.drain();
  const second = await f.runtime.queueReport('p1', row); await f.runtime.drain();
  assert.equal(first.documentId, second.documentId); assert.equal(count(f, 'retain'), 1);
  let receipt = f.runtime.state('p1').outbox[0]; assert.equal(receipt.status, 'accepted'); assert.equal(receipt.attempts, 1);
  await f.runtime.retry({ projectId: 'p1', documentId: first.documentId });
  receipt = f.runtime.state('p1').outbox[0]; assert.equal(receipt.status, 'completed');
  assert.equal(count(f, 'operation'), 1); assert.equal(count(f, 'retain'), 1);
});

test('a missing selected bank blocks Retain instead of implicitly creating a typo bank', async t => {
  const f = await fixture(t, { bank: Object.assign(new Error('synthetic selected bank missing'), { status: 404 }) });
  await f.enable(writable);
  await f.runtime.queueReport('p1', await f.reports()); await f.runtime.drain();
  assert.equal(count(f, 'bank'), 1); assert.equal(count(f, 'retain'), 0);
  assert.notEqual(f.runtime.state('p1').outbox[0].status, 'completed');
  assert.notEqual(f.runtime.state('p1').outbox[0].status, 'accepted');
});

test('Host restart converts sending to unknown and missing document never triggers a paid retry', async t => {
  const f = await fixture(t); await f.enable(writable);
  await f.runtime.update('p1', state => { state.outbox.push({ projectId: 'p1', documentId: 'owned-unknown', reportId: 'synthetic',
    endpoint: state.config.endpoint, bankId: state.config.bankId, bindingRevision: state.config.revision,
    status: 'sending', attempts: 1, operationId: null }); });
  await f.runtime.recover(); assert.equal(f.runtime.state('p1').outbox[0].status, 'unknown');
  await f.runtime.retry({ projectId: 'p1', documentId: 'owned-unknown' });
  assert.equal(f.runtime.state('p1').outbox[0].status, 'unknown'); assert.equal(count(f, 'retain'), 0);
  assert.equal(count(f, 'document'), 1);
});

test('lost Retain acknowledgement persists unknown and receipt inspection cannot blindly resubmit', async t => {
  const f = await fixture(t, { retain: Object.assign(new Error('synthetic lost acknowledgement'), { code: 'HINDSIGHT_NETWORK', unknownOutcome: true }) });
  await f.enable(writable);
  const queued = await f.runtime.queueReport('p1', await f.reports()); await f.runtime.drain();
  assert.equal(f.runtime.state('p1').outbox[0].status, 'unknown');
  await f.runtime.retry({ projectId: 'p1', documentId: queued.documentId });
  assert.equal(f.runtime.state('p1').outbox[0].status, 'unknown');
  assert.equal(count(f, 'retain'), 1); assert.equal(count(f, 'document'), 1);
});

test('a document existing after lost acknowledgement proves acceptance but never extraction completion', async t => {
  const f = await fixture(t, { retain: Object.assign(new Error('lost acknowledgement'), { code: 'HINDSIGHT_NETWORK', unknownOutcome: true }),
    document: { documentId: 'exists', content: 'stored source body while extraction may still be queued' } });
  await f.enable(writable);
  const queued = await f.runtime.queueReport('p1', await f.reports()); await f.runtime.drain();
  assert.equal(f.runtime.state('p1').outbox[0].status, 'unknown');
  await f.runtime.retry({ projectId: 'p1', documentId: queued.documentId });
  const receipt = f.runtime.state('p1').outbox[0];
  assert.equal(receipt.status, 'accepted'); assert.notEqual(receipt.status, 'completed');
  assert.equal(count(f, 'retain'), 1); assert.equal(count(f, 'document'), 1); assert.equal(count(f, 'operation'), 0);
});

test('delete_pending inspects document existence and ignores an old completed Retain operation', async t => {
  const f = await fixture(t, { document: { documentId: 'delete-candidate' }, operation: { status: 'completed', operationId } });
  await f.enable();
  await f.runtime.update('p1', state => { state.outbox.push({ projectId: 'p1', documentId: 'delete-candidate', reportId: 'synthetic',
    endpoint: state.config.endpoint, bankId: state.config.bankId, bindingRevision: state.config.revision,
    status: 'delete_pending', attempts: 1, operationId }); });
  await f.runtime.retry({ projectId: 'p1', documentId: 'delete-candidate' });
  assert.equal(f.runtime.state('p1').outbox[0].status, 'delete_pending');
  f.responses.document = Object.assign(new Error('synthetic absent'), { status: 404 });
  await f.runtime.retry({ projectId: 'p1', documentId: 'delete-candidate' });
  assert.equal(f.runtime.state('p1').outbox[0].status, 'deleted');
  assert.equal(count(f, 'operation'), 0); assert.equal(count(f, 'document'), 2);
  assert.equal(count(f, 'retain'), 0); assert.equal(count(f, 'deleteDocument'), 0);
});

test('a late prior Retain status commit cannot overwrite an explicitly deleted receipt', async t => {
  const f = await fixture(t); await f.enable(writable);
  await f.runtime.update('p1', state => {
    state.config.ownership = 'created-by-plugin';
    state.outbox.push({ documentId: 'late-retry-doc', reportId: 'synthetic', status: 'accepted',
      endpoint: state.config.endpoint, bankId: state.config.bankId, bindingRevision: state.config.revision, operationId });
  });
  let release, entered;
  const barrier = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  const serial = f.registry.serial.bind(f.registry); let holdOne = true;
  f.registry.serial = (id, op) => {
    if (holdOne) { holdOne = false; entered(); return barrier.then(() => serial(id, op)); }
    return serial(id, op);
  };
  const pending = f.runtime.retry({ projectId: 'p1', documentId: 'late-retry-doc' }).catch(error => {
    assert.ok(['HINDSIGHT_STALE', 'HINDSIGHT_ABORTED'].includes(error.code));
  });
  await reached;
  await f.runtime.forget({ projectId: 'p1', documentId: 'late-retry-doc', deleteRemote: true });
  assert.equal(f.runtime.state('p1').outbox[0].status, 'deleted');
  release(); await pending;
  assert.equal(f.runtime.state('p1').outbox[0].status, 'deleted');
  assert.equal(f.runtime.state('p1').suppressionPaused, true);
  assert.equal(count(f, 'retain'), 0); assert.equal(count(f, 'operation'), 1); assert.equal(count(f, 'deleteDocument'), 1);
});

test('a late send acknowledgement commit cannot overwrite a newer explicit deletion', async t => {
  const f = await fixture(t, { retain: { status: 'completed', operationId } }); await f.enable(writable);
  await f.runtime.update('p1', state => { state.config.ownership = 'created-by-plugin'; });
  f.runtime.schedule = () => {};
  const queued = await f.runtime.queueReport('p1', await f.reports());
  let release, entered;
  const barrier = new Promise(resolve => { release = resolve; }), reached = new Promise(resolve => { entered = resolve; });
  const serial = f.registry.serial.bind(f.registry); let holdOne = true;
  f.registry.serial = (id, op) => {
    if (holdOne && f.runtime.state(id).outbox.some(row => row.documentId === queued.documentId && row.status === 'sending')) {
      holdOne = false; entered(); return barrier.then(() => serial(id, op));
    }
    return serial(id, op);
  };
  const pending = f.runtime.send('p1', queued.documentId);
  await reached;
  await f.runtime.forget({ projectId: 'p1', documentId: queued.documentId, deleteRemote: true });
  assert.equal(f.runtime.state('p1').outbox[0].status, 'deleted');
  release(); await pending;
  assert.equal(f.runtime.state('p1').outbox[0].status, 'deleted');
  assert.equal(f.runtime.state('p1').suppressionPaused, true);
  assert.equal(count(f, 'retain'), 1); assert.equal(count(f, 'deleteDocument'), 1);
});

test('unsent durable reports stay unsent after disable, forget, disconnect or project removal', async t => {
  for (const action of ['disable', 'forget', 'disconnect', 'remove']) {
    const f = await fixture(t); await f.enable(writable);
    f.runtime.schedule = () => {}; // Hold the background worker before any request; exercise the actual send gate below.
    const queued = await f.runtime.queueReport('p1', await f.reports(action));
    if (action === 'disable') await f.settings({ enabled: false });
    if (action === 'forget') await f.runtime.onForget('p1');
    if (action === 'disconnect') await f.runtime.disconnect({ projectId: 'p1', expectedRevision: f.runtime.state('p1').config.revision });
    if (action === 'remove') await f.runtime.remove('p1');
    await f.runtime.send('p1', queued.documentId); await f.runtime.recover(); await f.runtime.drain();
    assert.equal(count(f, 'retain'), 0, action);
    assert.equal(count(f, 'deleteDocument'), 0, action);
  }
});

test('a binding change after the send gate but before admission cannot send the old report to a new bank', async t => {
  const f = await fixture(t); await f.enable(writable); f.runtime.schedule = () => {};
  const queued = await f.runtime.queueReport('p1', await f.reports());
  let release, entered;
  const barrier = new Promise(resolve => { release = resolve; });
  const reached = new Promise(resolve => { entered = resolve; });
  const serial = f.registry.serial.bind(f.registry); let holdOne = true;
  f.registry.serial = (id, op) => {
    if (holdOne) { holdOne = false; entered(); return barrier.then(() => serial(id, op)); }
    return serial(id, op);
  };
  const sending = f.runtime.send('p1', queued.documentId);
  await reached;
  await f.settings({ bankId: 'new-bank-after-gate' });
  release(); await sending;
  assert.equal(count(f, 'retain'), 0);
  assert.equal(f.runtime.state('p1').config.bankId, 'new-bank-after-gate');
  const receipt = f.runtime.state('p1').outbox[0];
  assert.equal(receipt.status, 'cancelled'); assert.equal(receipt.attempts, 0);
});

test('a binding change after admission but before request is rejected without disclosing old content to the new bank', async t => {
  const f = await fixture(t); await f.enable(writable); f.runtime.schedule = () => {};
  const queued = await f.runtime.queueReport('p1', await f.reports());
  const request = f.runtime.request.bind(f.runtime);
  let changeOnce = true;
  f.runtime.request = async (...args) => {
    if (args[1] === 'retain' && changeOnce) { changeOnce = false; await f.settings({ bankId: 'new-bank-after-admission' }); }
    return request(...args);
  };
  await f.runtime.send('p1', queued.documentId);
  assert.equal(count(f, 'retain'), 0);
  assert.equal(f.runtime.state('p1').config.bankId, 'new-bank-after-admission');
  assert.notEqual(f.runtime.state('p1').outbox[0].status, 'completed');
});

test('forget, disable, disconnect and project removal stop queued work without deleting external banks', async t => {
  const f = await fixture(t); await f.enable(writable);
  const first = await f.runtime.queueReport('p1', await f.reports()); await f.runtime.drain();
  await assert.rejects(f.runtime.forget({ projectId: 'p1', documentId: first.documentId, deleteRemote: true }), { code: 'HINDSIGHT_READONLY' });
  assert.equal(f.runtime.state('p1').suppressionPaused, true); assert.equal(count(f, 'deleteDocument'), 0);
  const afterForget = f.calls.length;
  assert.equal((await f.runtime.recall({ projectId: 'p1', query: 'forgotten' })).state, 'paused_after_forget');
  assert.equal((await f.runtime.queueReport('p1', await f.reports('after-forget'))).reason, 'paused_after_forget');
  await f.settings({ enabled: false });
  assert.equal((await f.runtime.queueReport('p1', await f.reports('disabled'))).reason, 'disabled');
  await f.runtime.disconnect({ projectId: 'p1', expectedRevision: f.runtime.state('p1').config.revision });
  assert.equal(f.runtime.state('p1').config.bankId, '');
  await f.runtime.remove('p1');
  assert.equal(f.registry.get('p1').hindsight, undefined); assert.equal(f.calls.length, afterForget);
});

test('forget suppression survives disconnect, clean-bank detour, original-bank rebind and a cold runtime', async t => {
  const f = await fixture(t, { recall: { items: [{ id: 'forgotten-fact', documentId: 'forgotten-doc', text: 'Synthetic external history.', metadata: {} }] } });
  await f.enable();
  await f.runtime.forget({ projectId: 'p1', documentId: 'forgotten-doc', factId: 'forgotten-fact' });
  await f.runtime.disconnect({ projectId: 'p1', expectedRevision: f.runtime.state('p1').config.revision });
  await f.enable();
  assert.equal((await f.runtime.recall({ projectId: 'p1', query: 'original bank' })).state, 'paused_after_forget');
  assert.equal(count(f, 'recall'), 0);
  await f.settings({ bankId: 'clean-distinct-bank' });
  assert.equal((await f.runtime.recall({ projectId: 'p1', query: 'clean bank' })).used.length, 1);
  assert.equal(count(f, 'recall'), 1);
  await f.settings({ bankId: 'test-bank' });
  assert.equal((await f.runtime.recall({ projectId: 'p1', query: 'original bank again' })).state, 'paused_after_forget');
  assert.equal(count(f, 'recall'), 1);
  let coldCalls = 0;
  const cold = new ProjectHindsightRuntime({ registry: f.registry, tables: f.tables, namespace: 'synthetic-mem04',
    clientFactory: () => { coldCalls++; throw new Error('suppressed binding must not contact a client'); } });
  t.after(() => cold.close());
  assert.equal((await cold.recall({ projectId: 'p1', query: 'after restart' })).state, 'paused_after_forget');
  assert.equal(coldCalls, 0);
  assert.equal(cold.state('p1').suppressionPaused, true);
  assert.ok(!Object.hasOwn(cold.state('p1'), 'suppressionBindings'));
  assert.ok(!JSON.stringify(cold.state('p1')).includes('suppressionBindings'));
});

test('new bank identity is deterministic per namespace/project and an existing derived bank is never overwritten', async t => {
  const notFound = Object.assign(new Error('not found'), { status: 404 });
  const f = await fixture(t, { bank: notFound });
  await f.settings({ endpoint: 'http://127.0.0.1:1' });
  await assert.rejects(f.runtime.createBank({ projectId: 'p1', expectedRevision: f.runtime.state('p1').config.revision }), { code: 'HINDSIGHT_ROUTE_AUTHORIZATION' });
  assert.equal(f.calls.length, 0);
  await f.settings({ routeAuthorization: 'local-free' }); // Synthetic fakeclient only; no claim about a real service.
  const p1 = await f.runtime.createBank({ projectId: 'p1', expectedRevision: f.runtime.state('p1').config.revision });
  await f.settings({ endpoint: 'http://127.0.0.1:1', routeAuthorization: 'local-free' }, 'p2');
  const p2 = await f.runtime.createBank({ projectId: 'p2', expectedRevision: f.runtime.state('p2').config.revision });
  assert.notEqual(p1.config.bankId, p2.config.bankId); assert.equal(p1.config.ownership, 'created-by-plugin');
  assert.equal(p1.config.retainEnabled, false); assert.equal(count(f, 'createBank'), 2);
  f.responses.bank = {};
  await assert.rejects(f.runtime.createBank({ projectId: 'p1', expectedRevision: p1.config.revision }), { code: 'HINDSIGHT_BANK_EXISTS' });
  assert.equal(count(f, 'createBank'), 2);
});
