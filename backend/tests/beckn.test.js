process.env.NODE_ENV = 'test';
process.env.DEFAULT_NETWORK_PROVIDER = 'mock';
process.env.LLM_PROVIDER = 'mock';

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

const app = require('../src/app');
const config = require('../src/config');
const { privateKey: outboundSigningTestKey } = crypto.generateKeyPairSync('ed25519');
config.beckn.uniqueKeyId = config.beckn.uniqueKeyId || 'test-signing-key';
config.beckn.signingPrivateKey = config.beckn.signingPrivateKey || outboundSigningTestKey
  .export({ format: 'der', type: 'pkcs8' })
  .toString('base64');
const callbackStore = require('../src/services/beckn/callbackStore');
const becknProvider = require('../src/services/beckn/becknProvider');
const { validateBecknPayload } = require('../src/services/beckn/schemaValidator');
const {
  digestRawBody,
  signingString,
  verifyCallbackAuthorization
} = require('../src/services/beckn/authVerifier');

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

function installOutboundSigningFixture() {
  const original = {
    uniqueKeyId: config.beckn.uniqueKeyId,
    signingPrivateKey: config.beckn.signingPrivateKey
  };
  const { privateKey } = crypto.generateKeyPairSync('ed25519');

  config.beckn.uniqueKeyId = 'test-signing-key';
  config.beckn.signingPrivateKey = privateKey
    .export({ format: 'der', type: 'pkcs8' })
    .toString('base64');

  return () => {
    config.beckn.uniqueKeyId = original.uniqueKeyId;
    config.beckn.signingPrivateKey = original.signingPrivateKey;
  };
}

function context(action, transactionId, messageId, overrides = {}) {
  return {
    domain: config.beckn.domain,
    country: config.beckn.country,
    city: config.beckn.city,
    action,
    core_version: config.beckn.protocolVersion,
    bap_id: config.beckn.bapId,
    bap_uri: config.beckn.bapUri,
    transaction_id: transactionId,
    message_id: messageId,
    timestamp: new Date().toISOString(),
    ttl: 'PT30S',
    ...overrides
  };
}

function catalogPayload({
  transactionId,
  messageId,
  bppId,
  bppUri,
  providerId,
  itemId,
  price = '90000'
}) {
  return {
    context: context('on_search', transactionId, messageId, {
      bpp_id: bppId,
      bpp_uri: bppUri
    }),
    message: {
      catalog: {
        providers: [{
          id: providerId,
          descriptor: { name: `${providerId} Seller` },
          rating: 4.6,
          locations: [{ descriptor: { name: 'Hyderabad Warehouse' } }],
          fulfillments: [{ id: `ful-${providerId}`, time: { duration: 'P3D' } }],
          items: [{
            id: itemId,
            descriptor: { name: 'Enterprise Laptop' },
            price: { currency: 'INR', value: price }
          }]
        }]
      }
    }
  };
}

test('callback store consumes one-shot callbacks and rejects stale/unexpected traffic', async () => {
  callbackStore.clear();
  const transactionId = uuidv4();
  const messageId = uuidv4();

  callbackStore.expect('on_select', transactionId, {
    messageId,
    bppId: 'seller.example',
    bppUri: 'https://seller.example',
    ttlMs: 500
  });

  const pending = callbackStore.waitFor('on_select', transactionId, 500);
  setTimeout(() => {
    callbackStore.record('on_select', {
      context: context('on_select', transactionId, messageId, {
        bpp_id: 'seller.example',
        bpp_uri: 'https://seller.example'
      }),
      message: { order: { id: 'draft-1' } }
    });
  }, 10);

  const payload = await pending;
  assert.equal(payload.message.order.id, 'draft-1');
  assert.equal(callbackStore.getAll('on_select', transactionId).length, 0);
  assert.equal(callbackStore.getExpectation('on_select', transactionId), null);

  assert.throws(() => {
    callbackStore.record('on_select', {
      context: context('on_select', transactionId, messageId, {
        bpp_id: 'seller.example',
        bpp_uri: 'https://seller.example'
      }),
      message: { order: { id: 'stale' } }
    });
  }, /Unexpected or expired/);

  callbackStore.clear();
});

test('callback store deduplicates retries while retaining distinct BPP search callbacks', () => {
  callbackStore.clear();
  const transactionId = uuidv4();
  const messageId = uuidv4();

  callbackStore.expect('on_search', transactionId, {
    messageId,
    multi: true,
    ttlMs: 1000
  });

  const first = catalogPayload({
    transactionId,
    messageId,
    bppId: 'seller-a.example',
    bppUri: 'https://seller-a.example',
    providerId: 'provider-a',
    itemId: 'item-1'
  });
  const second = catalogPayload({
    transactionId,
    messageId,
    bppId: 'seller-b.example',
    bppUri: 'https://seller-b.example',
    providerId: 'provider-b',
    itemId: 'item-1'
  });

  assert.equal(callbackStore.record('on_search', first).duplicate, false);
  assert.equal(callbackStore.record('on_search', first).duplicate, true);
  assert.equal(callbackStore.record('on_search', second).duplicate, false);
  assert.equal(callbackStore.getAll('on_search', transactionId).length, 2);

  const consumed = callbackStore.consumeAll('on_search', transactionId);
  assert.equal(consumed.length, 2);
  assert.equal(callbackStore.getExpectation('on_search', transactionId), null);
});

test('schema validation rejects malformed Beckn callback contexts', () => {
  assert.throws(() => {
    validateBecknPayload('on_confirm', {
      context: {
        action: 'on_confirm',
        transaction_id: 'not-a-uuid',
        message_id: 'also-not-a-uuid'
      },
      message: { order: {} }
    });
  }, /Invalid Beckn on_confirm payload/);
});

test('ONDC-style Ed25519 callback authorization verifies the raw request body', () => {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519');
  const publicDer = publicKey.export({ format: 'der', type: 'spki' });
  const rawPublicKey = publicDer.subarray(publicDer.length - 32).toString('base64');

  const subscriberId = 'seller-auth.example';
  const uniqueKeyId = 'key-1';
  config.beckn.callbackPublicKeys[`${subscriberId}|${uniqueKeyId}`] = rawPublicKey;

  const rawBody = Buffer.from(JSON.stringify({ hello: 'beckn' }), 'utf8');
  const created = Math.floor(Date.now() / 1000) - 1;
  const expires = created + 300;
  const digest = digestRawBody(rawBody);
  const signed = Buffer.from(signingString(created, expires, digest), 'utf8');
  const signature = crypto.sign(null, signed, privateKey).toString('base64');

  const authorization =
    `Signature keyId="${subscriberId}|${uniqueKeyId}|ed25519",` +
    `algorithm="ed25519",created="${created}",expires="${expires}",` +
    `headers="(created) (expires) digest",signature="${signature}"`;

  const verified = verifyCallbackAuthorization({
    authorization,
    rawBody,
    expectedBppId: subscriberId
  });

  assert.equal(verified.authenticated, true);
  assert.equal(verified.subscriberId, subscriberId);

  delete config.beckn.callbackPublicKeys[`${subscriberId}|${uniqueKeyId}`];
});

test('public callback endpoint rejects unsigned callbacks for an outstanding operation', async () => {
  callbackStore.clear();
  const transactionId = uuidv4();
  const messageId = uuidv4();
  const bppId = 'seller-route.example';
  const bppUri = 'https://seller-route.example';

  callbackStore.expect('on_status', transactionId, {
    messageId,
    bppId,
    bppUri,
    ttlMs: 1000
  });

  const payload = {
    context: context('on_status', transactionId, messageId, {
      bpp_id: bppId,
      bpp_uri: bppUri
    }),
    message: {
      order: {
        id: 'order-route-1',
        state: 'IN_PROGRESS'
      }
    }
  };

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));

  try {
    const address = server.address();
    const result = await fetch(
      `http://127.0.0.1:${address.port}/beckn/on_status`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      }
    );

    assert.equal(result.status, 401);
    const body = await result.json();
    assert.equal(body.message.ack.status, 'NACK');
    assert.equal(body.error.code, 'PROCURA-X-AUTHENTICATION');
  } finally {
    await new Promise(resolve => server.close(resolve));
    callbackStore.clear();
  }
});

test('real search aggregates multiple BPP callbacks and suppresses duplicate retries', async () => {
  const originalMode = becknProvider.mode;
  const originalFetch = global.fetch;
  const restoreSigning = installOutboundSigningFixture();
  const correlationId = 'corr_multi_bpp_test';

  becknProvider.mode = 'real';
  callbackStore.clear();

  global.fetch = async (url, options) => {
    const request = JSON.parse(options.body);

    setTimeout(() => {
      const first = catalogPayload({
        transactionId: request.context.transaction_id,
        messageId: request.context.message_id,
        bppId: 'seller-a.example',
        bppUri: 'https://seller-a.example',
        providerId: 'provider-a',
        itemId: 'item-1',
        price: '90000'
      });
      const second = catalogPayload({
        transactionId: request.context.transaction_id,
        messageId: request.context.message_id,
        bppId: 'seller-b.example',
        bppUri: 'https://seller-b.example',
        providerId: 'provider-b',
        itemId: 'item-1',
        price: '88000'
      });

      callbackStore.record('on_search', first);
      callbackStore.record('on_search', first);
      callbackStore.record('on_search', second);
    }, 10);

    return response({ message: { ack: { status: 'ACK' } } });
  };

  try {
    const search = await becknProvider.search({
      category: 'laptop',
      quantity: 2,
      location: '500081'
    }, correlationId);

    assert.match(search.becknTransactionId, /^[0-9a-f-]{36}$/i);
    assert.equal(search.callbackCount, 2);
    assert.equal(search.bppCount, 2);
    assert.equal(search.offers.length, 2);
    assert.deepEqual(
      new Set(search.offers.map(offer => offer.becknBppId)),
      new Set(['seller-a.example', 'seller-b.example'])
    );
  } finally {
    becknProvider.mode = originalMode;
    global.fetch = originalFetch;
    restoreSigning();
    callbackStore.clear();
    becknProvider._clearTransaction(correlationId);
  }
});

test('real provider executes lifecycle, preserves revised quote, and evicts transaction state', async () => {
  const originalMode = becknProvider.mode;
  const originalFetch = global.fetch;
  const restoreSigning = installOutboundSigningFixture();
  const calls = [];
  const correlationId = 'corr_real_lifecycle';

  becknProvider.mode = 'real';
  callbackStore.clear();

  global.fetch = async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ url, request, headers: options.headers });
    const common = {
      ...request.context,
      bpp_id: 'seller.example',
      bpp_uri: 'https://seller.example'
    };

    if (request.context.action === 'search') {
      return response(catalogPayload({
        transactionId: request.context.transaction_id,
        messageId: request.context.message_id,
        bppId: 'seller.example',
        bppUri: 'https://seller.example',
        providerId: 'provider-1',
        itemId: 'item-1',
        price: '90000'
      }));
    }

    if (request.context.action === 'select') {
      return response({
        context: { ...common, action: 'on_select' },
        message: {
          order: {
            provider: { id: 'provider-1' },
            items: request.message.order.items,
            fulfillments: [{ id: 'ful-provider-1' }],
            quote: { price: { currency: 'INR', value: '180000' } }
          }
        }
      });
    }

    if (request.context.action === 'init') {
      return response({
        context: { ...common, action: 'on_init' },
        message: {
          order: {
            ...request.message.order,
            quote: { price: { currency: 'INR', value: '178000' } }
          }
        }
      });
    }

    if (request.context.action === 'confirm') {
      return response({
        context: { ...common, action: 'on_confirm' },
        message: {
          order: {
            id: 'beckn-order-1',
            state: 'ACCEPTED',
            quote: { price: { currency: 'INR', value: '175000' } },
            fulfillments: [{
              id: 'ful-provider-1',
              state: { descriptor: { code: 'ORDER_ACKNOWLEDGED' } },
              tracking_url: 'https://seller.example/track/beckn-order-1',
              end: { time: { timestamp: '2026-09-28T10:00:00.000Z' } }
            }]
          }
        }
      });
    }

    if (request.context.action === 'status') {
      return response({
        context: { ...common, action: 'on_status' },
        message: {
          order: {
            id: request.message.order_id,
            state: 'IN_PROGRESS',
            fulfillments: [{
              state: { descriptor: { code: 'IN_TRANSIT' } },
              current_location: { descriptor: { name: 'Hyderabad Hub' } }
            }]
          }
        }
      });
    }

    return response({ message: { ack: { status: 'NACK' } } }, 400);
  };

  try {
    const search = await becknProvider.search({
      category: 'laptop',
      quantity: 2,
      location: '500081'
    }, correlationId);

    assert.equal(search.offers.length, 1);
    const offer = search.offers[0];
    assert.equal(offer.totalPricePaise, 18000000);
    assert.equal(offer.deliveryDays, 3);
    assert.equal(offer.becknBppUri, 'https://seller.example');

    const selected = await becknProvider.select(offer, correlationId);
    assert.equal(selected.status, 'SELECTED');

    const initialized = await becknProvider.init(
      offer,
      { orgName: 'ProcuraX Test Buyer', location: 'Hyderabad' },
      correlationId
    );
    assert.equal(initialized.status, 'INITIALIZED');

    const confirmed = await becknProvider.confirm(offer, correlationId);
    assert.equal(confirmed.becknOrderId, 'beckn-order-1');
    assert.equal(confirmed.order.fulfillmentStatus, 'ORDER_ACKNOWLEDGED');
    assert.equal(confirmed.order.finalTotalPricePaise, 17500000);
    assert.equal(becknProvider.transactions.has(correlationId), false);

    const status = await becknProvider.status(
      confirmed.becknOrderId,
      correlationId,
      confirmed.networkContext
    );
    assert.equal(status.fulfillmentState, 'IN_TRANSIT');
    assert.equal(status.location, 'Hyderabad Hub');

    const protocolTransactions = new Set(
      calls.map(call => call.request.context.transaction_id)
    );
    assert.equal(protocolTransactions.size, 1);

    assert.deepEqual(
      calls.map(call => call.request.context.action),
      ['search', 'select', 'init', 'confirm', 'status']
    );
    assert.ok(
      calls.every(call => /^Signature /.test(call.headers.Authorization || '')),
      'real-mode Beckn requests must carry an ONDC Authorization signature'
    );
  } finally {
    becknProvider.mode = originalMode;
    global.fetch = originalFetch;
    restoreSigning();
    callbackStore.clear();
    becknProvider._clearTransaction(correlationId);
  }
});


test('local sandbox completes the full Beckn lifecycle over HTTP', async () => {
  const originalMode = becknProvider.mode;
  const originalGatewayUrl = becknProvider.gatewayUrl;
  const originalBapUri = config.beckn.bapUri;
  const correlationId = 'corr_http_sandbox';
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  becknProvider.mode = 'sandbox';
  becknProvider.gatewayUrl = `${baseUrl}/beckn/gateway`;
  config.beckn.bapUri = `${baseUrl}/beckn/bap`;
  callbackStore.clear();

  try {
    const search = await becknProvider.search({
      category: 'laptop',
      quantity: 2,
      location: '500081'
    }, correlationId);

    assert.ok(search.offers.length >= 1);
    const offer = search.offers[0];
    assert.match(offer.becknBppUri, /\/beckn\/sandbox\/bpp$/);

    const selected = await becknProvider.select(offer, correlationId);
    assert.equal(selected.status, 'SELECTED');

    const initialized = await becknProvider.init(
      offer,
      { orgName: 'ProcuraX Sandbox Buyer', location: 'Hyderabad' },
      correlationId
    );
    assert.equal(initialized.status, 'INITIALIZED');

    const confirmed = await becknProvider.confirm(offer, correlationId);
    assert.ok(confirmed.becknOrderId);
    assert.equal(confirmed.order.fulfillmentStatus, 'ORDER_ACKNOWLEDGED');

    const status = await becknProvider.status(
      confirmed.becknOrderId,
      correlationId,
      confirmed.networkContext
    );
    assert.equal(status.fulfillmentState, 'IN_TRANSIT');
    assert.equal(status.location, 'ProcuraX Local Distribution Hub');
  } finally {
    becknProvider.mode = originalMode;
    becknProvider.gatewayUrl = originalGatewayUrl;
    config.beckn.bapUri = originalBapUri;
    callbackStore.clear();
    becknProvider._clearTransaction(correlationId);
    await new Promise((resolve, reject) =>
      server.close(err => err ? reject(err) : resolve())
    );
  }
});
