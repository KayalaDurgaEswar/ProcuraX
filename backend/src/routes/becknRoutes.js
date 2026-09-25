const express = require('express');
const router = express.Router();
const mockNetwork = require('../services/beckn/mockNetwork');
const callbackStore = require('../services/beckn/callbackStore');
const { validateBecknPayload } = require('../services/beckn/schemaValidator');
const { verifyCallbackAuthorizationWithRegistry } = require('../services/beckn/authVerifier');
const { v4: uuidv4 } = require('uuid');

const sandboxCatalog = new Map();
const sandboxOrders = new Map();

function sandboxBppUri(req) {
  return `${req.protocol}://${req.get('host')}/beckn/sandbox/bpp`;
}

function sandboxContext(req, action) {
  return {
    ...req.body.context,
    action,
    bpp_id: 'sandbox-bpp.procurax.local',
    bpp_uri: sandboxBppUri(req),
    timestamp: new Date().toISOString()
  };
}

function ack(metadata = null) {
  const response = { message: { ack: { status: 'ACK' } } };
  if (metadata) response.meta = metadata;
  return response;
}

function nack(message, code = 'PROCURA-X-INVALID-CALLBACK') {
  return {
    message: { ack: { status: 'NACK' } },
    error: {
      type: 'CORE-ERROR',
      code,
      message
    }
  };
}

function callbackHandler(expectedAction) {
  return async (req, res) => {
    const payload = req.body || {};

    try {
      validateBecknPayload(expectedAction, payload);
    } catch (err) {
      return res.status(400).json(nack(err.message, 'PROCURA-X-SCHEMA-VALIDATION'));
    }

    let expectation;
    try {
      expectation = callbackStore.assertExpected(expectedAction, payload).expectation;
    } catch (err) {
      return res.status(409).json(nack(err.message, 'PROCURA-X-UNEXPECTED-CALLBACK'));
    }

    try {
      const authorization =
        req.get('authorization') || req.get('x-gateway-authorization');

      await verifyCallbackAuthorizationWithRegistry({
        authorization,
        rawBody: req.rawBody,
        expectedBppId: expectation.bppId || payload.context.bpp_id,
        context: payload.context
      });
    } catch (err) {
      return res.status(401).json(nack(err.message, 'PROCURA-X-AUTHENTICATION'));
    }

    try {
      const result = callbackStore.record(expectedAction, payload);
      return res.status(200).json(ack({ duplicate: Boolean(result.duplicate) }));
    } catch (err) {
      return res.status(400).json(nack(err.message));
    }
  };
}

/**
 * Local sandbox discovery endpoint.
 * It intentionally behaves like a single BPP response so real-mode protocol
 * handling can be exercised without pretending the sandbox is an ONDC gateway.
 */
router.post('/gateway/search', async (req, res) => {
  try {
    validateBecknPayload('search', req.body || {});

    const { context, message } = req.body;
    const transactionId = context.transaction_id;
    const category = message?.intent?.item?.descriptor?.name || 'laptop';
    const quantity = Number(message?.intent?.item?.quantity?.selected?.count || 10);
    const location = message?.intent?.fulfillment?.end?.location?.address?.area_code || '500081';

    const result = await mockNetwork.search({ category, quantity, location }, transactionId);
    const providers = result.offers.map(offer => {
      sandboxCatalog.set(offer.id, offer);
      return {
        id: offer.sellerId,
        descriptor: { name: offer.sellerName },
        rating: offer.sellerRating,
        locations: [{ descriptor: { name: offer.location } }],
        fulfillments: [{
          id: offer.becknFulfillmentId,
          time: { duration: `P${offer.deliveryDays}D` }
        }],
        items: [{
          id: offer.id,
          descriptor: {
            name: offer.itemTitle,
            short_desc: offer.warranty
          },
          price: {
            currency: 'INR',
            value: (offer.unitPricePaise / 100).toFixed(2)
          }
        }]
      };
    });

    return res.json({
      context: sandboxContext(req, 'on_search'),
      message: {
        catalog: {
          descriptor: { name: 'ProcuraX Local Beckn Sandbox Catalog' },
          providers
        }
      }
    });
  } catch (err) {
    return res.status(400).json(nack(err.message, 'PROCURA-X-SANDBOX-VALIDATION'));
  }
});

router.post('/sandbox/bpp/select', (req, res) => {
  try {
    validateBecknPayload('select', req.body || {}, { requireBpp: true });
    const order = req.body.message.order;
    const selectedItem = order.items[0];
    const offer = sandboxCatalog.get(selectedItem.id);
    if (!offer) {
      return res.status(404).json(nack('Sandbox item was not found or has expired', 'PROCURA-X-SANDBOX-ITEM'));
    }

    const quantity = Number(selectedItem?.quantity?.selected?.count || offer.quantity || 1);
    const total = (offer.unitPricePaise * quantity) / 100;

    return res.json({
      context: sandboxContext(req, 'on_select'),
      message: {
        order: {
          provider: { id: offer.sellerId },
          items: order.items,
          fulfillments: [{ id: offer.becknFulfillmentId }],
          quote: { price: { currency: 'INR', value: total.toFixed(2) } }
        }
      }
    });
  } catch (err) {
    return res.status(400).json(nack(err.message, 'PROCURA-X-SANDBOX-SELECT'));
  }
});

router.post('/sandbox/bpp/init', (req, res) => {
  try {
    validateBecknPayload('init', req.body || {}, { requireBpp: true });
    const order = req.body.message.order;

    return res.json({
      context: sandboxContext(req, 'on_init'),
      message: {
        order: {
          ...order,
          payment: {
            type: 'ON-ORDER',
            collected_by: 'BAP',
            status: 'NOT-PAID'
          }
        }
      }
    });
  } catch (err) {
    return res.status(400).json(nack(err.message, 'PROCURA-X-SANDBOX-INIT'));
  }
});

router.post('/sandbox/bpp/confirm', (req, res) => {
  try {
    validateBecknPayload('confirm', req.body || {}, { requireBpp: true });
    const draft = req.body.message.order;
    const orderId = `sandbox-order-${uuidv4()}`;
    const fulfillment = draft.fulfillments?.[0] || {};
    const confirmed = {
      ...draft,
      id: orderId,
      state: 'ACCEPTED',
      fulfillments: [{
        ...fulfillment,
        state: { descriptor: { code: 'ORDER_ACKNOWLEDGED' } },
        tracking_url: `${req.protocol}://${req.get('host')}/beckn/sandbox/track/${orderId}`,
        end: { time: { timestamp: new Date(Date.now() + 3 * 86400000).toISOString() } }
      }]
    };

    sandboxOrders.set(orderId, confirmed);
    return res.json({
      context: sandboxContext(req, 'on_confirm'),
      message: { order: confirmed }
    });
  } catch (err) {
    return res.status(400).json(nack(err.message, 'PROCURA-X-SANDBOX-CONFIRM'));
  }
});

router.post('/sandbox/bpp/status', (req, res) => {
  try {
    validateBecknPayload('status', req.body || {}, { requireBpp: true });
    const orderId = req.body.message.order_id;
    const existing = sandboxOrders.get(orderId);

    if (!existing) {
      return res.status(404).json(nack('Sandbox order was not found', 'PROCURA-X-SANDBOX-ORDER'));
    }

    const fulfillment = existing.fulfillments?.[0] || {};
    const current = {
      ...existing,
      state: 'IN_PROGRESS',
      fulfillments: [{
        ...fulfillment,
        state: { descriptor: { code: 'IN_TRANSIT' } },
        current_location: { descriptor: { name: 'ProcuraX Local Distribution Hub' } }
      }]
    };
    sandboxOrders.set(orderId, current);

    return res.json({
      context: sandboxContext(req, 'on_status'),
      message: { order: current }
    });
  } catch (err) {
    return res.status(400).json(nack(err.message, 'PROCURA-X-SANDBOX-STATUS'));
  }
});

router.get('/sandbox/track/:orderId', (req, res) => {
  const order = sandboxOrders.get(req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Sandbox order was not found' });
  }

  const fulfillment = order.fulfillments?.[0] || {};
  return res.json({
    orderId: order.id,
    state: order.state,
    fulfillmentState: fulfillment?.state?.descriptor?.code || 'ORDER_ACKNOWLEDGED',
    trackingUrl: fulfillment.tracking_url || null,
    estimatedDeliveryDate: fulfillment?.end?.time?.timestamp || null
  });
});

const callbackActions = ['on_search', 'on_select', 'on_init', 'on_confirm', 'on_status'];

callbackActions.forEach(action => {
  const handler = callbackHandler(action);
  router.post(`/${action}`, handler);
  router.post(`/bap/${action}`, handler);
});

module.exports = router;
