const test = require('node:test');
const assert = require('node:assert/strict');
const llmProvider = require('../src/services/ai/llmProvider');
const comparisonEngine = require('../src/services/comparison/comparisonEngine');
const negotiationEngine = require('../src/services/negotiation/negotiationEngine');
const approvalEngine = require('../src/services/approval/approvalEngine');
const auditService = require('../src/services/audit/auditService');
const procurementAgent = require('../src/services/agent/procurementAgent');

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

test('5. End-to-End Autonomous Agent Execution Loop', async () => {
  const prompt = 'Procure 10 laptops with 16GB RAM, delivery to Hyderabad in 5 days, budget ₹10,00,000.';
  const req = await procurementAgent.startProcurement(prompt);

  assert.ok(req.id);
  assert.ok(['PENDING_APPROVAL', 'APPROVED', 'TRACKING'].includes(req.state));

  const trail = await auditService.getProcurementAuditTrail(req.id);
  assert.ok(trail.length >= 4);
});
