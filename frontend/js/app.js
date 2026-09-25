let activeProcurementId = null;

const STATE_STEPS = [
  'RECEIVED',
  'PARSED',
  'VALIDATED',
  'SEARCHING',
  'OFFERS_RECEIVED',
  'COMPARING',
  'NEGOTIATING',
  'PENDING_APPROVAL',
  'APPROVED',
  'ORDERING',
  'TRACKING'
];

document.addEventListener('DOMContentLoaded', () => {
  loadProcurements();

  document.getElementById('procurementForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const prompt = document.getElementById('promptInput').value.trim();
    if (!prompt) return;

    const submitBtn = document.getElementById('submitBtn');
    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span>⏳ Agent Running...</span>';

    try {
      const res = await fetch('/api/procurements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt })
      });

      if (!res.ok) throw new Error(`Server returned HTTP ${res.status}`);

      const data = await res.json();
      activeProcurementId = data.id || data.request?.id;

      document.getElementById('promptInput').value = '';
      await loadProcurements();
      await loadProcurementDetail(activeProcurementId);
    } catch (err) {
      alert(`Error launching agent: ${err.message}`);
    } finally {
      submitBtn.disabled = false;
      submitBtn.innerHTML = '<span>🚀 Launch Agent Workflow</span>';
    }
  });
});

function fillSample(index) {
  const promptInput = document.getElementById('promptInput');
  if (index === 1) {
    promptInput.value = 'Procure 50 laptops with at least 16GB RAM, i7 processor, delivery to Hyderabad within 7 days, budget below ₹5,00,000.';
  } else if (index === 2) {
    promptInput.value = 'Procure 15 Rack Servers with 128GB RAM, Xeon Gold processor, express delivery to Bengaluru within 3 days, total budget ₹18,00,000.';
  } else if (index === 3) {
    promptInput.value = 'Procure 100 27-inch 4K Monitors, IPS panel, USB-C hub, delivery to Delhi NCR within 10 days, budget ₹25,00,000.';
  }
}

async function loadProcurements() {
  try {
    const res = await fetch('/api/procurements');
    const list = await res.json();

    const listEl = document.getElementById('requestList');
    if (!list || list.length === 0) {
      listEl.innerHTML = '<p class="text-muted" style="font-size:12px;">No past procurements yet.</p>';
      return;
    }

    listEl.innerHTML = list.map(req => `
      <div class="request-item ${req.id === activeProcurementId ? 'active' : ''}" onclick="selectProcurement('${req.id}')">
        <div class="req-item-top">
          <span class="req-item-id">${req.id}</span>
          <span class="req-item-state">${req.state}</span>
        </div>
        <div class="req-item-prompt">${escapeHtml(req.rawPrompt)}</div>
      </div>
    `).join('');
  } catch (err) {
    console.error('Failed to load procurements:', err);
  }
}

async function selectProcurement(id) {
  activeProcurementId = id;
  await loadProcurements();
  await loadProcurementDetail(id);
}

async function loadProcurementDetail(id) {
  try {
    const res = await fetch(`/api/procurements/${id}`);
    if (!res.ok) return;

    const data = await res.json();
    renderWorkspace(data);
  } catch (err) {
    console.error('Failed to load detail:', err);
  }
}

function renderWorkspace(data) {
  const { request, offers, negotiations, approvals, order, auditTrail } = data;

  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('activeWorkspace').classList.remove('hidden');

  // Request Header
  document.getElementById('reqId').innerText = request.id;
  document.getElementById('reqCategoryTitle').innerText = `${request.intent?.category ? request.intent.category.toUpperCase() : 'Procurement'} Batch (${request.quantity || 0} Units)`;
  document.getElementById('reqRawPrompt').innerText = `"${request.rawPrompt}"`;
  document.getElementById('reqStateBadge').innerText = request.state;
  document.getElementById('reqCorrelationId').innerText = request.correlationId || 'N/A';

  // Stepper Nodes
  renderStepper(request.state);

  // Intent Details
  const intent = request.intent || {};
  document.getElementById('intentDetails').innerHTML = `
    <div class="intent-box"><div class="intent-label">Category</div><div class="intent-value">${intent.category || 'N/A'}</div></div>
    <div class="intent-box"><div class="intent-label">Quantity</div><div class="intent-value">${request.quantity || 0} Units</div></div>
    <div class="intent-box"><div class="intent-label">Target Budget</div><div class="intent-value">₹${((request.budgetPaise || 0) / 100).toLocaleString('en-IN')}</div></div>
    <div class="intent-box"><div class="intent-label">Delivery Location</div><div class="intent-value">${request.location || 'N/A'}</div></div>
    <div class="intent-box"><div class="intent-label">Max Deadline</div><div class="intent-value">${request.deliveryDeadlineDays || 0} Days</div></div>
    <div class="intent-box"><div class="intent-label">Key Spec</div><div class="intent-value">${intent.requirements?.ram || '16GB'}, ${intent.requirements?.processor || 'i7'}</div></div>
  `;

  // Offers Matrix
  document.getElementById('offerCountPill').innerText = `${offers ? offers.length : 0} Offers`;
  if (offers && offers.length > 0) {
    document.getElementById('offersContainer').innerHTML = offers.map(o => {
      const isTop = o.id === request.selectedOfferId;
      const b = o.scoreBreakdown || { priceScore: 80, deliveryScore: 80, ratingScore: 80, complianceScore: 80, specsScore: 80 };
      return `
        <div class="offer-card ${isTop ? 'top-offer' : ''}">
          ${isTop ? '<span class="top-badge">👑 AI TOP MATCH</span>' : ''}
          <div class="offer-header">
            <div>
              <div class="offer-seller">${escapeHtml(o.sellerName)}</div>
              <div class="offer-title">${escapeHtml(o.itemTitle)}</div>
            </div>
            <div class="offer-score-badge">${o.score}/100</div>
          </div>
          <div class="offer-metrics">
            <div class="metric-item"><span class="metric-label">Total Price</span><span class="metric-val price">₹${(o.totalPricePaise / 100).toLocaleString('en-IN')}</span></div>
            <div class="metric-item"><span class="metric-label">Delivery Speed</span><span class="metric-val">${o.deliveryDays} Days</span></div>
            <div class="metric-item"><span class="metric-label">Seller Rating</span><span class="metric-val">⭐ ${o.sellerRating}/5</span></div>
            <div class="metric-item"><span class="metric-label">Compliance</span><span class="metric-val">${o.complianceScore}%</span></div>
          </div>
          <div class="score-bars">
            <div class="bar-group"><span class="bar-label">Price (${b.priceScore}%)</span><div class="bar-track"><div class="bar-fill" style="width:${b.priceScore}%"></div></div></div>
            <div class="bar-group"><span class="bar-label">Delivery (${b.deliveryScore}%)</span><div class="bar-track"><div class="bar-fill" style="width:${b.deliveryScore}%"></div></div></div>
            <div class="bar-group"><span class="bar-label">Rating (${b.ratingScore}%)</span><div class="bar-track"><div class="bar-fill" style="width:${b.ratingScore}%"></div></div></div>
            <div class="bar-group"><span class="bar-label">Compliance (${b.complianceScore}%)</span><div class="bar-track"><div class="bar-fill" style="width:${b.complianceScore}%"></div></div></div>
            <div class="bar-group"><span class="bar-label">Specs (${b.specsScore}%)</span><div class="bar-track"><div class="bar-fill" style="width:${b.specsScore}%"></div></div></div>
          </div>
          <div class="explanation-text">${escapeHtml(o.explanation || '')}</div>
        </div>
      `;
    }).join('');
  } else {
    document.getElementById('offersContainer').innerHTML = '<p class="text-muted">No seller offers discovered yet.</p>';
  }

  // AI Reasoning
  document.getElementById('reasoningText').innerText = request.aiRecommendationReasoning || 'AI agent is compiling scoring matrices and reasoning...';

  // Human Approval Card
  const approvalCard = document.getElementById('approvalContent');
  if (request.state === 'PENDING_APPROVAL') {
    approvalCard.innerHTML = `
      <div style="color:var(--accent-amber); font-weight:600; font-size:13px; margin-bottom:8px;">
        ⚠️ Approval Required: ${escapeHtml(request.approvalRequirement?.level || 'MANAGER_APPROVAL')}
      </div>
      <p style="font-size:12px; color:var(--text-muted);">${escapeHtml(request.approvalRequirement?.description || '')}</p>
      <div class="approval-btn-group">
        <button class="btn-approve" onclick="approveProcurement('${request.id}')">Grant Approval</button>
        <button class="btn-reject" onclick="rejectProcurement('${request.id}')">Reject Order</button>
      </div>
    `;
  } else if (request.state === 'APPROVED' || request.state === 'ORDERING' || request.state === 'TRACKING') {
    approvalCard.innerHTML = `
      <div style="color:var(--accent-emerald); font-weight:600; font-size:13px;">
        ✅ Order Approved & Execution Authorized
      </div>
      <p style="font-size:12px; color:var(--text-muted); margin-top:4px;">Action logged in immutable audit register.</p>
    `;
  } else {
    approvalCard.innerHTML = `<p class="text-muted">Approval check in progress...</p>`;
  }

  // Negotiation Card
  const negContent = document.getElementById('negotiationContent');
  if (negotiations && negotiations.length > 0) {
    const lastNeg = negotiations[negotiations.length - 1];
    negContent.innerHTML = `
      <div style="font-size:12px; margin-bottom:6px;"><strong>Status:</strong> <span style="color:var(--accent-cyan);">${lastNeg.status}</span></div>
      <div style="font-size:12px; color:var(--accent-emerald);"><strong>Savings:</strong> ₹${(lastNeg.counterOffer?.savingsINR || 0).toLocaleString('en-IN')}</div>
      <div style="font-size:11px; color:var(--text-muted); margin-top:6px; font-style:italic;">"${escapeHtml(lastNeg.response?.sellerMessage || '')}"</div>
    `;
  } else {
    negContent.innerHTML = `<p class="text-muted">No negotiation required.</p>`;
  }

  // Order & Tracking Card
  const orderContent = document.getElementById('orderContent');
  if (order) {
    orderContent.innerHTML = `
      <div style="font-size:13px; font-weight:700; color:var(--accent-emerald); margin-bottom:4px;">Beckn ID: ${order.becknOrderId}</div>
      <div style="font-size:12px; color:var(--text-main);">Seller: ${escapeHtml(order.sellerName)}</div>
      <div style="font-size:12px; color:var(--text-muted);">Fulfillment: ${order.fulfillmentStatus}</div>
      <div style="font-size:11px; margin-top:8px;"><a href="${order.trackingUrl}" target="_blank" style="color:var(--accent-blue); text-decoration:none;">🔗 Live Tracking Link</a></div>
    `;
  } else {
    orderContent.innerHTML = `<p class="text-muted">Order placement pending approval.</p>`;
  }

  // Audit Timeline
  if (auditTrail && auditTrail.length > 0) {
    document.getElementById('auditTimeline').innerHTML = auditTrail.map(a => `
      <div class="audit-item">
        <div>
          <div class="audit-time">${new Date(a.timestamp).toLocaleTimeString()}</div>
          <div class="audit-action">${a.action}</div>
        </div>
      </div>
    `).join('');
  } else {
    document.getElementById('auditTimeline').innerHTML = '<p class="text-muted">No audit logs recorded.</p>';
  }

  // Beckn Payload Inspector
  const topOffer = offers && offers[0];
  document.getElementById('becknPayloadInspector').innerText = JSON.stringify(topOffer?.becknContext || {
    domain: 'nic2004:52110',
    country: 'IND',
    action: 'search',
    transaction_id: request.correlationId,
    bap_id: 'procure-ai-bap.domain.org'
  }, null, 2);
}

function renderStepper(currentState) {
  const currentIndex = STATE_STEPS.indexOf(currentState);
  const stepperEl = document.getElementById('agentStepper');

  stepperEl.innerHTML = STATE_STEPS.map((step, idx) => {
    let statusClass = '';
    if (idx < currentIndex) statusClass = 'completed';
    else if (idx === currentIndex) statusClass = 'active';

    return `
      <div class="step-node ${statusClass}">
        <div class="step-circle">${idx + 1}</div>
        <div class="step-label">${step.replace('_', ' ')}</div>
        ${idx < STATE_STEPS.length - 1 ? '<div class="step-line"></div>' : ''}
      </div>
    `;
  }).join('');
}

async function approveProcurement(id) {
  try {
    const res = await fetch(`/api/procurements/${id}/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ approverId: 'user_procurement_lead', comments: 'Approved via Enterprise UI Dashboard' })
    });

    if (!res.ok) throw new Error('Failed to approve');

    await loadProcurementDetail(id);
    await loadProcurements();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

async function rejectProcurement(id) {
  try {
    const res = await fetch(`/api/procurements/${id}/reject`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: 'Rejected by Procurement Lead' })
    });

    if (!res.ok) throw new Error('Failed to reject');

    await loadProcurementDetail(id);
    await loadProcurements();
  } catch (err) {
    alert(`Error: ${err.message}`);
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
