import { createHash, randomUUID } from 'node:crypto';

export class AssociationError extends Error {
  constructor(code, message, options) { super(message, options); this.name = 'AssociationError'; this.code = code; }
}
const clone = value => structuredClone(value);
function nonempty(value, field, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw new AssociationError('INVALID_REQUEST', field + ' must be a non-empty bounded string');
  return value;
}
export function associationKey({ projectId, coordinatorSessionId, idempotencyKey }) {
  return createHash('sha256').update(JSON.stringify([projectId, coordinatorSessionId, idempotencyKey])).digest('hex');
}
export function publicLink(record) {
  const { projectId, coordinatorSessionId, messageId, messageSeq, threadId, threadSessionId, title, status, createdAt, updatedAt, version, idempotencyKey } = record;
  return clone({ projectId, coordinatorSessionId, messageId, messageSeq, threadId, threadSessionId, title, status, createdAt, updatedAt, version, idempotencyKey });
}
/** One durable request record owns reserved IDs before side effects; pending records never become cards. */
export class ThreadAssociations {
  #queues = new Map(); #closing; #accepting = true;
  constructor({ table, scopes, sessions, clock = Date.now, uuid = randomUUID }) {
    Object.assign(this, { table, scopes, sessions, clock, uuid });
  }
  #serial(key, operation) {
    if (!this.#accepting) return Promise.reject(new AssociationError('SERVICE_CLOSED', 'Association service is closing'));
    const result = (this.#queues.get(key) ?? Promise.resolve()).then(operation);
    const tail = result.then(() => {}, () => {}); this.#queues.set(key, tail);
    void tail.then(() => { if (this.#queues.get(key) === tail) this.#queues.delete(key); });
    return result;
  }
  list(projectId) {
    return [...this.table.entries()].map(([, record]) => record).filter(record => record.projectId === projectId && record.phase === 'active').map(publicLink);
  }
  pending(projectId) {
    return [...this.table.entries()].map(([, record]) => record).filter(record => record.projectId === projectId && record.phase === 'pending').map(record => ({ ...publicLink(record), phase: 'pending', lastError: record.lastError ?? null }));
  }
  /** Reserve identities for an authorization card; no Agent or success card. */
  reserve(input) {
    for(const name of ['projectId','coordinatorSessionId','messageId','idempotencyKey','title'])nonempty(input[name],name);
    const key=associationKey(input);
    return this.#serial(key,async()=>{
      const scope=this.scopes.get(input.projectId);
      if(!scope||scope.coordinatorSessionId!==input.coordinatorSessionId)throw new AssociationError('SCOPE_MISMATCH','Coordinator does not belong to Project');
      const old=this.table.get(key);
      if(old){if(old.messageId!==input.messageId||old.requestTitle!==input.title)throw new AssociationError('IDEMPOTENCY_CONFLICT','Request changed');return clone(old)}
      const message=await this.sessions.requireUserMessage(scope,input.messageId),now=this.clock();
      const record={projectId:input.projectId,coordinatorSessionId:input.coordinatorSessionId,messageId:input.messageId,idempotencyKey:input.idempotencyKey,title:input.title,requestTitle:input.title,messageSeq:message.seq,threadId:input.threadId??this.uuid(),threadSessionId:input.threadSessionId??this.uuid(),phase:'pending',status:'awaiting-grant',createdAt:now,updatedAt:now,version:1};
      await this.table.put(key,record);return clone(record);
    });
  }
  create(input) {
    for (const name of ['projectId', 'coordinatorSessionId', 'messageId', 'idempotencyKey', 'title']) nonempty(input[name], name);
    const key = associationKey(input);
    return this.#serial(key, async () => {
      const scope = this.scopes.get(input.projectId);
      if (!scope || scope.coordinatorSessionId !== input.coordinatorSessionId) throw new AssociationError('SCOPE_MISMATCH', 'Coordinator must belong to this registered scope');
      let record = this.table.get(key);
      if (record && (record.messageId !== input.messageId || record.requestTitle !== input.title)) throw new AssociationError('IDEMPOTENCY_CONFLICT', 'Idempotency key already names a different request');
      if (record?.phase === 'active') {
        await this.sessions.ensureThread(record, { allowCreate: false });
        const delivery = await this.#deliver(record);
        return { association: publicLink(record), reused: true, delivery };
      }
      // Read the authoritative persisted Session, after its public durability barrier.
      const message = await this.sessions.requireUserMessage(scope, input.messageId);
      if (!record) {
        const now = this.clock();
        record = { projectId: input.projectId, coordinatorSessionId: input.coordinatorSessionId, messageId: input.messageId, idempotencyKey: input.idempotencyKey, title: input.title, requestTitle: input.title, messageSeq: message.seq, threadId: this.uuid(), threadSessionId: this.uuid(), phase: 'pending', status: 'created', createdAt: now, updatedAt: now, version: 1 };
        await this.table.put(key, clone(record)); // Failure here creates no Thread at all.
      }
      try {
        await this.sessions.ensureThread(record, { allowCreate: true });
        const committed = { ...record, phase: 'active', updatedAt: this.clock() }; delete committed.lastError;
        await this.table.put(key, clone(committed)); // No publication before the authoritative association commits.
        record = committed;
      } catch (error) {
        const errors = [error];
        try { await this.sessions.releaseThread(record.threadSessionId); } catch (releaseError) { errors.push(releaseError); }
        try { await this.table.put(key, { ...record, phase: 'pending', lastError: String(error.code ?? 'CREATE_OR_COMMIT_FAILED'), updatedAt: this.clock() }); } catch (writeError) { errors.push(writeError); }
        throw new AssociationError('CREATE_NOT_COMMITTED', 'No successful association was published; retry the same request key to reuse its reserved IDs', { cause: errors.length === 1 ? error : new AggregateError(errors, 'Creation compensation failures') });
      }
      return { association: publicLink(record), reused: false, delivery: await this.#deliver(record) };
    });
  }
  async #deliver(record) {
    try { await this.sessions.publish(record); return { state: 'persisted' }; }
    catch (error) {
      // The association is already durable. Its public API reports delivery debt rather than a false create failure.
      return { state: 'pending', code: String(error.code ?? 'SESSION_DELIVERY_FAILED') };
    }
  }
  update({ projectId, threadId, status, title }) {
    nonempty(status, 'status', 64); if (title !== undefined) nonempty(title, 'title');
    const entry = [...this.table.entries()].find(([, r]) => r.projectId === projectId && r.threadId === threadId && r.phase === 'active');
    if (!entry) return Promise.reject(new AssociationError('LINK_NOT_FOUND', 'Active association not found'));
    const [key] = entry;
    return this.#serial(key, async () => {
      const record = this.table.get(key);
      const next = { ...record, status, ...(title === undefined ? {} : { title }), version: record.version + 1, updatedAt: this.clock() };
      await this.table.put(key, clone(next));
      return { association: publicLink(next), delivery: await this.#deliver(next) };
    });
  }
  async recover() {
    const errors = [];
    for (const [, record] of this.table.entries()) {
      if (record.phase !== 'active') continue; // A previously failed create is retried only by the explicit same-key entry.
      try { if(!this.sessions.mayRecover||await this.sessions.mayRecover(record))await this.sessions.ensureThread(record, { allowCreate: false }); await this.sessions.publish(record); }
      catch (error) { errors.push(new AssociationError('RECOVERY_FAILED', 'Could not recover association ' + record.threadId, { cause: error })); }
    }
    if (errors.length) throw new AggregateError(errors, 'Association recovery failed; no missing Session was silently recreated');
  }
  close() {
    if (this.#closing) return this.#closing;
    this.#accepting = false;
    this.#closing = (async () => { while (this.#queues.size) await Promise.all([...this.#queues.values()]); })();
    return this.#closing;
  }
}
