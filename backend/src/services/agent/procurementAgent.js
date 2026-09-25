const db = require('../../db/database');
const llmProvider = require('../ai/llmProvider');
const becknProvider = require('../beckn/becknProvider');
const comparisonEngine = require('../comparison/comparisonEngine');
const negotiationEngine = require('../negotiation/negotiationEngine');
const approvalEngine = require('../approval/approvalEngine');
const auditService = require('../audit/auditService');
const memoryService = require('../memory/memoryService');
const { v4: uuidv4 } = require('uuid');

class ProcurementAgent {
  /**
   * Main Entry Point: Creates a new procurement request and executes the autonomous state machine
   */
  async startProcurement(naturalLanguagePrompt, userId = 'user_procurement_lead', orgId = 'org_acme_corp_001') {
    const procurementId = `proc_${uuidv4().substring(0, 8)}`;
    const correlationId = `corr_${uuidv4().substring(0, 12)}`;

    const initialRequest = {
      id: procurementId,
      correlationId,
      userId,
      orgId,
      rawPrompt: naturalLanguagePrompt,
      state: 'RECEIVED',
      createdAt: new Date().toISOString()
    };

    db.insert('procurementRequests', initialRequest);

    auditService.logEvent({
      procurementId,
      correlationId,
      action: 'PROCUREMENT_CREATED',
      actor: userId,
      newState: 'RECEIVED',
      metadata: { rawPrompt: naturalLanguagePrompt }
    });

    // Run execution pipeline
    return await this.runAgentLoop(procurementId);
  }

  /**
   * Stateful Agent Loop Step Processor
   */
  async runAgentLoop(procurementId) {
    let request = db.findById('procurementRequests', procurementId);
    if (!request) throw new Error(`Procurement ${procurementId} not found`);

    const correlationId = request.correlationId;

    try {
      // STATE 1: RECEIVED -> PARSED
      if (request.state === 'RECEIVED') {
        const intent = await llmProvider.extractIntent(request.rawPrompt);
        
        request = db.update('procurementRequests', procurementId, {
          intent,
          quantity: intent.quantity,
          location: intent.location,
          budgetPaise: intent.budgetINR * 100,
          deliveryDeadlineDays: intent.deliveryDeadlineDays,
          state: 'PARSED'
        });

        auditService.logEvent({
          procurementId,
          correlationId,
          action: 'INTENT_PARSED',
          previousState: 'RECEIVED',
          newState: 'PARSED',
          metadata: { intent }
        });
      }

      // STATE 2: PARSED -> VALIDATED
      if (request.state === 'PARSED') {
        const isValid = request.intent && request.quantity > 0 && request.budgetPaise > 0;
        if (!isValid) {
          db.update('procurementRequests', procurementId, { state: 'FAILED' });
          auditService.logEvent({
            procurementId,
            correlationId,
            action: 'VALIDATION_FAILED',
            previousState: 'PARSED',
            newState: 'FAILED'
          });
          return db.findById('procurementRequests', procurementId);
        }

        request = db.update('procurementRequests', procurementId, { state: 'VALIDATED' });
        auditService.logEvent({
          procurementId,
          correlationId,
          action: 'REQUIREMENTS_VALIDATED',
          previousState: 'PARSED',
          newState: 'VALIDATED'
        });
      }

      // STATE 3: VALIDATED -> SEARCHING -> OFFERS_RECEIVED
      if (request.state === 'VALIDATED') {
        request = db.update('procurementRequests', procurementId, { state: 'SEARCHING' });
        
        auditService.logEvent({
          procurementId,
          correlationId,
          action: 'SEARCH_STARTED',
          previousState: 'VALIDATED',
          newState: 'SEARCHING',
          metadata: { provider: 'Beckn / ONDC Network' }
        });

        const networkResult = await becknProvider.search(request.intent, correlationId);
        
        // Save raw offers into database
        const savedOffers = networkResult.offers.map(o => {
          return db.insert('offers', {
            ...o,
            procurementId
          });
        });

        request = db.update('procurementRequests', procurementId, {
          state: 'OFFERS_RECEIVED',
          offerCount: savedOffers.length
        });

        auditService.logEvent({
          procurementId,
          correlationId,
          action: 'SEARCH_COMPLETED',
          previousState: 'SEARCHING',
          newState: 'OFFERS_RECEIVED',
          metadata: { count: savedOffers.length }
        });
      }

      // STATE 4: OFFERS_RECEIVED -> COMPARING
      if (request.state === 'OFFERS_RECEIVED') {
        request = db.update('procurementRequests', procurementId, { state: 'COMPARING' });
        
        const offers = db.find('offers', o => o.procurementId === procurementId);
        
        // AI Evaluation & Scoring
        let scoredOffers = comparisonEngine.evaluateOffers(request, offers);
        
        // Memory Enhancement
        scoredOffers = memoryService.applyHistoricalInsights(request.intent?.category, scoredOffers);

        // Update offers with scores
        scoredOffers.forEach(so => {
          db.update('offers', so.id, so);
        });

        const selectedBestOffer = scoredOffers[0];
        const aiReasoning = await llmProvider.analyzeOffersAndReason(request, scoredOffers);

        request = db.update('procurementRequests', procurementId, {
          selectedOfferId: selectedBestOffer.id,
          aiRecommendationReasoning: aiReasoning
        });

        auditService.logEvent({
          procurementId,
          correlationId,
          action: 'OFFERS_COMPARED',
          previousState: 'OFFERS_RECEIVED',
          newState: 'COMPARING',
          metadata: {
            topOfferId: selectedBestOffer.id,
            topSeller: selectedBestOffer.sellerName,
            topScore: selectedBestOffer.score
          }
        });
      }

      // STATE 5: COMPARING -> NEGOTIATING or PENDING_APPROVAL
      if (request.state === 'COMPARING') {
        const bestOffer = db.findById('offers', request.selectedOfferId);
        const negCheck = negotiationEngine.shouldNegotiate(request, bestOffer);

        if (negCheck.eligible) {
          request = db.update('procurementRequests', procurementId, { state: 'NEGOTIATING' });

          auditService.logEvent({
            procurementId,
            correlationId,
            action: 'NEGOTIATION_STARTED',
            previousState: 'COMPARING',
            newState: 'NEGOTIATING',
            metadata: { reason: negCheck.reason }
          });

          // Perform counter offer negotiation
          const counter = negotiationEngine.generateCounterOffer(request, bestOffer, negCheck.targetDiscountPercent);
          const sellerResponse = negotiationEngine.evaluateSellerResponse(bestOffer, counter);

          // Save negotiation log
          const negRecord = db.insert('negotiations', {
            id: `neg_${uuidv4().substring(0, 8)}`,
            procurementId,
            offerId: bestOffer.id,
            counterOffer: counter,
            response: sellerResponse,
            status: sellerResponse.accepted ? 'SUCCESSFUL' : 'PARTIAL'
          });

          // Update offer if price reduced
          if (sellerResponse.finalTotalPricePaise < bestOffer.totalPricePaise) {
            db.update('offers', bestOffer.id, {
              totalPricePaise: sellerResponse.finalTotalPricePaise,
              unitPricePaise: sellerResponse.finalUnitPricePaise,
              negotiated: true,
              savingsPaise: bestOffer.totalPricePaise - sellerResponse.finalTotalPricePaise
            });
          }

          auditService.logEvent({
            procurementId,
            correlationId,
            action: 'NEGOTIATION_COMPLETED',
            previousState: 'NEGOTIATING',
            newState: 'NEGOTIATION_FINISHED',
            metadata: {
              accepted: sellerResponse.accepted,
              savingsINR: (bestOffer.totalPricePaise - sellerResponse.finalTotalPricePaise) / 100
            }
          });
        }

        // Evaluate Approval policy requirement
        const updatedBestOffer = db.findById('offers', request.selectedOfferId);
        const approvalReq = approvalEngine.evaluateRequiredApproval(updatedBestOffer.totalPricePaise);

        if (approvalReq.requiresHumanApproval) {
          request = db.update('procurementRequests', procurementId, {
            state: 'PENDING_APPROVAL',
            approvalRequirement: approvalReq
          });

          auditService.logEvent({
            procurementId,
            correlationId,
            action: 'APPROVAL_REQUESTED',
            previousState: 'COMPARING',
            newState: 'PENDING_APPROVAL',
            metadata: { requiredRole: approvalReq.requiredRole, level: approvalReq.level }
          });
        } else {
          // Auto Approved!
          request = db.update('procurementRequests', procurementId, {
            state: 'APPROVED',
            approvalRequirement: approvalReq
          });

          db.insert('approvals', {
            id: `app_${uuidv4().substring(0, 8)}`,
            procurementId,
            approverId: 'SYSTEM_AUTO_POLICY',
            status: 'APPROVED',
            comments: approvalReq.description
          });

          auditService.logEvent({
            procurementId,
            correlationId,
            action: 'APPROVAL_GRANTED',
            previousState: 'COMPARING',
            newState: 'APPROVED',
            metadata: { type: 'AUTO_APPROVED' }
          });

          // Continue directly to ordering
          return await this.executeOrder(procurementId);
        }
      }

      return db.findById('procurementRequests', procurementId);
    } catch (err) {
      console.error(`[ProcurementAgent Error] ${err.message}`, err);
      db.update('procurementRequests', procurementId, { state: 'FAILED', failureReason: err.message });
      auditService.logEvent({
        procurementId,
        correlationId,
        action: 'AGENT_ERROR',
        newState: 'FAILED',
        metadata: { error: err.message }
      });
      return db.findById('procurementRequests', procurementId);
    }
  }

  /**
   * Human Approval Handler
   */
  async grantHumanApproval(procurementId, approverId, comments = 'Approved after managerial review') {
    const request = db.findById('procurementRequests', procurementId);
    if (!request || request.state !== 'PENDING_APPROVAL') {
      throw new Error(`Procurement ${procurementId} is not in PENDING_APPROVAL state`);
    }

    const user = db.findById('users', approverId) || { id: approverId, role: 'Procurement Manager', approvalLimitPaise: 50000000 };
    const offer = db.findById('offers', request.selectedOfferId);

    const validation = approvalEngine.canUserApprove(user.role, user.approvalLimitPaise, offer.totalPricePaise);
    if (!validation.allowed) {
      throw new Error(`Approval rejected: ${validation.reason}`);
    }

    db.insert('approvals', {
      id: `app_${uuidv4().substring(0, 8)}`,
      procurementId,
      approverId,
      status: 'APPROVED',
      comments
    });

    db.update('procurementRequests', procurementId, { state: 'APPROVED' });

    auditService.logEvent({
      procurementId,
      correlationId: request.correlationId,
      action: 'APPROVAL_GRANTED',
      actor: approverId,
      previousState: 'PENDING_APPROVAL',
      newState: 'APPROVED',
      metadata: { comments, userRole: user.role }
    });

    // Execute order placement
    return await this.executeOrder(procurementId);
  }

  /**
   * Order Execution Step: ORDERING -> ORDER_CONFIRMED -> TRACKING
   */
  async executeOrder(procurementId) {
    let request = db.findById('procurementRequests', procurementId);
    if (request.state !== 'APPROVED') {
      throw new Error(`Cannot place order for procurement in state ${request.state}`);
    }

    const correlationId = request.correlationId;
    const selectedOffer = db.findById('offers', request.selectedOfferId);

    // STATE: ORDERING
    request = db.update('procurementRequests', procurementId, { state: 'ORDERING' });

    auditService.logEvent({
      procurementId,
      correlationId,
      action: 'ORDER_INITIATED',
      previousState: 'APPROVED',
      newState: 'ORDERING',
      metadata: { sellerId: selectedOffer.sellerId, totalAmountINR: selectedOffer.totalPricePaise / 100 }
    });

    // Beckn Protocol /select, /init, /confirm sequence
    await becknProvider.select(selectedOffer, correlationId);
    await becknProvider.init(selectedOffer, { orgName: 'Acme Enterprise', location: request.location }, correlationId);
    const confirmResult = await becknProvider.confirm(selectedOffer, correlationId);

    // Save Order Entity
    const orderRecord = db.insert('orders', {
      id: `ord_${uuidv4().substring(0, 8)}`,
      procurementId,
      becknOrderId: confirmResult.becknOrderId,
      sellerId: selectedOffer.sellerId,
      sellerName: selectedOffer.sellerName,
      totalPricePaise: selectedOffer.totalPricePaise,
      totalPriceINR: selectedOffer.totalPricePaise / 100,
      quantity: request.quantity,
      status: 'CONFIRMED',
      fulfillmentStatus: confirmResult.order.fulfillmentStatus,
      trackingUrl: confirmResult.order.trackingUrl,
      estimatedDeliveryDate: confirmResult.order.estimatedDeliveryDate
    });

    // STATE: ORDER_CONFIRMED -> TRACKING
    request = db.update('procurementRequests', procurementId, {
      state: 'TRACKING',
      orderId: orderRecord.id,
      becknOrderId: confirmResult.becknOrderId
    });

    auditService.logEvent({
      procurementId,
      correlationId,
      action: 'ORDER_CONFIRMED',
      previousState: 'ORDERING',
      newState: 'TRACKING',
      metadata: { becknOrderId: confirmResult.becknOrderId, trackingUrl: orderRecord.trackingUrl }
    });

    // Record agent memory learning
    memoryService.recordProcurementPattern(request, selectedOffer);

    return {
      request: db.findById('procurementRequests', procurementId),
      order: orderRecord,
      offer: selectedOffer
    };
  }
}

module.exports = new ProcurementAgent();
