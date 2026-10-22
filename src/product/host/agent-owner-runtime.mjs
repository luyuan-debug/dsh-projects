/** Own root AgentHandles in one long-lived Host scope; never adopt bare Agents. */
export class OwnerRuntimeError extends Error {
  constructor(code, message, options) { super(message, options); this.name = 'OwnerRuntimeError'; this.code = code; }
}

export class AgentOwnerRuntime {
  #state = 'OPEN'; #live = new Map(); #queues = new Map(); #closing; #cleanupErrors = [];
  constructor({ agents, persistence, isNotFound = () => false }) {
    this.agents = agents; this.persistence = persistence; this.isNotFound = isNotFound;
  }
  get state() { return this.#state; }
  get liveSessionIds() { return [...this.#live.keys()]; }
  #requireOpen() {
    if (this.#state !== 'OPEN') throw new OwnerRuntimeError('RUNTIME_CLOSED', `Agent owner is ${this.#state}`);
  }
  #serial(id, operation) {
    const previous = this.#queues.get(id) ?? Promise.resolve();
    const result = previous.then(operation);
    const tail = result.then(() => undefined, () => undefined);
    this.#queues.set(id, tail);
    void tail.then(() => { if (this.#queues.get(id) === tail) this.#queues.delete(id); });
    return result;
  }
  ensure(spec) {
    try { this.#requireOpen(); } catch (error) { return Promise.reject(error); }
    return this.#serial(spec.sessionId, async () => {
      this.#requireOpen(); // Re-check after queued create/stop operations.
      const owned = this.#live.get(spec.sessionId);
      if (owned) return owned.agent;
      if (this.agents.get(spec.sessionId) !== undefined) {
        throw new OwnerRuntimeError('OWNER_CONFLICT', `Session ${spec.sessionId} has another live owner`);
      }
      let snapshot;
      try { snapshot = await this.persistence.stat(spec.sessionId); }
      catch (error) { if (!this.isNotFound(error)) throw error; }
      if (snapshot === null) throw new OwnerRuntimeError('INVALID_STAT', 'Persistence stat returned null instead of its documented absent value');
      this.#requireOpen();
      const common = { agentOptions: spec.agentOptions, setup: spec.setup };
      const handle = snapshot === undefined
        ? await this.agents.create({ ...common, sessionId: spec.sessionId, meta: { cwd: spec.cwd, ...(spec.preset ? { agentPreset: spec.preset } : {}) } })
        : await this.agents.resume({ ...common, resumeSessionId: spec.sessionId });
      if (this.#state !== 'OPEN') {
        const closing = new OwnerRuntimeError('RUNTIME_CLOSED', 'Owner closed while an Agent was being prepared');
        try { await handle.dispose(); }
        catch (error) { this.#cleanupErrors.push(error); throw new AggregateError([closing, error], 'Unpublished Agent cleanup failed'); }
        throw closing;
      }
      this.#live.set(spec.sessionId, handle);
      return handle.agent;
    });
  }
  /** Stop the current activity while retaining the owned handle and durable Session. */
  stop(sessionId, { keepInbox = false } = {}) {
    try { this.#requireOpen(); } catch (error) { return Promise.reject(error); }
    return this.#serial(sessionId, async () => {
      this.#requireOpen();
      const handle = this.#live.get(sessionId);
      if (!handle) {
        if (this.agents.get(sessionId) !== undefined) throw new OwnerRuntimeError('OWNER_CONFLICT', 'Cannot stop an Agent owned elsewhere');
        return { stopped: false, reason: 'NOT_LIVE' };
      }
      handle.agent.cancel({ kind: 'user' }, { keepInbox });
      await handle.agent.whenIdle();
      return { stopped: true, sessionPreserved: true };
    });
  }
  /** Release only this Host's handle; retain the durable Session for same-request recovery. */
  release(sessionId) {
    try { this.#requireOpen(); } catch (error) { return Promise.reject(error); }
    return this.#serial(sessionId, async () => {
      this.#requireOpen();
      const handle = this.#live.get(sessionId);
      if (!handle) return false;
      await handle.dispose();
      this.#live.delete(sessionId);
      return true;
    });
  }
  dispose() {
    if (this.#closing) return this.#closing;
    this.#state = 'CLOSING';
    this.#closing = this.#dispose();
    return this.#closing;
  }
  async #dispose() {
    try {
      while (this.#queues.size) await Promise.all([...this.#queues.values()]);
      const handles = [...this.#live.values()]; // Must snapshot after all creates finish.
      this.#live.clear();
      const results = await Promise.allSettled(handles.map(handle => handle.dispose()));
      const errors = [...this.#cleanupErrors, ...results.filter(result => result.status === 'rejected').map(result => result.reason)];
      if (errors.length) throw new AggregateError(errors, 'Owned Agent disposal failed');
    } finally { this.#state = 'CLOSED'; }
  }
}
