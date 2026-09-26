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

/**
 * GET /api/analytics/dashboard
 * Get procurement analytics and insights
 */
router.get('/analytics/dashboard', async (req, res) => {
  try {
    const requests = await db.find('procurementRequests', {});
    const orders = await db.find('orders', {});
    const offers = await db.find('offers', {});

    // Calculate metrics
    const totalRequests = requests.length;
    const completedOrders = orders.filter(o => o.status === 'CONFIRMED').length;
    const pendingApprovals = requests.filter(r => r.state === 'AWAITING_APPROVAL').length;
    const activeNegotiations = requests.filter(r => r.state === 'NEGOTIATING').length;

    // Calculate total spend and savings
    const totalSpend = orders.reduce((sum, order) => sum + (order.totalAmountPaise || 0), 0) / 100;
    const avgProcessingTime = requests
      .filter(r => r.completedAt)
      .reduce((sum, r) => sum + (new Date(r.completedAt) - new Date(r.createdAt)), 0) / requests.length / 1000 / 60; // in minutes

    // Category breakdown
    const categoryBreakdown = requests.reduce((acc, req) => {
      const cat = req.intent?.category || 'Unknown';
      acc[cat] = (acc[cat] || 0) + 1;
      return acc;
    }, {});

    // State distribution
    const stateDistribution = requests.reduce((acc, req) => {
      acc[req.state] = (acc[req.state] || 0) + 1;
      return acc;
    }, {});

    // Vendor performance
    const vendorStats = offers.reduce((acc, offer) => {
      const vendor = offer.sellerName || 'Unknown';
      if (!acc[vendor]) {
        acc[vendor] = { totalOffers: 0, avgPrice: 0, totalPrice: 0 };
      }
      acc[vendor].totalOffers += 1;
      acc[vendor].totalPrice += offer.totalPricePaise || 0;
      return acc;
    }, {});

    Object.keys(vendorStats).forEach(vendor => {
      vendorStats[vendor].avgPrice = vendorStats[vendor].totalPrice / vendorStats[vendor].totalOffers / 100;
    });

    // Calculate estimated savings (compare best offer vs average)
    let totalSavings = 0;
    const procurementsWithOffers = requests.filter(r => {
      const reqOffers = offers.filter(o => o.procurementId === r.id);
      return reqOffers.length > 1;
    });

    procurementsWithOffers.forEach(req => {
      const reqOffers = offers.filter(o => o.procurementId === req.id);
      const prices = reqOffers.map(o => o.totalPricePaise);
      const bestPrice = Math.min(...prices);
      const avgPrice = prices.reduce((a, b) => a + b, 0) / prices.length;
      totalSavings += (avgPrice - bestPrice);
    });

    return res.json({
      summary: {
        totalRequests,
        completedOrders,
        pendingApprovals,
        activeNegotiations,
        totalSpendINR: totalSpend,
        estimatedSavingsINR: totalSavings / 100,
        avgProcessingTimeMinutes: Math.round(avgProcessingTime) || 0,
        successRate: totalRequests > 0 ? Math.round((completedOrders / totalRequests) * 100) : 0
      },
      categoryBreakdown,
      stateDistribution,
      vendorPerformance: Object.entries(vendorStats).map(([name, stats]) => ({
        vendor: name,
        ...stats
      })),
      recentActivity: requests.slice(-10).reverse()
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/procurements/bulk
 * Bulk import procurement requests from CSV data
 */
router.post('/procurements/bulk', async (req, res) => {
  try {
    const { procurements } = req.body;
    if (!Array.isArray(procurements) || procurements.length === 0) {
      return res.status(400).json({ error: 'procurements array is required' });
    }

    const results = [];
    const errors = [];

    for (let i = 0; i < procurements.length; i++) {
      const item = procurements[i];
      try {
        if (!item.prompt) {
          errors.push({ row: i + 1, error: 'Missing prompt' });
          continue;
        }
        const result = await procurementAgent.startProcurement(
          item.prompt,
          item.userId || 'bulk_import_user',
          item.orgId || 'org_acme_corp_001'
        );
        results.push({ row: i + 1, id: result.id, status: 'success' });
      } catch (err) {
        errors.push({ row: i + 1, error: err.message });
      }
    }

    return res.status(201).json({
      message: `Bulk import completed: ${results.length} succeeded, ${errors.length} failed`,
      results,
      errors
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/templates
 * Get quick procurement templates
 */
router.get('/templates', async (req, res) => {
  try {
    const templates = [
      {
        id: 'laptop_bulk',
        name: 'Laptop Bulk Order',
        category: 'Electronics',
        icon: '💻',
        template: 'Order {quantity} laptops with {ram}GB RAM, {storage}GB SSD, Intel i{processor} processor'
      },
      {
        id: 'office_supplies',
        name: 'Office Supplies',
        category: 'Supplies',
        icon: '📝',
        template: 'Purchase {quantity} units of {item_name} for office use'
      },
      {
        id: 'furniture',
        name: 'Office Furniture',
        category: 'Furniture',
        icon: '🪑',
        template: 'Order {quantity} {furniture_type} with {specifications}'
      },
      {
        id: 'mobile_devices',
        name: 'Mobile Devices',
        category: 'Electronics',
        icon: '📱',
        template: 'Procure {quantity} mobile phones, {brand} {model}, {storage}GB storage'
      },
      {
        id: 'networking',
        name: 'Network Equipment',
        category: 'IT Infrastructure',
        icon: '🌐',
        template: 'Get {quantity} {equipment_type} with {specifications}'
      }
    ];
    return res.json(templates);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/export/report
 * Export procurement report
 */
router.get('/export/report', async (req, res) => {
  try {
    const { format = 'json', startDate, endDate } = req.query;
    
    let requests = await db.find('procurementRequests', {});
    
    // Filter by date if provided
    if (startDate) {
      requests = requests.filter(r => new Date(r.createdAt) >= new Date(startDate));
    }
    if (endDate) {
      requests = requests.filter(r => new Date(r.createdAt) <= new Date(endDate));
    }

    const orders = await db.find('orders', {});
    
    const report = {
      generatedAt: new Date().toISOString(),
      period: { startDate, endDate },
      summary: {
        totalRequests: requests.length,
        completedOrders: orders.filter(o => o.status === 'CONFIRMED').length,
        totalSpend: orders.reduce((sum, o) => sum + (o.totalAmountPaise || 0), 0) / 100
      },
      requests: requests.map(r => ({
        id: r.id,
        prompt: r.rawPrompt,
        state: r.state,
        category: r.intent?.category,
        quantity: r.quantity,
        createdAt: r.createdAt,
        completedAt: r.completedAt
      })),
      orders: orders.map(o => ({
        id: o.id,
        procurementId: o.procurementId,
        vendor: o.sellerName,
        amount: o.totalAmountPaise / 100,
        status: o.status,
        createdAt: o.createdAt
      }))
    };

    if (format === 'csv') {
      // Convert to CSV
      let csv = 'ID,Prompt,State,Category,Quantity,Created At,Completed At\n';
      report.requests.forEach(r => {
        csv += `${r.id},"${r.prompt}",${r.state},${r.category || 'N/A'},${r.quantity || 'N/A'},${r.createdAt},${r.completedAt || 'N/A'}\n`;
      });
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=procurement_report.csv');
      return res.send(csv);
    }

    return res.json(report);
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
