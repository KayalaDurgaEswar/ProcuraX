const test = require('node:test');
const assert = require('node:assert/strict');
const callbackStore = require('../src/services/beckn/callbackStore');
const becknProvider = require('../src/services/beckn/becknProvider');

function response(body, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    async text() {
      return JSON.stringify(body);
    }
  };
}

test('Beckn callback store correlates callbacks by action and transaction', async () => {
  callbackStore.clear();
  const transactionId = 'tx_callback_test';

  const pending = callbackStore.waitFor('on_select', transactionId, 500);
  setTimeout(() => {
    callbackStore.record('on_select', {
      context: {
        action: 'on_select',
        transaction_id: transactionId
      },
      message: { order: { id: 'draft-1' } }
    });
  }, 10);
  const payload = await pending;
  assert.equal(payload.message.order.id, 'draft-1');
  assert.equal(callbackStore.getAll('on_select', transactionId).length, 1);
  callbackStore.clear();
});

test('Beckn real provider executes direct callback lifecycle without mock fallback', async () => {
  const originalMode = becknProvider.mode;
  const originalFetch = global.fetch;
  const calls = [];

  becknProvider.mode = 'real';
  callbackStore.clear();

  global.fetch = async (url, options) => {
    const request = JSON.parse(options.body);
    calls.push({ url, request });
    const common = {
      ...request.context,
      bpp_id: 'seller.example',
      bpp_uri: 'https://seller.example'
    };

    if (request.context.action === 'search') {
      return response({
        context: { ...common, action: 'on_search' },
        message: {
          catalog: {
            providers: [{
              id: 'provider-1',
              descriptor: { name: 'Enterprise Seller' },
              rating: 4.6,
              locations: [{ descriptor: { name: 'Hyderabad Warehouse' } }],
              fulfillments: [{ id: 'ful-1', time: { duration: 'P3D' } }],
              items: [{
                id: 'item-1',
                descriptor: { name: 'Enterprise Laptop' },
                price: { currency: 'INR', value: '90000' }
              }]
            }]
          }
        }
      });
    }

    if (request.context.action === 'select') {
      return response({
        context: { ...common, action: 'on_select' },
        message: {
          order: {
            provider: { id: 'provider-1' },
            items: request.message.order.items,
            fulfillments: [{ id: 'ful-1' }]
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
            quote: { price: { currency: 'INR', value: '180000' } }
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
            fulfillments: [{
              id: 'ful-1',
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
    const transactionId = 'tx_real_lifecycle';
    const search = await becknProvider.search({
      category: 'laptop',
      quantity: 2,
      location: '500081'
    }, transactionId);

    assert.equal(search.offers.length, 1);
    const offer = search.offers[0];
    assert.equal(offer.totalPricePaise, 18000000);
    assert.equal(offer.deliveryDays, 3);
    assert.equal(offer.becknBppUri, 'https://seller.example');

    const selected = await becknProvider.select(offer, transactionId);
    assert.equal(selected.status, 'SELECTED');

    const initialized = await becknProvider.init(
      offer,
      { orgName: 'ProcuraX Test Buyer', location: 'Hyderabad' },
      transactionId
    );
    assert.equal(initialized.status, 'INITIALIZED');

    const confirmed = await becknProvider.confirm(offer, transactionId);
    assert.equal(confirmed.becknOrderId, 'beckn-order-1');
    assert.equal(confirmed.order.fulfillmentStatus, 'ORDER_ACKNOWLEDGED');

    const status = await becknProvider.status(
      confirmed.becknOrderId,
      transactionId,
      confirmed.networkContext
    );
    assert.equal(status.fulfillmentState, 'IN_TRANSIT');
    assert.equal(status.location, 'Hyderabad Hub');

    assert.deepEqual(
      calls.map(call => call.request.context.action),
      ['search', 'select', 'init', 'confirm', 'status']
    );
  } finally {
    becknProvider.mode = originalMode;
    global.fetch = originalFetch;
    callbackStore.clear();
    becknProvider.transactions.clear();
  }
});
