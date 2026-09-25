class BecknCallbackStore {
  constructor() {
    this.callbacks = new Map();
    this.waiters = new Map();
  }

  _key(action, transactionId) {
    if (!action || !transactionId) {
      throw new Error('Beckn callback requires action and transaction_id');
    }
    return `${action}:${transactionId}`;
  }

  record(action, payload) {
    const transactionId = payload?.context?.transaction_id;
    const key = this._key(action, transactionId);
    const entries = this.callbacks.get(key) || [];

    entries.push({
      payload,
      receivedAt: new Date().toISOString()
    });
    this.callbacks.set(key, entries);
    const waiters = this.waiters.get(key) || [];
    waiters.forEach(waiter => waiter.resolve(payload));
    this.waiters.delete(key);

    return payload;
  }

  getAll(action, transactionId) {
    const key = this._key(action, transactionId);
    return (this.callbacks.get(key) || []).map(entry => entry.payload);
  }

  consumeAll(action, transactionId) {
    const key = this._key(action, transactionId);
    const payloads = this.getAll(action, transactionId);
    this.callbacks.delete(key);
    return payloads;
  }

  waitFor(action, transactionId, timeoutMs = 7000) {
    const key = this._key(action, transactionId);
    const existing = this.callbacks.get(key);
    if (existing?.length) {
      return Promise.resolve(existing[existing.length - 1].payload);
    }

    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        const current = this.waiters.get(key) || [];
        this.waiters.set(key, current.filter(waiter => waiter.resolve !== wrappedResolve));
        reject(new Error(`Timed out waiting for Beckn ${action} callback for ${transactionId}`));
      }, timeoutMs);

      const wrappedResolve = payload => {
        clearTimeout(timer);
        resolve(payload);
      };

      const current = this.waiters.get(key) || [];
      current.push({ resolve: wrappedResolve });
      this.waiters.set(key, current);
    });
  }
  async collect(action, transactionId, timeoutMs = 7000, settleMs = 350) {
    await this.waitFor(action, transactionId, timeoutMs);
    if (settleMs > 0) {
      await new Promise(resolve => setTimeout(resolve, settleMs));
    }
    return this.consumeAll(action, transactionId);
  }

  clear(action, transactionId) {
    if (action && transactionId) {
      const key = this._key(action, transactionId);
      this.callbacks.delete(key);
      this.waiters.delete(key);
      return;
    }

    this.callbacks.clear();
    this.waiters.clear();
  }
}

module.exports = new BecknCallbackStore();
