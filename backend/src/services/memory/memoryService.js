const db = require('../../db/database');
const { v4: uuidv4 } = require('uuid');

class MemoryService {
  /**
   * Retrieves historical pattern context from MongoDB for a given category.
   * Uses proper Mongoose query — no function-based filtering.
   */
  async getCategoryPattern(category) {
    if (!category) return null;
    const cleanCategory = category.toLowerCase().trim();
    return await db.findOne('memoryPatterns', { category: cleanCategory });
  }

  /**
   * Enhances offer scoring based on historical MongoDB vendor insights
   */
  async applyHistoricalInsights(category, offers) {
    const pattern = await this.getCategoryPattern(category);
    if (!pattern || !pattern.preferredSellers) return offers;

    return offers.map(offer => {
      let memoryBoost = 0;
      let memoryNote = '';

      if (pattern.preferredSellers.includes(offer.sellerId)) {
        memoryBoost = 3;
        memoryNote = `Historical Memory: Vendor previously delivered ${pattern.successfulProcurementsCount} orders successfully in ${pattern.avgDeliveryDays} days avg.`;
      }

      return {
        ...offer,
        score: Math.min(100, offer.score + memoryBoost),
        memoryInsights: {
          historicalVendor: pattern.preferredSellers.includes(offer.sellerId),
          avgCategoryPricePaise: pattern.averagePricePerUnitPaise,
          memoryNote
        }
      };
    });
  }

  /**
   * Records a successful procurement order completion into MongoDB memory.
   * Uses proper upsert via Mongoose findOneAndUpdate with $set.
   */
  async recordProcurementPattern(procurement, selectedOffer) {
    const category = (procurement.intent?.category || 'general').toLowerCase().trim();
    const existing = await this.getCategoryPattern(category);

    const unitPricePaise = selectedOffer.unitPricePaise;

    if (existing) {
      const count = existing.successfulProcurementsCount + 1;
      const updatedPreferred = [...new Set([...existing.preferredSellers, selectedOffer.sellerId])];
      const newAvgPrice = Math.round(
        ((existing.averagePricePerUnitPaise * existing.successfulProcurementsCount) + unitPricePaise) / count
      );
      const newAvgDelivery = Math.round(
        ((existing.avgDeliveryDays * existing.successfulProcurementsCount) + selectedOffer.deliveryDays) / count
      );

      await db.update('memoryPatterns', existing.id, {
        preferredSellers: updatedPreferred,
        averagePricePerUnitPaise: newAvgPrice,
        avgDeliveryDays: newAvgDelivery,
        successfulProcurementsCount: count,
        lastProcuredAt: new Date()
      });
      console.log(`[MemoryService] Updated memory pattern for category "${category}" (${count} procurements).`);
    } else {
      await db.insert('memoryPatterns', {
        id: `mem_${uuidv4().substring(0, 8)}`,
        category,
        preferredSellers: [selectedOffer.sellerId],
        averagePricePerUnitPaise: unitPricePaise,
        avgDeliveryDays: selectedOffer.deliveryDays,
        successfulProcurementsCount: 1,
        lastProcuredAt: new Date()
      });
      console.log(`[MemoryService] Created new memory pattern for category "${category}".`);
    }
  }
}

module.exports = new MemoryService();
