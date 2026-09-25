const express = require('express');
const router = express.Router();
const mockNetwork = require('../services/beckn/mockNetwork');

/**
 * Beckn Gateway Search Endpoint (/beckn/gateway/search)
 */
router.post('/gateway/search', async (req, res) => {
  const { context, message } = req.body || {};
  const transactionId = context?.transaction_id || 'tx_mock_123';
  const category = message?.intent?.item?.descriptor?.name || 'laptop';

  const result = await mockNetwork.search({ category, quantity: 10 }, transactionId);
  return res.json({
    context: {
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
});

/**
 * Beckn Protocol Callback Inspector Webhooks
 */
router.post('/on_search', (req, res) => res.json({ ack: { status: 'ACK' } }));
router.post('/on_select', (req, res) => res.json({ ack: { status: 'ACK' } }));
router.post('/on_init', (req, res) => res.json({ ack: { status: 'ACK' } }));
router.post('/on_confirm', (req, res) => res.json({ ack: { status: 'ACK' } }));

module.exports = router;
