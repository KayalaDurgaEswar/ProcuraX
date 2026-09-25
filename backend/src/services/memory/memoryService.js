const db = require('../../db/database');
const { v4: uuidv4 } = require('uuid');

class MemoryService {
  /**
   * Retrieves historical pattern context for a given category/item
   */
  getCategoryPattern(category) {
    if (!category) return null;
    const cleanCategory = category.toLowerCase();

    return db.findOne('memoryPatterns', p => p.category.toLowerCase() === cleanCategory);
  }

  /**
   * Enhances offer scoring slightly based on historical seller performance without overriding explicit current constraints
   */
  applyHistoricalInsights(category, offers) {
    const pattern = this.getCategoryPattern(category);
    if (!pattern || !pattern.preferredSellers) return offers;

    return offers.map(offer => {
      let memoryBoost = 0;
      let memoryNote = '';

      if (pattern.preferredSellers.includes(offer.sellerId)) {
        memoryBoost = 3; // Subtle 3-point boost for historically reliable sellers
        memoryNote = `Historical Memory: Vendor previously delivered ${pattern.successfulProcurementsCount} orders successfully in ${pattern.avgDeliveryDays} days.`;
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
   * Records a successful procurement order completion into memory
   */
  recordProcurementPattern(procurement, selectedOffer) {
    const category = (procurement.intent?.category || 'general').toLowerCase();
    const existing = this.getCategoryPattern(category);

    const unitPricePaise = selectedOffer.unitPricePaise;

    if (existing) {
      const count = existing.successfulProcurementsCount + 1;
      const updatedPreferred = [...new Set([...existing.preferredSellers, selectedOffer.sellerId])];
      const newAvgPrice = Math.round(((existing.averagePricePerUnitPaise * existing.successfulProcurementsCount) + unitPricePaise) / count);
      const newAvgDelivery = Math.round(((existing.avgDeliveryDays * existing.successfulProcurementsCount) + selectedOffer.deliveryDays) / count);

      db.update('memoryPatterns', existing.id, {
        preferredSellers: updatedPreferred,
        averagePricePerUnitPaise: newAvgPrice,
        avgDeliveryDays: newAvgDelivery,
        successfulProcurementsCount: count,
        lastProcuredAt: new Date().toISOString()
      });
    } else {
      db.insert('memoryPatterns', {
        id: `mem_${uuidv4().substring(0, 8)}`,
        category,
        preferredSellers: [selectedOffer.sellerId],
        averagePricePerUnitPaise: unitPricePaise,
        avgDeliveryDays: selectedOffer.deliveryDays,
        successfulProcurementsCount: 1,
        lastProcuredAt: new Date().toISOString()
      });
    }
  }
}

module.exports = new MemoryService();
