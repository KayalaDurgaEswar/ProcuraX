const express = require('express');
const router = express.Router();
const db = require('../db/database');
const procurementAgent = require('../services/agent/procurementAgent');
const auditService = require('../services/audit/auditService');
const becknProvider = require('../services/beckn/becknProvider');
const memoryService = require('../services/memory/memoryService');
const approvalEngine = require('../services/approval/approvalEngine');

/**
 * POST /api/procurements
 * Create natural language procurement request & trigger agent execution
 */
router.post('/procurements', async (req, res) => {
  try {
    const { prompt, userId, orgId } = req.body;
    if (typeof prompt !== 'string' || !prompt.trim()) {
      return res.status(400).json({ error: 'natural language prompt is required' });
    }
    if (prompt.length > 1200) {
      return res.status(400).json({ error: 'natural language prompt must be 1200 characters or fewer' });
    }

    const result = await procurementAgent.startProcurement(prompt.trim(), userId, orgId);
    // Keep the creation API stable whether the agent pauses for approval
    // or auto-approves and immediately executes an order.
    const request = result?.request || result;
    return res.status(201).json(request);
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
 * GET /api/procurements/:id/audit
 * Fetch the immutable audit trail for a procurement request
 */
router.get('/procurements/:id/audit', async (req, res) => {
  try {
    const id = req.params.id;
    const request = await db.findById('procurementRequests', id);
    if (!request) {
      return res.status(404).json({ error: 'Procurement request not found' });
    }

    const auditTrail = await auditService.getProcurementAuditTrail(id);
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
router.post('/procurements/:id/reject', async (req, res) => {
  try {
    const id = req.params.id;
    const {
      actorId = 'user_procurement_lead',
      reason = 'Rejected by authorized approver'
    } = req.body;

    const request = await db.findById('procurementRequests', id);
    if (!request) return res.status(404).json({ error: 'Request not found' });
    if (request.state !== 'PENDING_APPROVAL') {
      return res.status(409).json({
        error: `Only PENDING_APPROVAL procurements can be rejected; current state is ${request.state}`
      });
    }

    const actor = await db.findById('users', actorId);
    if (!actor) {
      return res.status(403).json({ error: `Rejecting user ${actorId} was not found` });
    }
    if (actor.orgId !== request.orgId) {
      return res.status(403).json({ error: 'Rejecting user does not belong to this organization' });
    }

    const offer = await db.findById('offers', request.selectedOfferId);
    if (!offer) {
      return res.status(409).json({ error: 'Selected offer was not found for rejection policy validation' });
    }

    const policy = approvalEngine.canUserApprove(
      actor.role,
      actor.approvalLimitPaise,
      offer.totalPricePaise
    );
    if (!policy.allowed) {
      return res.status(403).json({ error: `Rejection denied: ${policy.reason}` });
    }

    const cancelled = await db.updateWhere(
      'procurementRequests',
      { id, state: 'PENDING_APPROVAL' },
      { state: 'CANCELLED', rejectionReason: reason }
    );
    if (!cancelled) {
      return res.status(409).json({ error: 'Procurement decision was already processed' });
    }
    
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

    const procurement = await db.findById('procurementRequests', order.procurementId);
    const correlationId = procurement?.correlationId || order.procurementId;
    const statusResult = await becknProvider.status(
      order.becknOrderId,
      correlationId,
      order.networkContext || null
    );
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
