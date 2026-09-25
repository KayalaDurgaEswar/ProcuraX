const express = require('express');
const router = express.Router();
const mockNetwork = require('../services/beckn/mockNetwork');
const callbackStore = require('../services/beckn/callbackStore');

function ack() {
  return { message: { ack: { status: 'ACK' } } };
}

function nack(message) {
  return {
    message: { ack: { status: 'NACK' } },
    error: {
      type: 'CORE-ERROR',
      code: 'PROCURA-X-INVALID-CALLBACK',
      message
    }
  };
}

function callbackHandler(expectedAction) {
  return (req, res) => {
    const payload = req.body || {};
    const context = payload.context || {};
    if (!context.transaction_id) {
      return res.status(400).json(nack('context.transaction_id is required'));
    }

    if (context.action && context.action !== expectedAction) {
      return res.status(400).json(
        nack(`Expected context.action=${expectedAction}, received ${context.action}`)
      );
    }

    try {
      callbackStore.record(expectedAction, payload);
      return res.status(200).json(ack());
    } catch (err) {
      return res.status(400).json(nack(err.message));
    }
  };
}

/**
 * Local sandbox discovery endpoint.
 * This returns an on_search-shaped payload directly so the project can run
 * without an external Beckn gateway while DEFAULT_NETWORK_PROVIDER=mock.
 */
router.post('/gateway/search', async (req, res) => {
  try {
    const { context, message } = req.body || {};
    const transactionId = context?.transaction_id || 'tx_mock_123';
    const category = message?.intent?.item?.descriptor?.name || 'laptop';
    const quantity = Number(message?.intent?.item?.quantity?.selected?.count || 10);

    const result = await mockNetwork.search({ category, quantity }, transactionId);
    return res.json({
      context: {
        ...context,
        action: 'on_search',
        transaction_id: transactionId,
        timestamp: new Date().toISOString()
      },
      message: {
        catalog: {
          descriptor: { name: 'ONDC B2B Commerce Catalog' },
          providers: result.offers
        }
      }
    });
  } catch (err) {
    return res.status(500).json(nack(err.message));
  }
});

const callbackActions = ['on_search', 'on_select', 'on_init', 'on_confirm', 'on_status'];

callbackActions.forEach(action => {
  const handler = callbackHandler(action);
  router.post(`/${action}`, handler);
  router.post(`/bap/${action}`, handler);
});

module.exports = router;
