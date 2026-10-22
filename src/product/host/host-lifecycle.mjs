import { OwnerRuntimeError } from './agent-owner-runtime.mjs';

/** Ordered admission, command draining, resource cancellation, runtime and store teardown. */
export class HostLifecycle {
  #accepting = true; #tail = Promise.resolve(); #closing; #cancellers = []; #errors = [];
  constructor({ runtime, store }) { this.runtime = runtime; this.store = store; }
  get accepting() { return this.#accepting; }
  ownCancellation(cancel) {
    if (!this.#accepting) throw new OwnerRuntimeError('HOST_CLOSING', 'Cannot register a resource during teardown');
    this.#cancellers.push(cancel);
  }
  submit(operation) {
    if (!this.#accepting) return Promise.reject(new OwnerRuntimeError('HOST_CLOSING', 'Command admission has stopped'));
    const result = this.#tail.then(operation);
    this.#tail = result.then(() => undefined, error => { this.#errors.push(error); });
    return result;
  }
  dispose() {
    if (this.#closing) return this.#closing;
    this.#accepting = false;
    this.#closing = this.#dispose();
    return this.#closing;
  }
  async #dispose() {
    for (const cancel of this.#cancellers.splice(0)) {
      try { await cancel(); } catch (error) { this.#errors.push(error); }
    }
    await this.#tail;
    try { await this.runtime.dispose(); } catch (error) { this.#errors.push(error); }
    try { await this.store.close(); } catch (error) { this.#errors.push(error); }
    if (this.#errors.length) throw new AggregateError(this.#errors, 'Host teardown completed with errors');
  }
}
