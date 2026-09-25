const express = require('express');
const router = express.Router();
const db = require('../db/database');
const procurementAgent = require('../services/agent/procurementAgent');
const auditService = require('../services/audit/auditService');
const becknProvider = require('../services/beckn/becknProvider');
const memoryService = require('../services/memory/memoryService');

/**
 * POST /api/procurements
 * Create natural language procurement request & trigger agent execution
 */
router.post('/procurements', async (req, res) => {
  try {
    const { prompt, userId, orgId } = req.body;
    if (!prompt) {
      return res.status(400).json({ error: 'natural language prompt is required' });
    }

    const result = await procurementAgent.startProcurement(prompt, userId, orgId);
    return res.status(201).json(result);
  } catch (err) {
    console.error('API Error /api/procurements:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/procurements
 * List all active/past procurement requests
 */
router.get('/procurements', (req, res) => {
  try {
    const requests = db.find('procurementRequests', () => true);
    const sorted = requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json(sorted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/procurements/:id
 * Get full composite detail for a procurement request
 */
router.get('/procurements/:id', (req, res) => {
  try {
    const id = req.params.id;
    const request = db.findById('procurementRequests', id);
    if (!request) {
      return res.status(404).json({ error: 'Procurement request not found' });
    }

    const offers = db.find('offers', o => o.procurementId === id);
    const negotiations = db.find('negotiations', n => n.procurementId === id);
    const approvals = db.find('approvals', a => a.procurementId === id);
    const order = db.findOne('orders', o => o.procurementId === id);
    const auditTrail = auditService.getProcurementAuditTrail(id);
    const memoryPattern = memoryService.getCategoryPattern(request.intent?.category);

    return res.json({
      request,
      offers,
      negotiations,
      approvals,
      order,
      auditTrail,
      memoryPattern
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/procurements/:id/audit
 * Fetch the immutable audit trail for a procurement request
 */
router.get('/procurements/:id/audit', (req, res) => {
  try {
    const id = req.params.id;
    const request = db.findById('procurementRequests', id);
    if (!request) {
      return res.status(404).json({ error: 'Procurement request not found' });
    }

    const auditTrail = auditService.getProcurementAuditTrail(id);
    return res.json({
      procurementId: id,
      correlationId: request.correlationId,
      auditTrail
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/procurements/:id/approve
 * Human-in-the-loop approval endpoint
 */
router.post('/procurements/:id/approve', async (req, res) => {
  try {
    const id = req.params.id;
    const { approverId = 'user_procurement_lead', comments } = req.body;

    const result = await procurementAgent.grantHumanApproval(id, approverId, comments);
    return res.json({ message: 'Procurement approved successfully', ...result });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

/**
 * POST /api/procurements/:id/reject
 * Reject a procurement request
 */
router.post('/procurements/:id/reject', (req, res) => {
  try {
    const id = req.params.id;
    const { actorId = 'user_procurement_lead', reason = 'Rejected by manager' } = req.body;

    const request = db.findById('procurementRequests', id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    db.update('procurementRequests', id, { state: 'CANCELLED', rejectionReason: reason });
    
    auditService.logEvent({
      procurementId: id,
      correlationId: request.correlationId,
      action: 'APPROVAL_REJECTED',
      actor: actorId,
      previousState: request.state,
      newState: 'CANCELLED',
      metadata: { reason }
    });

    return res.json({ message: 'Procurement rejected', state: 'CANCELLED' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/orders/:id/status
 * Real-time Beckn order tracking query
 */
router.get('/orders/:id/status', async (req, res) => {
  try {
    const orderId = req.params.id;
    const order = db.findById('orders', orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const statusResult = await becknProvider.status(order.becknOrderId, order.procurementId);
    return res.json({
      order,
      becknTracking: statusResult
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/memory
 * Learned procurement pattern statistics
 */
router.get('/memory', (req, res) => {
  try {
    const patterns = db.find('memoryPatterns', () => true);
    return res.json(patterns);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
