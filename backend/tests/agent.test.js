process.env.NODE_ENV = 'test';
process.env.DEFAULT_NETWORK_PROVIDER = 'mock';
process.env.LLM_PROVIDER = 'mock';

const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { connectDB, disconnectDB } = require('../src/db/mongoConfig');
const llmProvider = require('../src/services/ai/llmProvider');
const comparisonEngine = require('../src/services/comparison/comparisonEngine');
const negotiationEngine = require('../src/services/negotiation/negotiationEngine');
const approvalEngine = require('../src/services/approval/approvalEngine');
const auditService = require('../src/services/audit/auditService');
const procurementAgent = require('../src/services/agent/procurementAgent');

before(async () => {
  await connectDB();
});

after(async () => {
  await disconnectDB();
});

test('1. Natural Language Intent Extraction Test', async () => {
  const prompt = 'Procure 50 laptops with at least 16GB RAM, i7 processor, delivery to Hyderabad within 7 days, budget below ₹5,00,000.';
  const intent = await llmProvider.extractIntent(prompt);

  assert.equal(intent.category, 'laptop');
  assert.equal(intent.quantity, 50);
  assert.equal(intent.location, 'Hyderabad');
  assert.equal(intent.budgetINR, 500000);
  assert.equal(intent.deliveryDeadlineDays, 7);
  assert.equal(intent.requirements.ram, '16GB');
  assert.ok(intent.requirements.processor.includes('I7'));
});

test('2. AI Offer Comparison Scoring Test', () => {
  const mockRequest = {
    budgetPaise: 50000000, // ₹5,00,000
    quantity: 50,
    deliveryDeadlineDays: 7,
    requirements: { processor: 'i7' }
  };

  const mockOffers = [
    {
      id: 'off_01',
      sellerName: 'Vendor A',
      sellerRating: 4.8,
      complianceScore: 100,
      itemTitle: 'Dell Laptop i7',
      totalPricePaise: 46000000, // ₹4,60,000
      deliveryDays: 5
    },
    {
      id: 'off_02',
      sellerName: 'Vendor B',
      sellerRating: 4.0,
      complianceScore: 85,
      itemTitle: 'HP Laptop i7',
      totalPricePaise: 43500000, // ₹4,35,000
      deliveryDays: 12 // Late!
    }
  ];

  const evaluated = comparisonEngine.evaluateOffers(mockRequest, mockOffers);
  assert.equal(evaluated.length, 2);
  assert.equal(evaluated[0].id, 'off_01'); // Vendor A should score higher due to faster delivery & higher rating
  assert.ok(evaluated[0].score > evaluated[1].score);
  assert.ok(evaluated[0].explanation.includes('Scored'));
});

test('3. Negotiation Counter-Offer Generation & Bounds Test', () => {
  const request = { quantity: 50 };
  const offer = {
    id: 'off_01',
    sellerId: 'seller_01',
    sellerName: 'TechSupply',
    unitPricePaise: 9100000,
    totalPricePaise: 455000000,
    minNegotiablePricePaise: 8700000,
    negotiable: true,
    quantity: 50
  };

  const counter = negotiationEngine.generateCounterOffer(request, offer, 5);
  assert.equal(counter.policyValidation.withinEnterpriseLimit, true);
  assert.equal(counter.policyValidation.aboveVendorFloor, true);
  assert.ok(counter.savingsPaise > 0);

  const response = negotiationEngine.evaluateSellerResponse(offer, counter);
  assert.equal(response.accepted, true);
});

test('4. Enterprise Approval Policy Threshold Test', () => {
  // Case A: < ₹50,000 -> Auto Approved
  const reqAuto = approvalEngine.evaluateRequiredApproval(4000000); // ₹40,000
  assert.equal(reqAuto.level, 'AUTO_APPROVED');
  assert.equal(reqAuto.requiresHumanApproval, false);

  // Case B: ₹50,000 - ₹5,00,000 -> Manager Approval
  const reqMgr = approvalEngine.evaluateRequiredApproval(45000000); // ₹4,50,000
  assert.equal(reqMgr.level, 'MANAGER_APPROVAL');
  assert.equal(reqMgr.requiresHumanApproval, true);

  // Case C: > ₹5,00,000 -> CFO / Board Approval
  const reqCfo = approvalEngine.evaluateRequiredApproval(600000000); // ₹60,00,000
  assert.equal(reqCfo.level, 'ENTERPRISE_BOARD_APPROVAL');
  assert.equal(reqCfo.requiresHumanApproval, true);
});

test('4b. Role-based approval enforcement prevents unauthorized sign-off', () => {
  const managerCheck = approvalEngine.canUserApprove('Procurement Manager', 1000000000, 600000000);
  const cfoCheck = approvalEngine.canUserApprove('Chief Financial Officer', 1000000000, 600000000);

  assert.equal(managerCheck.allowed, false);
  assert.match(managerCheck.reason, /CFO|Board|Enterprise/i);
  assert.equal(cfoCheck.allowed, true);
});

test('4c. Dedicated procurement audit route returns the full immutable trail', async () => {
  const app = require('../src/app');
  const http = require('node:http');
  const server = app.listen(0);

  const port = await new Promise((resolve) => {
    server.on('listening', () => resolve(server.address().port));
  });

  try {
    const procurementId = 'audit_route_test';
    const proc = {
      id: procurementId,
      correlationId: 'corr_route_test',
      userId: 'user_procurement_lead',
      orgId: 'org_acme_corp_001',
      rawPrompt: 'Audit route validation',
      state: 'PENDING_APPROVAL',
      createdAt: new Date().toISOString()
    };

    const db = require('../src/db/database');
    await db.insert('procurementRequests', proc);
    await auditService.logEvent({
      procurementId,
      correlationId: proc.correlationId,
      action: 'AUDIT_ROUTE_VALIDATION',
      actor: 'user_procurement_lead',
      previousState: 'RECEIVED',
      newState: 'PENDING_APPROVAL',
      metadata: { test: true }
    });

    const response = await fetch(`http://127.0.0.1:${port}/api/procurements/${procurementId}/audit`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.equal(body.procurementId, procurementId);
    assert.ok(Array.isArray(body.auditTrail));
    assert.ok(body.auditTrail.some(event => event.action === 'AUDIT_ROUTE_VALIDATION'));
  } finally {
    await new Promise((resolve, reject) => server.close(err => err ? reject(err) : resolve()));
  }
});

test('5. End-to-End Autonomous Agent Execution Loop', async () => {
  const prompt = 'Procure 10 laptops with 16GB RAM, delivery to Hyderabad in 5 days, budget ₹10,00,000.';
  const req = await procurementAgent.startProcurement(prompt);

  assert.ok(req.id);
  assert.ok(['PENDING_APPROVAL', 'APPROVED', 'TRACKING'].includes(req.state));

  const trail = await auditService.getProcurementAuditTrail(req.id);
  assert.ok(trail.length >= 4);
});


test('4d. Approval policy rejects ordinary roles even with oversized monetary limits', () => {
  const ordinaryUser = approvalEngine.canUserApprove(
    'Procurement Analyst',
    1000000000,
    45000000
  );
  assert.equal(ordinaryUser.allowed, false);
  assert.match(ordinaryUser.reason, /Manager|CFO/i);
});

test('4e. Unknown users cannot approve pending procurements', async () => {
  const db = require('../src/db/database');
  const procurementId = 'approval_unknown_user_test';
  const offerId = 'approval_unknown_offer';

  await db.insert('procurementRequests', {
    id: procurementId,
    correlationId: 'corr_unknown_approval',
    userId: 'user_procurement_lead',
    orgId: 'org_acme_corp_001',
    rawPrompt: 'Unknown approver validation',
    state: 'PENDING_APPROVAL',
    selectedOfferId: offerId
  });

  await db.insert('offers', {
    id: offerId,
    procurementId,
    sellerId: 'seller_test',
    sellerName: 'Test Seller',
    sellerRating: 4.5,
    complianceScore: 95,
    itemTitle: 'Test Laptop',
    unitPricePaise: 800000,
    quantity: 10,
    totalPricePaise: 8000000,
    deliveryDays: 5,
    negotiable: false,
    minNegotiablePricePaise: 800000
  });

  await assert.rejects(
    procurementAgent.grantHumanApproval(procurementId, 'missing_user'),
    /was not found/
  );

  const request = await db.findById('procurementRequests', procurementId);
  assert.equal(request.state, 'PENDING_APPROVAL');
});

test('4f. Audit records cannot be updated or deleted through the database adapter', async () => {
  const db = require('../src/db/database');
  const event = await auditService.logEvent({
    procurementId: 'audit_immutable_test',
    correlationId: 'corr_audit_immutable',
    action: 'IMMUTABILITY_VALIDATION',
    actor: 'SYSTEM_AGENT'
  });

  await assert.rejects(
    db.update('auditEvents', event.id, { action: 'MUTATED' }),
    /immutable/
  );
  await assert.rejects(
    db.delete('auditEvents', event.id),
    /immutable/
  );

  const stored = await db.findById('auditEvents', event.id);
  assert.equal(stored.action, 'IMMUTABILITY_VALIDATION');
});


test('6. Procurement creation API always returns a ProcurementRequest shape', async () => {
  const app = require('../src/app');
  const originalStart = procurementAgent.startProcurement;
  procurementAgent.startProcurement = async () => ({
    request: {
      id: 'proc_auto_shape',
      correlationId: 'corr_auto_shape',
      userId: 'user_procurement_lead',
      orgId: 'org_acme_corp_001',
      rawPrompt: 'auto approved test',
      state: 'TRACKING'
    },
    order: { id: 'ord_auto_shape' },
    offer: { id: 'off_auto_shape' }
  });

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));

  try {
    const response = await fetch(
      `http://127.0.0.1:${server.address().port}/api/procurements`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'auto approved test' })
      }
    );
    const body = await response.json();

    assert.equal(response.status, 201);
    assert.equal(body.id, 'proc_auto_shape');
    assert.equal(body.state, 'TRACKING');
    assert.equal(body.request, undefined);
  } finally {
    procurementAgent.startProcurement = originalStart;
    await new Promise((resolve, reject) =>
      server.close(err => err ? reject(err) : resolve())
    );
  }
});


test('1b. Fallback intent parser reads explicit numeric and scaled budgets correctly', () => {
  const numeric = llmProvider.extractIntentFallback(
    'Procure 10 laptops with 16GB RAM in Hyderabad within 5 days, budget ₹10,00,000.'
  );
  assert.equal(numeric.quantity, 10);
  assert.equal(numeric.budgetINR, 1000000);

  const scaled = llmProvider.extractIntentFallback(
    'Procure 15 servers in Bengaluru within 3 days with a budget of 18 lakh.'
  );
  assert.equal(scaled.quantity, 15);
  assert.equal(scaled.budgetINR, 1800000);
});

test('7. HTTP happy path reaches tracking with the required CFO approval', async () => {
  const app = require('../src/app');
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const createResponse = await fetch(`${baseUrl}/api/procurements`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: 'Procure 10 laptops with 16GB RAM, delivery to Hyderabad in 5 days, budget ₹10,00,000.'
      })
    });
    const created = await createResponse.json();

    assert.equal(createResponse.status, 201);
    assert.ok(created.id);
    assert.equal(created.state, 'PENDING_APPROVAL');
    assert.equal(created.approvalRequirement.level, 'ENTERPRISE_BOARD_APPROVAL');

    const approveResponse = await fetch(
      `${baseUrl}/api/procurements/${created.id}/approve`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          approverId: 'user_cfo',
          comments: 'CFO approved in integration test'
        })
      }
    );
    const approved = await approveResponse.json();

    assert.equal(approveResponse.status, 200);
    assert.equal(approved.request.state, 'TRACKING');
    assert.ok(approved.order.id);

    const detailResponse = await fetch(`${baseUrl}/api/procurements/${created.id}`);
    const detail = await detailResponse.json();
    assert.equal(detailResponse.status, 200);
    assert.equal(detail.request.state, 'TRACKING');
    assert.equal(detail.order.id, approved.order.id);
    assert.ok(detail.auditTrail.some(event => event.action === 'ORDER_CONFIRMED'));

    const statusResponse = await fetch(
      `${baseUrl}/api/orders/${approved.order.id}/status`
    );
    const status = await statusResponse.json();
    assert.equal(statusResponse.status, 200);
    assert.equal(status.becknTracking.becknOrderId, approved.order.becknOrderId);
  } finally {
    await new Promise((resolve, reject) =>
      server.close(err => err ? reject(err) : resolve())
    );
  }
});


test('8. High-value rejection enforces CFO policy', async () => {
  const db = require('../src/db/database');
  const app = require('../src/app');
  const procurementId = 'reject_cfo_policy_test';
  const offerId = 'reject_cfo_offer';

  await db.insert('procurementRequests', {
    id: procurementId,
    correlationId: 'corr_reject_cfo',
    userId: 'user_procurement_lead',
    orgId: 'org_acme_corp_001',
    rawPrompt: 'High value rejection test',
    state: 'PENDING_APPROVAL',
    selectedOfferId: offerId,
    approvalRequirement: {
      level: 'ENTERPRISE_BOARD_APPROVAL',
      requiresHumanApproval: true,
      requiredRole: 'Chief Financial Officer / Procurement Board'
    }
  });

  await db.insert('offers', {
    id: offerId,
    procurementId,
    sellerId: 'seller_reject_test',
    sellerName: 'Rejection Test Seller',
    sellerRating: 4.5,
    complianceScore: 95,
    itemTitle: 'Enterprise Server Batch',
    unitPricePaise: 600000000,
    quantity: 1,
    totalPricePaise: 600000000,
    deliveryDays: 5,
    negotiable: false,
    minNegotiablePricePaise: 600000000
  });

  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const baseUrl = `http://127.0.0.1:${server.address().port}`;

  try {
    const managerResponse = await fetch(
      `${baseUrl}/api/procurements/${procurementId}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: 'user_procurement_lead', reason: 'manager reject' })
      }
    );
    assert.equal(managerResponse.status, 403);

    const cfoResponse = await fetch(
      `${baseUrl}/api/procurements/${procurementId}/reject`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ actorId: 'user_cfo', reason: 'CFO rejected' })
      }
    );
    const body = await cfoResponse.json();
    assert.equal(cfoResponse.status, 200);
    assert.equal(body.state, 'CANCELLED');
  } finally {
    await new Promise((resolve, reject) =>
      server.close(err => err ? reject(err) : resolve())
    );
  }
});

test('9. Concurrent approval attempts create only one approval and one order', async () => {
  const db = require('../src/db/database');
  const procurementId = 'approval_race_test';
  const offerId = 'approval_race_offer';

  await db.insert('procurementRequests', {
    id: procurementId,
    correlationId: 'corr_approval_race',
    userId: 'user_procurement_lead',
    orgId: 'org_acme_corp_001',
    rawPrompt: 'Approval race validation',
    state: 'PENDING_APPROVAL',
    quantity: 1,
    location: 'Hyderabad',
    selectedOfferId: offerId
  });

  await db.insert('offers', {
    id: offerId,
    procurementId,
    sellerId: 'seller_race_test',
    sellerName: 'Race Test Seller',
    sellerRating: 4.5,
    complianceScore: 95,
    itemTitle: 'Business Laptop',
    unitPricePaise: 40000000,
    quantity: 1,
    totalPricePaise: 40000000,
    deliveryDays: 5,
    negotiable: false,
    minNegotiablePricePaise: 40000000
  });

  const results = await Promise.allSettled([
    procurementAgent.grantHumanApproval(procurementId, 'user_procurement_lead', 'first'),
    procurementAgent.grantHumanApproval(procurementId, 'user_procurement_lead', 'second')
  ]);

  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter(result => result.status === 'rejected').length, 1);

  const approvals = await db.find('approvals', { procurementId });
  const orders = await db.find('orders', { procurementId });
  assert.equal(approvals.length, 1);
  assert.equal(orders.length, 1);
});
