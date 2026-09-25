class BecknCallbackStore {
  constructor() {
    this.callbacks = new Map();
    this.waiters = new Map();
    this.expectations = new Map();
    this.seen = new Map();
    this.expiryTimers = new Map();
  }

  _key(action, transactionId) {
    if (!action || !transactionId) {
      throw new Error('Beckn callback requires action and transaction_id');
    }
    return `${action}:${transactionId}`;
  }

  _clearTimer(key) {
    const timer = this.expiryTimers.get(key);
    if (timer) clearTimeout(timer);
    this.expiryTimers.delete(key);
  }

  _expire(key) {
    this._clearTimer(key);
    this.callbacks.delete(key);
    this.waiters.delete(key);
    this.expectations.delete(key);
    this.seen.delete(key);
  }

  expect(action, transactionId, options = {}) {
    const key = this._key(action, transactionId);
    this._expire(key);

    const ttlMs = Number(options.ttlMs || 7000);
    const expectation = {
      action,
      transactionId,
      messageId: options.messageId || null,
      bppId: options.bppId || null,
      bppUri: options.bppUri || null,
      multi: Boolean(options.multi),
      expiresAt: Date.now() + ttlMs
    };

    this.expectations.set(key, expectation);
    this.seen.set(key, new Set());

    const timer = setTimeout(() => this._expire(key), ttlMs);
    if (typeof timer.unref === 'function') timer.unref();
    this.expiryTimers.set(key, timer);

    return expectation;
  }

  getExpectation(action, transactionId) {
    const key = this._key(action, transactionId);
    const expectation = this.expectations.get(key);
    if (!expectation) return null;
    if (expectation.expiresAt <= Date.now()) {
      this._expire(key);
      return null;
    }
    return expectation;
  }

  assertExpected(action, payload) {
    const context = payload?.context || {};
    const transactionId = context.transaction_id;
    const key = this._key(action, transactionId);
    const expectation = this.getExpectation(action, transactionId);

    if (!expectation) {
      throw new Error(`Unexpected or expired Beckn ${action} callback for ${transactionId}`);
    }

    if (expectation.messageId && context.message_id !== expectation.messageId) {
      throw new Error('Callback message_id does not match the outstanding request');
    }
    if (expectation.bppId && context.bpp_id !== expectation.bppId) {
      throw new Error('Callback bpp_id does not match the selected network participant');
    }
    if (expectation.bppUri && context.bpp_uri !== expectation.bppUri) {
      throw new Error('Callback bpp_uri does not match the selected network participant');
    }

    return { key, expectation };
  }

  _fingerprint(action, payload) {
    const context = payload?.context || {};
    return [
      action,
      context.transaction_id || '',
      context.message_id || '',
      context.bpp_id || '',
      context.bpp_uri || ''
    ].join('|');
  }

  record(action, payload) {
    const { key, expectation } = this.assertExpected(action, payload);
    const fingerprint = this._fingerprint(action, payload);
    const seen = this.seen.get(key) || new Set();

    if (seen.has(fingerprint)) {
      return { payload, duplicate: true };
    }

    seen.add(fingerprint);
    this.seen.set(key, seen);

    const waiters = this.waiters.get(key) || [];
    if (waiters.length && !expectation.multi) {
      this.waiters.delete(key);
      waiters.forEach(waiter => waiter.resolve(payload));
      this._expire(key);
      return { payload, duplicate: false };
    }

    const entries = this.callbacks.get(key) || [];
    entries.push({ payload, receivedAt: new Date().toISOString() });
    this.callbacks.set(key, entries);

    if (waiters.length) {
      this.waiters.delete(key);
      waiters.forEach(waiter => waiter.resolve(payload));
    }

    return { payload, duplicate: false };
  }

  getAll(action, transactionId) {
    const key = this._key(action, transactionId);
    return (this.callbacks.get(key) || []).map(entry => entry.payload);
  }

  consumeOne(action, transactionId) {
    const key = this._key(action, transactionId);
    const entries = this.callbacks.get(key) || [];
    if (!entries.length) return null;

    const entry = entries.shift();
    if (entries.length) {
      this.callbacks.set(key, entries);
    } else {
      this.callbacks.delete(key);
    }

    const expectation = this.expectations.get(key);
    if (expectation && !expectation.multi) this._expire(key);
    return entry.payload;
  }

  consumeAll(action, transactionId) {
    const key = this._key(action, transactionId);
    const payloads = this.getAll(action, transactionId);
    this._expire(key);
    return payloads;
  }

  complete(action, transactionId) {
    const key = this._key(action, transactionId);
    this._expire(key);
  }

  waitFor(action, transactionId, timeoutMs = 7000) {
    const key = this._key(action, transactionId);
    const expectation = this.getExpectation(action, transactionId);
    if (!expectation) {
      return Promise.reject(
        new Error(`No outstanding Beckn ${action} operation for ${transactionId}`)
      );
    }

    const existing = this.callbacks.get(key);
    if (existing?.length) {
      if (expectation.multi) {
        return Promise.resolve(existing[existing.length - 1].payload);
      }
      return Promise.resolve(this.consumeOne(action, transactionId));
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
      this._expire(this._key(action, transactionId));
      return;
    }

    for (const timer of this.expiryTimers.values()) clearTimeout(timer);
    this.callbacks.clear();
    this.waiters.clear();
    this.expectations.clear();
    this.seen.clear();
    this.expiryTimers.clear();
  }
}

module.exports = new BecknCallbackStore();
