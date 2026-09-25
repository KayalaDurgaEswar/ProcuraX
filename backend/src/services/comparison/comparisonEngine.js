const config = require('../../config');

class ComparisonEngine {
  constructor() {
    this.weights = config.scoringWeights;
  }

  /**
   * Compares and scores multiple seller offers based on procurement request constraints
   */
  evaluateOffers(request, offers) {
    if (!offers || offers.length === 0) return [];

    const targetBudgetPaise = request.budgetPaise;
    const maxDays = request.deliveryDeadlineDays || 14;

    const scoredOffers = offers.map(offer => {
      // 1. Price Score (0 - 100)
      let priceScore = 100;
      if (offer.totalPricePaise > targetBudgetPaise) {
        const overPercent = ((offer.totalPricePaise - targetBudgetPaise) / targetBudgetPaise) * 100;
        priceScore = Math.max(0, 100 - (overPercent * 2.5));
      } else {
        const underPercent = ((targetBudgetPaise - offer.totalPricePaise) / targetBudgetPaise) * 100;
        priceScore = Math.min(100, 75 + (underPercent * 1.5));
      }

      // 2. Delivery Speed Score (0 - 100)
      let deliveryScore = 100;
      if (offer.deliveryDays > maxDays) {
        const lateDays = offer.deliveryDays - maxDays;
        deliveryScore = Math.max(0, 100 - (lateDays * 15));
      } else {
        const earlyDays = maxDays - offer.deliveryDays;
        deliveryScore = Math.min(100, 70 + (earlyDays * 6));
      }

      // 3. Rating Score (0 - 100)
      const ratingScore = (offer.sellerRating / 5.0) * 100;

      // 4. Compliance Score (0 - 100)
      const complianceScore = offer.complianceScore || 90;

      // 5. Specs Match Score (0 - 100)
      let specsScore = 95;
      if (offer.itemTitle.toLowerCase().includes('i7') && request.requirements?.processor?.toLowerCase().includes('i7')) {
        specsScore += 5;
      }

      // Weighted Score calculation
      const finalScore = Math.round(
        (priceScore * this.weights.price) +
        (deliveryScore * this.weights.deliveryTime) +
        (ratingScore * this.weights.sellerRating) +
        (complianceScore * this.weights.compliance) +
        (specsScore * this.weights.specsMatch)
      );

      // Explainability text generation
      const explanation = this.generateExplanation({
        offer,
        finalScore,
        priceScore,
        deliveryScore,
        ratingScore,
        complianceScore,
        specsScore,
        targetBudgetPaise,
        maxDays
      });

      return {
        ...offer,
        score: finalScore,
        scoreBreakdown: {
          priceScore: Math.round(priceScore),
          deliveryScore: Math.round(deliveryScore),
          ratingScore: Math.round(ratingScore),
          complianceScore: Math.round(complianceScore),
          specsScore: Math.round(specsScore)
        },
        explanation
      };
    });

    // Sort descending by score
    return scoredOffers.sort((a, b) => b.score - a.score);
  }

  generateExplanation(data) {
    const { offer, finalScore, priceScore, deliveryScore, ratingScore, complianceScore, targetBudgetPaise, maxDays } = data;
    const priceDiffINR = (targetBudgetPaise - offer.totalPricePaise) / 100;

    let priceComment = '';
    if (priceDiffINR >= 0) {
      priceComment = `₹${Math.abs(priceDiffINR).toLocaleString('en-IN')} below budget`;
    } else {
      priceComment = `₹${Math.abs(priceDiffINR).toLocaleString('en-IN')} OVER budget`;
    }

    let deliveryComment = offer.deliveryDays <= maxDays
      ? `Delivering in ${offer.deliveryDays} days (meets ${maxDays} day deadline)`
      : `Delivering in ${offer.deliveryDays} days (EXCEEDS ${maxDays} day deadline)`;

    return `Scored ${finalScore}/100. Price: ${priceComment} (Score: ${Math.round(priceScore)}). Delivery: ${deliveryComment} (Score: ${Math.round(deliveryScore)}). Rating: ${offer.sellerRating}/5 (Score: ${Math.round(ratingScore)}). Compliance: ${complianceScore}%.`;
  }
}

module.exports = new ComparisonEngine();
