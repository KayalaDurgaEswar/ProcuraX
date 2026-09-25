class NegotiationEngine {
  constructor() {
    this.maxDiscountPercent = 10; // Max 10% discount target
    this.minQuantityForNegotiation = 10;
  }

  /**
   * Assesses whether negotiation should be initiated with seller
   */
  shouldNegotiate(request, selectedOffer) {
    if (!selectedOffer) return { eligible: false, reason: 'No offer selected' };
    if (!selectedOffer.negotiable) {
      return { eligible: false, reason: 'Seller profile specifies non-negotiable terms' };
    }

    if (request.quantity < this.minQuantityForNegotiation) {
      return { eligible: false, reason: `Quantity (${request.quantity}) below negotiation threshold (${this.minQuantityForNegotiation})` };
    }

    // If offer total is within 5% of minNegotiablePrice, negotiation is viable
    const potentialSavingsPaise = selectedOffer.totalPricePaise - (selectedOffer.minNegotiablePricePaise * request.quantity);
    if (potentialSavingsPaise > 0) {
      return {
        eligible: true,
        reason: `Potential negotiation savings of ₹${(potentialSavingsPaise / 100).toLocaleString('en-IN')} identified based on enterprise order volume.`,
        targetDiscountPercent: 5
      };
    }

    return { eligible: false, reason: 'Offer is already at minimum vendor floor price' };
  }

  /**
   * Generates counter offer proposal bounded by enterprise negotiation policy
   */
  generateCounterOffer(request, offer, requestedDiscountPercent = 5) {
    const cappedDiscount = Math.min(requestedDiscountPercent, this.maxDiscountPercent);
    const unitPricePaise = offer.unitPricePaise;
    const counterUnitPricePaise = Math.max(
      offer.minNegotiablePricePaise,
      Math.round(unitPricePaise * (1 - (cappedDiscount / 100)))
    );

    const counterTotalPaise = counterUnitPricePaise * request.quantity;
    const savingsPaise = offer.totalPricePaise - counterTotalPaise;

    return {
      offerId: offer.id,
      sellerId: offer.sellerId,
      originalTotalPricePaise: offer.totalPricePaise,
      counterTotalPricePaise: counterTotalPaise,
      savingsPaise,
      savingsINR: savingsPaise / 100,
      proposedUnitPricePaise: counterUnitPricePaise,
      requestedDiscountPercent: cappedDiscount,
      policyValidation: {
        withinEnterpriseLimit: cappedDiscount <= this.maxDiscountPercent,
        aboveVendorFloor: counterUnitPricePaise >= offer.minNegotiablePricePaise
      },
      message: `Requesting enterprise bulk discount of ${cappedDiscount}% for order quantity ${request.quantity} units to ₹${(counterTotalPaise / 100).toLocaleString('en-IN')}.`
    };
  }

  /**
   * Evaluates seller response to negotiation counter-offer
   */
  evaluateSellerResponse(offer, counterOffer) {
    // Simulate seller acceptance or counter-proposal
    const minVendorTotalPaise = offer.minNegotiablePricePaise * offer.quantity;
    
    if (counterOffer.counterTotalPricePaise >= minVendorTotalPaise) {
      return {
        accepted: true,
        finalTotalPricePaise: counterOffer.counterTotalPricePaise,
        finalUnitPricePaise: counterOffer.proposedUnitPricePaise,
        sellerMessage: `Seller ${offer.sellerName} ACCEPTED counter-offer of ₹${counterOffer.savingsINR.toLocaleString('en-IN')} discount!`
      };
    } else {
      // Counter halfway
      const splitTotalPaise = Math.round((offer.totalPricePaise + minVendorTotalPaise) / 2);
      return {
        accepted: false,
        counterProposed: true,
        finalTotalPricePaise: splitTotalPaise,
        finalUnitPricePaise: Math.round(splitTotalPaise / offer.quantity),
        sellerMessage: `Seller ${offer.sellerName} counter-proposed ₹${(splitTotalPaise / 100).toLocaleString('en-IN')}.`
      };
    }
  }
}

module.exports = new NegotiationEngine();
