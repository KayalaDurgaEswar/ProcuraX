const db = require('../../db/database');
const llmProvider = require('../ai/llmProvider');
const becknProvider = require('../beckn/becknProvider');
const comparisonEngine = require('../comparison/comparisonEngine');
const negotiationEngine = require('../negotiation/negotiationEngine');
const approvalEngine = require('../approval/approvalEngine');
const auditService = require('../audit/auditService');
const memoryService = require('../memory/memoryService');
const config = require('../../config');
const { v4: uuidv4 } = require('uuid');

class ProcurementAgent {
  /**
   * Main Entry Point: Creates a new procurement request and executes the autonomous state machine in MongoDB
   */
  async startProcurement(
    naturalLanguagePrompt,
    userId = config.security.defaultUserId,
    orgId = config.security.defaultOrgId
  ) {
    const organization = await db.findById('organizations', orgId);
    if (!organization) {
      throw new Error(`Organization ${orgId} was not found`);
    }

    const user = await db.findById('users', userId);
    if (!user) {
      throw new Error(`User ${userId} was not found`);
    }
    if (user.orgId !== orgId) {
      throw new Error('User does not belong to the requested organization');
    }

    const procurementId = `proc_${uuidv4().substring(0, 8)}`;
    const correlationId = `corr_${uuidv4().substring(0, 12)}`;

    const initialRequest = {
      id: procurementId,
      correlationId,
      userId,
      orgId,
      rawPrompt: naturalLanguagePrompt,
      state: 'RECEIVED',
      createdAt: new Date()
    };

    await db.insert('procurementRequests', initialRequest);

    await auditService.logEvent({
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
    let request = await db.findById('procurementRequests', procurementId);
    if (!request) throw new Error(`Procurement ${procurementId} not found`);

    const correlationId = request.correlationId;

    try {
      // STATE 1: RECEIVED -> PARSED
      if (request.state === 'RECEIVED') {
        const intent = await llmProvider.extractIntent(request.rawPrompt);
        
        request = await db.update('procurementRequests', procurementId, {
          intent,
          quantity: intent.quantity,
          location: intent.location,
          budgetPaise: intent.budgetINR * 100,
          deliveryDeadlineDays: intent.deliveryDeadlineDays,
          state: 'PARSED'
        });

        await auditService.logEvent({
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
          await db.update('procurementRequests', procurementId, { state: 'FAILED' });
          await auditService.logEvent({
            procurementId,
            correlationId,
            action: 'VALIDATION_FAILED',
            previousState: 'PARSED',
            newState: 'FAILED'
          });
          return await db.findById('procurementRequests', procurementId);
        }

        request = await db.update('procurementRequests', procurementId, { state: 'VALIDATED' });
        await auditService.logEvent({
          procurementId,
          correlationId,
          action: 'REQUIREMENTS_VALIDATED',
          previousState: 'PARSED',
          newState: 'VALIDATED'
        });
      }

      // STATE 3: VALIDATED -> SEARCHING -> OFFERS_RECEIVED
      if (request.state === 'VALIDATED') {
        request = await db.update('procurementRequests', procurementId, { state: 'SEARCHING' });
        
        await auditService.logEvent({
          procurementId,
          correlationId,
          action: 'SEARCH_STARTED',
          previousState: 'VALIDATED',
          newState: 'SEARCHING',
          metadata: { provider: 'Beckn / ONDC Network' }
        });

        const networkResult = await becknProvider.search(request.intent, correlationId);
        
        // Save raw offers into MongoDB
        const savedOffers = [];
        for (const o of networkResult.offers) {
          const saved = await db.insert('offers', {
            ...o,
            procurementId
          });
          savedOffers.push(saved);
        }

        request = await db.update('procurementRequests', procurementId, {
          state: 'OFFERS_RECEIVED',
          offerCount: savedOffers.length
        });

        await auditService.logEvent({
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
        request = await db.update('procurementRequests', procurementId, { state: 'COMPARING' });
        
        const offers = await db.find('offers', { procurementId });
        
        // AI Evaluation & Scoring
        let scoredOffers = comparisonEngine.evaluateOffers(request, offers);
        
        // Memory Enhancement
        scoredOffers = await memoryService.applyHistoricalInsights(request.intent?.category, scoredOffers);

        // Update offers in MongoDB with only the scored fields (safe partial update)
        for (const so of scoredOffers) {
          await db.update('offers', so.id, {
            score: so.score,
            scoreBreakdown: so.scoreBreakdown,
            explanation: so.explanation,
            memoryInsights: so.memoryInsights || null
          });
        }

        const selectedBestOffer = scoredOffers[0];
        const aiReasoning = await llmProvider.analyzeOffersAndReason(request, scoredOffers);

        request = await db.update('procurementRequests', procurementId, {
          selectedOfferId: selectedBestOffer.id,
          aiRecommendationReasoning: aiReasoning
        });

        await auditService.logEvent({
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
        const bestOffer = await db.findById('offers', request.selectedOfferId);
        const negCheck = negotiationEngine.shouldNegotiate(request, bestOffer);

        if (negCheck.eligible) {
          request = await db.update('procurementRequests', procurementId, { state: 'NEGOTIATING' });

          await auditService.logEvent({
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

          // Save negotiation log in MongoDB
          await db.insert('negotiations', {
            id: `neg_${uuidv4().substring(0, 8)}`,
            procurementId,
            offerId: bestOffer.id,
            counterOffer: counter,
            response: sellerResponse,
            status: sellerResponse.accepted ? 'SUCCESSFUL' : 'PARTIAL'
          });

          // Update offer if price reduced
          if (sellerResponse.finalTotalPricePaise < bestOffer.totalPricePaise) {
            await db.update('offers', bestOffer.id, {
              totalPricePaise: sellerResponse.finalTotalPricePaise,
              unitPricePaise: sellerResponse.finalUnitPricePaise,
              negotiated: true,
              savingsPaise: bestOffer.totalPricePaise - sellerResponse.finalTotalPricePaise
            });
          }

          request = await db.update('procurementRequests', procurementId, {
            state: 'COMPARING'
          });

          await auditService.logEvent({
            procurementId,
            correlationId,
            action: 'NEGOTIATION_COMPLETED',
            previousState: 'NEGOTIATING',
            newState: 'COMPARING',
            metadata: {
              accepted: sellerResponse.accepted,
              savingsINR: (bestOffer.totalPricePaise - sellerResponse.finalTotalPricePaise) / 100
            }
          });
        }

        // Evaluate Approval policy requirement
        const updatedBestOffer = await db.findById('offers', request.selectedOfferId);
        const approvalReq = approvalEngine.evaluateRequiredApproval(updatedBestOffer.totalPricePaise);

        if (approvalReq.requiresHumanApproval) {
          request = await db.update('procurementRequests', procurementId, {
            state: 'PENDING_APPROVAL',
            approvalRequirement: approvalReq
          });

          await auditService.logEvent({
            procurementId,
            correlationId,
            action: 'APPROVAL_REQUESTED',
            previousState: 'COMPARING',
            newState: 'PENDING_APPROVAL',
            metadata: { requiredRole: approvalReq.requiredRole, level: approvalReq.level }
          });
        } else {
          // Auto Approved!
          request = await db.update('procurementRequests', procurementId, {
            state: 'APPROVED',
            approvalRequirement: approvalReq
          });

          await db.insert('approvals', {
            id: `app_${uuidv4().substring(0, 8)}`,
            procurementId,
            approverId: 'SYSTEM_AUTO_POLICY',
            status: 'APPROVED',
            comments: approvalReq.description
          });

          await auditService.logEvent({
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

      return await db.findById('procurementRequests', procurementId);
    } catch (err) {
      console.error(`[ProcurementAgent Error] ${err.message}`, err);
      await db.update('procurementRequests', procurementId, { state: 'FAILED', failureReason: err.message });
      await auditService.logEvent({
        procurementId,
        correlationId,
        action: 'AGENT_ERROR',
        newState: 'FAILED',
        metadata: { error: err.message }
      });
      return await db.findById('procurementRequests', procurementId);
    }
  }

  /**
   * Human Approval Handler in MongoDB
   */
  async grantHumanApproval(procurementId, approverId, comments = 'Approved after managerial review') {
    const request = await db.findById('procurementRequests', procurementId);
    if (!request || request.state !== 'PENDING_APPROVAL') {
      throw new Error(`Procurement ${procurementId} is not in PENDING_APPROVAL state`);
    }

    const user = await db.findById('users', approverId);
    if (!user) {
      throw new Error(`Approver ${approverId} was not found`);
    }
    if (user.orgId !== request.orgId) {
      throw new Error('Approver does not belong to the procurement organization');
    }

    const offer = await db.findById('offers', request.selectedOfferId);
    if (!offer) {
      throw new Error('Selected offer was not found for approval');
    }

    const validation = approvalEngine.canUserApprove(
      user.role,
      user.approvalLimitPaise,
      offer.totalPricePaise
    );
    if (!validation.allowed) {
      throw new Error(`Approval rejected: ${validation.reason}`);
    }

    const transitionedRequest = await db.updateWhere(
      'procurementRequests',
      { id: procurementId, state: 'PENDING_APPROVAL' },
      { state: 'APPROVED' }
    );
    if (!transitionedRequest) {
      throw new Error(`Procurement ${procurementId} approval was already processed`);
    }

    await db.insert('approvals', {
      id: `app_${uuidv4().substring(0, 8)}`,
      procurementId,
      approverId,
      status: 'APPROVED',
      comments
    });

    await auditService.logEvent({
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
   * Order Execution Step: ORDERING -> ORDER_CONFIRMED -> TRACKING in MongoDB
   */
  async executeOrder(procurementId) {
    let request = await db.findById('procurementRequests', procurementId);
    if (request.state !== 'APPROVED') {
      throw new Error(`Cannot place order for procurement in state ${request.state}`);
    }

    const correlationId = request.correlationId;
    const selectedOffer = await db.findById('offers', request.selectedOfferId);
    if (!selectedOffer) {
      throw new Error('Selected offer was not found before order execution');
    }

    // STATE: ORDERING
    request = await db.update('procurementRequests', procurementId, { state: 'ORDERING' });

    await auditService.logEvent({
      procurementId,
      correlationId,
      action: 'ORDER_INITIATED',
      previousState: 'APPROVED',
      newState: 'ORDERING',
      metadata: { sellerId: selectedOffer.sellerId, totalAmountINR: selectedOffer.totalPricePaise / 100 }
    });

    const organization = await db.findById('organizations', request.orgId);

    // Beckn Protocol /select, /init, /confirm sequence
    await becknProvider.select(selectedOffer, correlationId);
    await becknProvider.init(
      selectedOffer,
      {
        orgName: organization?.name || request.orgId,
        location: request.location
      },
      correlationId
    );
    const confirmResult = await becknProvider.confirm(selectedOffer, correlationId);

    // Persist the final network quote when the BPP revises pricing during init/confirm.
    const finalTotalPricePaise =
      confirmResult.order.finalTotalPricePaise || selectedOffer.totalPricePaise;

    // Save Order Entity in MongoDB
    const orderRecord = await db.insert('orders', {
      id: `ord_${uuidv4().substring(0, 8)}`,
      procurementId,
      becknOrderId: confirmResult.becknOrderId,
      sellerId: selectedOffer.sellerId,
      sellerName: selectedOffer.sellerName,
      totalPricePaise: finalTotalPricePaise,
      totalPriceINR: finalTotalPricePaise / 100,
      quantity: request.quantity,
      status: 'CONFIRMED',
      fulfillmentStatus: confirmResult.order.fulfillmentStatus,
      trackingUrl: confirmResult.order.trackingUrl,
      estimatedDeliveryDate: confirmResult.order.estimatedDeliveryDate,
      networkContext: confirmResult.networkContext || null
    });

    // STATE: ORDER_CONFIRMED -> TRACKING
    request = await db.update('procurementRequests', procurementId, {
      state: 'TRACKING',
      orderId: orderRecord.id,
      becknOrderId: confirmResult.becknOrderId
    });

    await auditService.logEvent({
      procurementId,
      correlationId,
      action: 'ORDER_CONFIRMED',
      previousState: 'ORDERING',
      newState: 'TRACKING',
      metadata: { becknOrderId: confirmResult.becknOrderId, trackingUrl: orderRecord.trackingUrl }
    });

    // Record the actual confirmed price, not a stale pre-confirm quote.
    await memoryService.recordProcurementPattern(request, {
      ...selectedOffer,
      totalPricePaise: finalTotalPricePaise,
      unitPricePaise: Math.round(finalTotalPricePaise / request.quantity)
    });

    return {
      request: await db.findById('procurementRequests', procurementId),
      order: orderRecord,
      offer: selectedOffer
    };
  }
}

module.exports = new ProcurementAgent();
