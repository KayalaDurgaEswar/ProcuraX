const express = require('express');
const router = express.Router();
const mockNetwork = require('../services/beckn/mockNetwork');
const callbackStore = require('../services/beckn/callbackStore');
const { validateBecknPayload } = require('../services/beckn/schemaValidator');
const { verifyCallbackAuthorization } = require('../services/beckn/authVerifier');

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
  return (req, res) => {
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

      verifyCallbackAuthorization({
        authorization,
        rawBody: req.rawBody,
        expectedBppId: expectation.bppId || payload.context.bpp_id
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

    const result = await mockNetwork.search({ category, quantity }, transactionId);
    return res.json({
      context: {
        ...context,
        action: 'on_search',
        bpp_id: 'sandbox-bpp.procurax.local',
        bpp_uri: 'http://localhost:3000/beckn/sandbox/bpp',
        transaction_id: transactionId,
        message_id: context.message_id,
        timestamp: new Date().toISOString()
      },
      message: {
        catalog: {
          descriptor: { name: 'ProcuraX Local Beckn Sandbox Catalog' },
          providers: result.offers
        }
      }
    });
  } catch (err) {
    return res.status(400).json(nack(err.message, 'PROCURA-X-SANDBOX-VALIDATION'));
  }
});

const callbackActions = ['on_search', 'on_select', 'on_init', 'on_confirm', 'on_status'];

callbackActions.forEach(action => {
  const handler = callbackHandler(action);
  router.post(`/${action}`, handler);
  router.post(`/bap/${action}`, handler);
});

module.exports = router;
