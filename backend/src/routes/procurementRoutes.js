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
 * List all procurement requests from MongoDB
 */
router.get('/procurements', async (req, res) => {
  try {
    const requests = await db.find('procurementRequests', {});
    const sorted = requests.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json(sorted);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/procurements/:id
 * Get full composite detail for a procurement request from MongoDB
 */
router.get('/procurements/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const request = await db.findById('procurementRequests', id);
    if (!request) {
      return res.status(404).json({ error: 'Procurement request not found' });
    }

    const offers = await db.find('offers', { procurementId: id });
    const negotiations = await db.find('negotiations', { procurementId: id });
    const approvals = await db.find('approvals', { procurementId: id });
    const order = await db.findOne('orders', { procurementId: id });
    const auditTrail = await auditService.getProcurementAuditTrail(id);
    const memoryPattern = await memoryService.getCategoryPattern(request.intent?.category);

    return res.json({ request, offers, negotiations, approvals, order, auditTrail, memoryPattern });
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
router.post('/procurements/:id/reject', async (req, res) => {
  try {
    const id = req.params.id;
    const { actorId = 'user_procurement_lead', reason = 'Rejected by manager' } = req.body;

    const request = await db.findById('procurementRequests', id);
    if (!request) return res.status(404).json({ error: 'Request not found' });

    await db.update('procurementRequests', id, { state: 'CANCELLED', rejectionReason: reason });
    
    await auditService.logEvent({
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
    const order = await db.findById('orders', orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const statusResult = await becknProvider.status(order.becknOrderId, order.procurementId);
    return res.json({ order, becknTracking: statusResult });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/memory
 * Learned procurement pattern statistics from MongoDB
 */
router.get('/memory', async (req, res) => {
  try {
    const patterns = await db.find('memoryPatterns', {});
    return res.json(patterns);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/audit
 * All audit events from MongoDB
 */
router.get('/audit', async (req, res) => {
  try {
    const events = await auditService.getAllAuditEvents(200);
    return res.json(events);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/users
 * List users from MongoDB
 */
router.get('/users', async (req, res) => {
  try {
    const users = await db.find('users', {});
    return res.json(users);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
