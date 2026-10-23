import test from 'node:test';
import assert from 'node:assert/strict';
import { HindsightClient, HindsightClientError } from '../../src/product/host/hindsight-client.mjs';

const operationId = '550e8400-e29b-41d4-a716-446655440000';
const json = (value, init) => new Response(JSON.stringify(value), { headers: { 'content-type': 'application/json' }, ...init });
function fixture(responses, config = {}) {
  const calls = [];
  const client = new HindsightClient({ endpoint: 'http://127.0.0.1:1', ...config, fetchImpl: async (url, init) => {
    calls.push({ url, ...init, body: init.body && JSON.parse(init.body) });
    const value = responses.shift();
    if (value instanceof Error) throw value;
    return value instanceof Response ? value : json(value);
  } });
  return { client, calls };
}
const code = expected => error => error instanceof HindsightClientError && error.code === expected && error.message === expected;

test('endpoint policy rejects credentials, query, fragment, non-loopback HTTP, remote opt-in omission and arbitrary base paths', () => {
  for (const endpoint of ['http://u:p@localhost:8888', 'http://localhost:8888/?token=bad', 'http://localhost:8888/#bad',
    'http://example.com', 'https://example.com', 'file:///tmp/x', 'http://localhost:8888/v1/banks']) {
    assert.throws(() => new HindsightClient({ endpoint }), error => error instanceof HindsightClientError);
  }
  assert.doesNotThrow(() => new HindsightClient({ endpoint: 'https://example.com', allowRemote: true }));
  assert.throws(() => new HindsightClient({ endpoint: 'http://example.com', allowRemote: true }), code('HINDSIGHT_INVALID_ENDPOINT'));
  assert.doesNotThrow(() => new HindsightClient({ endpoint: 'http://[::1]:8888' }));
});

test('health checks exact model-free resources and bank read never creates', async () => {
  const { client, calls } = fixture([{ status: 'healthy' }, { api_version: '1.1.0' }, { bank_id: 'test-bank', name: 'test' }]);
  assert.deepEqual(await client.health(), { healthy: true, status: 'healthy', version: '1.1.0' });
  assert.deepEqual(await client.bank('test-bank'), { bankId: 'test-bank', name: 'test' });
  assert.deepEqual(calls.map(v => [new URL(v.url).pathname, v.method]), [['/health', 'GET'], ['/version', 'GET'], ['/v1/default/banks/test-bank/profile', 'GET']]);
});

test('backend version and source identifiers cannot escape their bounded schema', async () => {
  for (const api_version of ['x'.repeat(129), '0.9.2\nsynthetic-secret', '', 92]) {
    const { client } = fixture([{ status: 'healthy' }, { api_version }]);
    await assert.rejects(client.health(), code('HINDSIGHT_INVALID_RESPONSE'));
  }
  for (const patch of [{ id: 'x'.repeat(513) }, { document_id: 'x'.repeat(513) }, { chunk_id: 'x'.repeat(513) },
    { mentioned_at: 'x'.repeat(129) }, { occurred_start: 'x\ncontrol' }, { source_fact_ids: Array(65).fill('x') },
    { source_fact_ids: ['x'.repeat(513)] }, { source_fact_ids: ['x\u0000control'] }]) {
    const { client } = fixture([{ results: [{ id: 'f', text: 'synthetic', ...patch }] }]);
    await assert.rejects(client.recall('b', { query: 'x' }), code('HINDSIGHT_INVALID_RESPONSE'));
  }
});

test('authentication is Host env reference only and backend/network error text is never exposed', async () => {
  const secret = 'synthetic-never-display';
  const { client, calls } = fixture([new Error(`secret ${secret}`), json({ detail: secret }, { status: 401 })], { tokenEnv: 'TEST_AUTH', env: { TEST_AUTH: secret } });
  await assert.rejects(client.bank('b'), code('HINDSIGHT_NETWORK'));
  await assert.rejects(client.bank('b'), error => code('HINDSIGHT_HTTP_ERROR')(error) && error.status === 401 && !JSON.stringify(error).includes(secret));
  assert.equal(calls[0].headers.Authorization, `Bearer ${secret}`);
  assert.equal(JSON.stringify(client), '{}');
  assert.equal(calls[0].redirect, 'error');
  assert.equal(calls[0].credentials, 'omit');
  const missing = fixture([], { tokenEnv: 'TEST_AUTH', env: {} });
  await assert.rejects(missing.client.bank('b'), code('HINDSIGHT_AUTH_MISSING'));
  assert.equal(missing.calls.length, 0);
});

test('recall uses verified snake-case fields and truncates result count locally while preserving source fields', async () => {
  const source = { id: 'fact', text: '旧决定不再适用。', type: 'world', document_id: 'owned/document', metadata: { projectId: 'p1' },
    occurred_start: '2026-01-01', occurred_end: '2026-01-02', mentioned_at: '2026-01-03', source_fact_ids: ['source-1'], chunk_id: 'chunk' };
  const { client, calls } = fixture([{ results: [source, { ...source, id: 'fact2' }] }]);
  const result = await client.recall('b', { query: '之前决定', maxResults: 1, maxTokens: 300 });
  assert.equal(result.items.length, 1);
  assert.equal(result.truncated, true);
  assert.equal(result.items[0].text, source.text);
  assert.equal(result.items[0].documentId, 'owned/document');
  assert.equal(result.items[0].metadata.projectId, 'p1');
  assert.equal(result.items[0].occurredStart, '2026-01-01');
  assert.equal(result.items[0].occurredEnd, '2026-01-02');
  assert.equal(result.items[0].mentionedAt, '2026-01-03');
  assert.deepEqual(result.items[0].sourceFactIds, ['source-1']);
  assert.deepEqual(calls[0].body, { query: '之前决定', budget: 'low', max_tokens: 300, include: { entities: null } });
  assert.ok(!Object.hasOwn(calls[0].body, 'max_results'));
});

test('retain accepted is distinct from completed, failure, not-found and unknown status', async () => {
  const { client, calls } = fixture([
    { success: true, bank_id: 'b', async: true, operation_id: operationId },
    { success: true, bank_id: 'b', async: false },
    { success: true, bank_id: 'b', async: true },
    ...['pending', 'processing', 'completed', 'failed', 'cancelled', 'not_found', 'surprise'].map(status => ({ operation_id: operationId, status, error_message: 'sensitive internal text' })),
  ]);
  const request = { content: '合成终态报告', documentId: 'mem04:stable-doc', metadata: { source: 'synthetic' } };
  assert.equal((await client.retain('b', request)).status, 'accepted');
  assert.equal((await client.retain('b', request)).status, 'completed');
  assert.equal((await client.retain('b', request)).status, 'unknown');
  for (const expected of ['accepted', 'accepted', 'completed', 'failed', 'cancelled', 'unknown', 'unknown']) {
    const value = await client.operation('b', operationId);
    assert.equal(value.status, expected);
    assert.ok(!JSON.stringify(value).includes('sensitive'));
  }
  assert.deepEqual(calls[0].body, { items: [{ content: '合成终态报告', document_id: 'mem04:stable-doc', metadata: { source: 'synthetic' } }], async: true });
});

test('single selected document read/delete and empty create use fixed resources only', async () => {
  const { client, calls } = fixture([{ bank_id: 'b', id: 'owned/doc', original_text: 'synthetic body', document_metadata: { project: 'p' } },
    { success: true, document_id: 'owned/doc', memory_units_deleted: 2 }, { bank_id: 'b', name: 'b' }]);
  assert.equal((await client.document('b', 'owned/doc')).content, 'synthetic body');
  assert.equal((await client.deleteDocument('b', 'owned/doc')).status, 'completed');
  assert.equal((await client.createBank('b')).bankId, 'b');
  assert.deepEqual(calls.map(c => [new URL(c.url).pathname, c.method]), [
    ['/v1/default/banks/b/documents/owned%2Fdoc', 'GET'], ['/v1/default/banks/b/documents/owned%2Fdoc', 'DELETE'], ['/v1/default/banks/b', 'PUT']]);
  assert.deepEqual(calls[2].body, {});
});

test('selected bank/document mismatches are rejected instead of crossing identity', async () => {
  const { client } = fixture([{ bank_id: 'other' }, { bank_id: 'other', id: 'd', original_text: 'bad' },
    { success: true, bank_id: 'other', async: true, operation_id: operationId }]);
  await assert.rejects(client.bank('b'), code('HINDSIGHT_INVALID_RESPONSE'));
  await assert.rejects(client.document('b', 'd'), code('HINDSIGHT_INVALID_RESPONSE'));
  await assert.rejects(client.retain('b', { content: 'x', documentId: 'd' }), error => code('HINDSIGHT_INVALID_RESPONSE')(error) && error.unknownOutcome);
});

test('response bytes are bounded using both content-length and streamed bytes', async () => {
  let cancelled = false;
  const stream = new ReadableStream({ start(c) { c.enqueue(new Uint8Array(100)); }, cancel() { cancelled = true; } });
  const { client } = fixture([new Response(stream)], { maxResponseBytes: 20 });
  await assert.rejects(client.bank('b'), code('HINDSIGHT_RESPONSE_TOO_LARGE'));
  assert.equal(cancelled, true);
  const declared = fixture([new Response('{}', { headers: { 'content-length': '1000' } })], { maxResponseBytes: 20 });
  await assert.rejects(declared.client.bank('b'), code('HINDSIGHT_RESPONSE_TOO_LARGE'));
});

test('redirect, invalid JSON, invalid result schemas and oversized input fail closed', async () => {
  const { client } = fixture([new Response('', { status: 302, headers: { location: 'http://other/' } }), new Response('not json'), { results: [{ text: 'no id' }] }]);
  await assert.rejects(client.bank('b'), code('HINDSIGHT_REDIRECT'));
  await assert.rejects(client.bank('b'), code('HINDSIGHT_INVALID_RESPONSE'));
  await assert.rejects(client.recall('b', { query: 'x' }), code('HINDSIGHT_INVALID_RESPONSE'));
  for (const bank of ['../b', 'b/other', '..', 'b?x=1']) await assert.rejects(client.bank(bank), code('HINDSIGHT_INVALID_INPUT'));
  await assert.rejects(client.document('b', '../x'), code('HINDSIGHT_INVALID_INPUT'));
  await assert.rejects(client.recall('b', { query: 'x'.repeat(16385) }), code('HINDSIGHT_INVALID_INPUT'));
  await assert.rejects(client.retain('b', { content: 'x', documentId: 'd', metadata: { number: 3 } }), code('HINDSIGHT_INVALID_INPUT'));
});

test('abort and lost acknowledgement report safe unknown outcome without retry', async () => {
  const controller = new AbortController(); controller.abort();
  const { client, calls } = fixture([new Error('secret'), new Error('secret')]);
  await assert.rejects(client.recall('b', { query: 'x', signal: controller.signal }), code('HINDSIGHT_ABORTED'));
  await assert.rejects(client.retain('b', { content: 'x', documentId: 'd' }), error => code('HINDSIGHT_NETWORK')(error) && error.unknownOutcome === true);
  assert.equal(calls.length, 2);
});
