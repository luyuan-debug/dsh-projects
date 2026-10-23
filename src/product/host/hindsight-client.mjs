// Fixed REST contract: locally installed hindsight-api 1.1.0 (api/http.py).
// Only the Host resolves tokenEnv. No token or backend error body is exposed.
export class HindsightClientError extends Error {
  constructor(code, { status = null, unknownOutcome = false } = {}) {
    super(code);
    this.name = 'HindsightClientError';
    this.code = code;
    this.status = status;
    this.unknownOutcome = unknownOutcome;
  }
}

const fail = (code, details) => { throw new HindsightClientError(code, details); };
const plain = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const optionalString = value => typeof value === 'string' ? value : null;
function responseString(value, max, required = false) {
  if (value == null && !required) return null;
  if (typeof value !== 'string' || !value || value.length > max || /[\u0000-\u001f\u007f]/u.test(value)) fail('HINDSIGHT_INVALID_RESPONSE');
  return value;
}
function integer(value, min, max) {
  if (!Number.isInteger(value) || value < min || value > max) fail('HINDSIGHT_INVALID_INPUT');
  return value;
}
function identifier(value, bank = false) {
  if (typeof value !== 'string' || !value || value.length > (bank ? 128 : 512)
    || /[\u0000-\u001f\u007f?#\\]/u.test(value) || value.split('/').some(v => v === '.' || v === '..')
    || (bank && !/^[A-Za-z0-9][A-Za-z0-9._-]*$/u.test(value))) fail('HINDSIGHT_INVALID_INPUT');
  return encodeURIComponent(value);
}
function metadata(value = {}) {
  if (!plain(value) || Object.keys(value).length > 64) fail('HINDSIGHT_INVALID_INPUT');
  const result = Object.create(null);
  for (const [key, item] of Object.entries(value)) {
    if (typeof item !== 'string' || key.length > 128 || item.length > 8192) fail('HINDSIGHT_INVALID_INPUT');
    result[key] = item;
  }
  return result;
}
function endpointUrl(value, allowRemote) {
  let url;
  try { url = new URL(value); } catch { fail('HINDSIGHT_INVALID_ENDPOINT'); }
  if (url.username || url.password || url.search || url.hash || url.pathname !== '/') fail('HINDSIGHT_INVALID_ENDPOINT');
  const loopback = url.hostname === 'localhost' || url.hostname === '[::1]' || /^127(?:\.\d{1,3}){3}$/u.test(url.hostname);
  if (!loopback && !allowRemote) fail('HINDSIGHT_REMOTE_DISABLED');
  if (url.protocol !== 'https:' && !(loopback && url.protocol === 'http:')) fail('HINDSIGHT_INVALID_ENDPOINT');
  return url.origin;
}

export class HindsightClient {
  #endpoint; #tokenEnv; #env; #fetch; #maxBytes;
  constructor({ endpoint, tokenEnv = null, env = process.env, fetchImpl = globalThis.fetch,
    maxResponseBytes = 262144, allowRemote = false } = {}) {
    this.#endpoint = endpointUrl(endpoint, allowRemote === true);
    if (tokenEnv !== null && tokenEnv !== '' && (typeof tokenEnv !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]*$/u.test(tokenEnv))) {
      fail('HINDSIGHT_INVALID_INPUT');
    }
    if (typeof fetchImpl !== 'function' || !plain(env)) fail('HINDSIGHT_INVALID_INPUT');
    this.#tokenEnv = tokenEnv || null;
    this.#env = env;
    this.#fetch = fetchImpl;
    this.#maxBytes = integer(maxResponseBytes, 1, 1048576);
  }
  async #request(path, { method = 'GET', body, signal } = {}) {
    const mutating = method !== 'GET';
    const headers = { Accept: 'application/json' };
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (this.#tokenEnv) {
      const token = this.#env[this.#tokenEnv];
      if (typeof token !== 'string' || !token || /[\r\n]/u.test(token)) fail('HINDSIGHT_AUTH_MISSING');
      headers.Authorization = `Bearer ${token}`;
    }
    let encoded;
    if (body !== undefined) {
      try { encoded = JSON.stringify(body); } catch { fail('HINDSIGHT_INVALID_INPUT'); }
      if (Buffer.byteLength(encoded, 'utf8') > 262144) fail('HINDSIGHT_INVALID_INPUT');
    }
    let response;
    try {
      response = await this.#fetch(this.#endpoint + path, { method, headers, body: encoded, signal,
        redirect: 'error', credentials: 'omit', cache: 'no-store', referrerPolicy: 'no-referrer' });
    } catch {
      fail(signal?.aborted ? 'HINDSIGHT_ABORTED' : 'HINDSIGHT_NETWORK', { unknownOutcome: mutating });
    }
    if (response.redirected || response.status >= 300 && response.status < 400) {
      await response.body?.cancel().catch(() => {});
      fail('HINDSIGHT_REDIRECT', { status: response.status, unknownOutcome: mutating });
    }
    if (!response.ok) {
      await response.body?.cancel().catch(() => {});
      fail('HINDSIGHT_HTTP_ERROR', { status: response.status, unknownOutcome: mutating && response.status >= 500 });
    }
    if (Number(response.headers.get('content-length')) > this.#maxBytes) {
      await response.body?.cancel().catch(() => {});
      fail('HINDSIGHT_RESPONSE_TOO_LARGE', { unknownOutcome: mutating });
    }
    const reader = response.body?.getReader();
    if (!reader) fail('HINDSIGHT_INVALID_RESPONSE', { unknownOutcome: mutating });
    const chunks = []; let bytes = 0;
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        bytes += value.byteLength;
        if (bytes > this.#maxBytes) {
          await reader.cancel().catch(() => {});
          fail('HINDSIGHT_RESPONSE_TOO_LARGE', { unknownOutcome: mutating });
        }
        chunks.push(value);
      }
    } catch (error) {
      if (error instanceof HindsightClientError) throw error;
      fail(signal?.aborted ? 'HINDSIGHT_ABORTED' : 'HINDSIGHT_NETWORK', { unknownOutcome: mutating });
    } finally { reader.releaseLock(); }
    let data;
    try { data = JSON.parse(Buffer.concat(chunks, bytes).toString('utf8')); }
    catch { fail('HINDSIGHT_INVALID_RESPONSE', { unknownOutcome: mutating }); }
    if (!plain(data)) fail('HINDSIGHT_INVALID_RESPONSE', { unknownOutcome: mutating });
    return data;
  }
  #bankPath(bankId) { return `/v1/default/banks/${identifier(bankId, true)}`; }
  async health({ signal } = {}) {
    const health = await this.#request('/health', { signal });
    const version = await this.#request('/version', { signal });
    const apiVersion = responseString(version.api_version, 128, true);
    return { healthy: health.status === 'healthy', status: health.status === 'healthy' ? 'healthy' : 'unhealthy', version: apiVersion };
  }
  async bank(bankId, { signal } = {}) {
    const data = await this.#request(this.#bankPath(bankId) + '/profile', { signal });
    if (data.bank_id !== bankId) fail('HINDSIGHT_INVALID_RESPONSE');
    return { bankId: data.bank_id, name: optionalString(data.name) };
  }
  async createBank(bankId, { signal } = {}) {
    // This version only offers create-or-update. Empty body changes no settings.
    // Ownership approval and preflight identity checks belong to the caller.
    const data = await this.#request(this.#bankPath(bankId), { method: 'PUT', body: {}, signal });
    if (data.bank_id !== bankId) fail('HINDSIGHT_INVALID_RESPONSE', { unknownOutcome: true });
    return { bankId: data.bank_id, name: optionalString(data.name) };
  }
  async recall(bankId, { query, maxResults = 6, maxTokens = 1024, signal } = {}) {
    if (typeof query !== 'string' || !query.trim() || Buffer.byteLength(query, 'utf8') > 16384) fail('HINDSIGHT_INVALID_INPUT');
    integer(maxResults, 1, 100); integer(maxTokens, 1, 8192);
    const data = await this.#request(this.#bankPath(bankId) + '/memories/recall', { method: 'POST', signal,
      body: { query, budget: 'low', max_tokens: maxTokens, include: { entities: null } } });
    if (!Array.isArray(data.results)) fail('HINDSIGHT_INVALID_RESPONSE');
    const items = data.results.slice(0, maxResults).map(item => {
      if (!plain(item) || typeof item.id !== 'string' || typeof item.text !== 'string') fail('HINDSIGHT_INVALID_RESPONSE');
      if (item.source_fact_ids != null && (!Array.isArray(item.source_fact_ids) || item.source_fact_ids.length > 64)) fail('HINDSIGHT_INVALID_RESPONSE');
      return { id: responseString(item.id, 512, true), text: item.text, type: responseString(item.type, 128), documentId: responseString(item.document_id, 512),
        metadata: item.metadata == null ? {} : metadata(item.metadata), occurredStart: responseString(item.occurred_start, 128),
        occurredEnd: responseString(item.occurred_end, 128), mentionedAt: responseString(item.mentioned_at, 128),
        chunkId: responseString(item.chunk_id, 512), sourceFactIds: (item.source_fact_ids ?? []).map(id => responseString(id, 512, true)) };
    });
    return { items, truncated: data.results.length > items.length };
  }
  async retain(bankId, { content, documentId, metadata: sourceMetadata = {}, signal } = {}) {
    if (typeof content !== 'string' || !content.trim() || Buffer.byteLength(content, 'utf8') > 65536) fail('HINDSIGHT_INVALID_INPUT');
    identifier(documentId);
    const data = await this.#request(this.#bankPath(bankId) + '/memories', { method: 'POST', signal,
      body: { items: [{ content, document_id: documentId, metadata: metadata(sourceMetadata) }], async: true } });
    if (data.bank_id !== bankId) fail('HINDSIGHT_INVALID_RESPONSE', { unknownOutcome: true });
    const validOperation = id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(id);
    const ids = Array.isArray(data.operation_ids) ? data.operation_ids.filter(validOperation) : [];
    const operationId = validOperation(data.operation_id) ? data.operation_id : ids[0] || null;
    if (operationId && !ids.includes(operationId)) ids.unshift(operationId);
    const status = data.success === true && data.async === false ? 'completed'
      : data.success === true && data.async === true && operationId ? 'accepted' : 'unknown';
    return { status, documentId, operationId, operationIds: ids };
  }
  async operation(bankId, operationId, { signal } = {}) {
    if (typeof operationId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(operationId)) fail('HINDSIGHT_INVALID_INPUT');
    const data = await this.#request(this.#bankPath(bankId) + `/operations/${identifier(operationId)}`, { signal });
    if (data.operation_id !== operationId) fail('HINDSIGHT_INVALID_RESPONSE');
    const states = { pending: 'accepted', processing: 'accepted', completed: 'completed', failed: 'failed', cancelled: 'cancelled', not_found: 'unknown' };
    return { operationId, status: states[data.status] || 'unknown', backendStatus: Object.hasOwn(states, data.status) ? data.status : 'unknown',
      completedAt: optionalString(data.completed_at) };
  }
  async document(bankId, documentId, { signal } = {}) {
    const data = await this.#request(this.#bankPath(bankId) + `/documents/${identifier(documentId)}`, { signal });
    if (data.id !== documentId || data.bank_id !== bankId || typeof data.original_text !== 'string') fail('HINDSIGHT_INVALID_RESPONSE');
    return { documentId, bankId, content: data.original_text, metadata: data.document_metadata == null ? {} : metadata(data.document_metadata),
      createdAt: optionalString(data.created_at), updatedAt: optionalString(data.updated_at) };
  }
  async deleteDocument(bankId, documentId, { signal } = {}) {
    const data = await this.#request(this.#bankPath(bankId) + `/documents/${identifier(documentId)}`, { method: 'DELETE', signal });
    return { status: data.success === true && data.document_id === documentId ? 'completed' : 'unknown', documentId,
      memoryUnitsDeleted: Number.isInteger(data.memory_units_deleted) ? data.memory_units_deleted : null };
  }
}
