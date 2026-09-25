const CommerceNetworkProvider = require('./commerceNetwork');
const { v4: uuidv4 } = require('uuid');

class MockBecknNetwork extends CommerceNetworkProvider {
  constructor() {
    super('MockBecknNetwork');
    this.activeOrders = new Map();
  }

  /**
   * Simulates Beckn /search discovery across multiple network nodes
   */
  async search(intent, correlationId) {
    // Artificial slight network latency simulation
    await new Promise(resolve => setTimeout(resolve, 300));

    const qty = intent.quantity || 10;
    const itemCategory = intent.category || 'laptop';

    // 4 Realistic Sellers with distinct offer profiles
    const rawOffers = [
      {
        sellerId: 'seller_techsupply_01',
        sellerName: 'TechSupply Corp (Local Sandbox)',
        sellerRating: 4.7,
        complianceScore: 100,
        itemTitle: 'Dell Latitude 5440 Enterprise Laptop (16GB, i7-1360P, 512GB SSD)',
        unitPricePaise: 9100000, // ₹91,000 per unit
        quantityAvailable: 120,
        deliveryDays: 5,
        location: 'Hyderabad Warehouse',
        warranty: '3-Year Onsite OEM Warranty',
        negotiable: true,
        minNegotiablePricePaise: 8700000, // ₹87,000 min
        becknFulfillmentId: 'ful_ts_hyder_01'
      },
      {
        sellerId: 'seller_omni_02',
        sellerName: 'OmniLaptops India Pvt Ltd',
        sellerRating: 4.3,
        complianceScore: 95,
        itemTitle: 'HP ProBook 450 G10 (16GB RAM, Core i7 13th Gen, 512GB SSD)',
        unitPricePaise: 8700000, // ₹87,000 per unit (Cheaper!)
        quantityAvailable: 85,
        deliveryDays: 10, // Slower delivery
        location: 'Bengaluru Hub',
        warranty: '3-Year Standard Warranty',
        negotiable: true,
        minNegotiablePricePaise: 8400000,
        becknFulfillmentId: 'ful_omni_blr_02'
      },
      {
        sellerId: 'seller_ent_03',
        sellerName: 'Enterprise Direct Solutions',
        sellerRating: 4.9,
        complianceScore: 100,
        itemTitle: 'Lenovo ThinkPad L14 Gen 4 (16GB RAM, i7 Processor, 1TB SSD)',
        unitPricePaise: 9800000, // ₹98,000 per unit (Premium)
        quantityAvailable: 200,
        deliveryDays: 3, // Ultra-fast express delivery!
        location: 'Hyderabad Local Facility',
        warranty: '3-Year Premier Support',
        negotiable: false,
        minNegotiablePricePaise: 9800000,
        becknFulfillmentId: 'ful_ent_hyd_express'
      },
      {
        sellerId: 'seller_b2b_04',
        sellerName: 'QuickB2B Commercial Store',
        sellerRating: 3.9,
        complianceScore: 82,
        itemTitle: 'Acer TravelMate P2 (16GB RAM, i7, 512GB SSD)',
        unitPricePaise: 8200000, // ₹82,000 per unit (Very Cheap)
        quantityAvailable: 40, // Low inventory warning
        deliveryDays: 12,
        location: 'Mumbai Depot',
        warranty: '1-Year Limited Warranty',
        negotiable: true,
        minNegotiablePricePaise: 7900000,
        becknFulfillmentId: 'ful_qb2b_mum_04'
      }
    ];

    const formattedOffers = rawOffers.map(o => {
      const totalPricePaise = o.unitPricePaise * qty;
      return {
        id: `off_${o.sellerId}_${uuidv4().substring(0, 8)}`,
        sellerId: o.sellerId,
        sellerName: o.sellerName,
        sellerRating: o.sellerRating,
        complianceScore: o.complianceScore,
        itemTitle: o.itemTitle,
        unitPricePaise: o.unitPricePaise,
        quantity: qty,
        totalPricePaise: totalPricePaise,
        totalPriceINR: totalPricePaise / 100,
        deliveryDays: o.deliveryDays,
        location: o.location,
        warranty: o.warranty,
        negotiable: o.negotiable,
        minNegotiablePricePaise: o.minNegotiablePricePaise,
        becknFulfillmentId: o.becknFulfillmentId,
        becknContext: {
          domain: 'nic2004:52110',
          country: 'IND',
          city: 'std:040',
          action: 'on_search',
          core_version: '1.1.0',
          bap_id: 'procure-ai-bap.domain.org',
          bpp_id: `bpp-${o.sellerId}.beckn.org`,
          transaction_id: correlationId,
          message_id: uuidv4(),
          timestamp: new Date().toISOString()
        }
      };
    });

    return {
      correlationId,
      provider: this.name,
      offers: formattedOffers
    };
  }

  /**
   * Simulates Beckn /select item verification and lock
   */
  async select(offer, correlationId) {
    await new Promise(resolve => setTimeout(resolve, 200));

    return {
      correlationId,
      status: 'SELECTED',
      offerId: offer.id,
      quote: {
        price: {
          currency: 'INR',
          value: (offer.totalPricePaise / 100).toFixed(2)
        },
        breakdown: [
          { title: 'Base Item Price', price: { currency: 'INR', value: ((offer.totalPricePaise * 0.82) / 100).toFixed(2) } },
          { title: 'GST (18%)', price: { currency: 'INR', value: ((offer.totalPricePaise * 0.18) / 100).toFixed(2) } },
          { title: 'Freight & Delivery', price: { currency: 'INR', value: '0.00' } }
        ]
      },
      fulfillment: {
        id: offer.becknFulfillmentId,
        state: { descriptor: { code: 'Serviceable' } },
        tracking: true
      },
      becknPayload: {
        context: {
          action: 'on_select',
          transaction_id: correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Simulates Beckn /init billing and terms creation
   */
  async init(offer, customerDetails, correlationId) {
    await new Promise(resolve => setTimeout(resolve, 250));

    return {
      correlationId,
      status: 'INITIALIZED',
      orderDraftId: `draft_${uuidv4().substring(0, 8)}`,
      billing: {
        name: customerDetails.orgName || 'Acme Enterprise',
        address: customerDetails.location || 'Hyderabad Technology Park, Telangana'
      },
      paymentTerms: {
        type: 'ON_ORDER',
        status: 'PAID_IN_ESCROW',
        collected_by: 'BAP'
      },
      becknPayload: {
        context: {
          action: 'on_init',
          transaction_id: correlationId,
          timestamp: new Date().toISOString()
        }
      }
    };
  }

  /**
   * Simulates Beckn /confirm order placement
   */
  async confirm(orderPayload, correlationId) {
    await new Promise(resolve => setTimeout(resolve, 350));

    const becknOrderId = `ORD-BECKN-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const trackingUrl = `https://track.beckn-express.org/orders/${becknOrderId}`;

    const orderData = {
      becknOrderId,
      status: 'CONFIRMED',
      fulfillmentStatus: 'ORDER_ACKNOWLEDGED',
      trackingUrl,
      estimatedDeliveryDate: new Date(Date.now() + (orderPayload.deliveryDays || 5) * 86400000).toISOString(),
      confirmedAt: new Date().toISOString()
    };

    this.activeOrders.set(becknOrderId, orderData);

    return {
      correlationId,
      becknOrderId,
      order: orderData,
      becknPayload: {
        context: {
          action: 'on_confirm',
          transaction_id: correlationId,
          timestamp: new Date().toISOString()
        },
        message: {
          order: {
            id: becknOrderId,
            state: 'ACCEPTED',
            tracking: true,
            fulfillment: {
              tracking_id: `TRK-${uuidv4().substring(0, 8).toUpperCase()}`,
              start: { location: { descriptor: { name: orderPayload.sellerName } } },
              end: { location: { address: { name: 'Acme Enterprise Hyderabad' } } }
            }
          }
        }
      }
    };
  }

  /**
   * Simulates Beckn /status real-time order tracking query
   */
  async status(becknOrderId, correlationId) {
    await new Promise(resolve => setTimeout(resolve, 150));

    const existing = this.activeOrders.get(becknOrderId) || {
      becknOrderId,
      status: 'IN_TRANSIT',
      fulfillmentStatus: 'DISPATCHED_FROM_WAREHOUSE',
      estimatedDeliveryDate: new Date(Date.now() + 3 * 86400000).toISOString()
    };

    return {
      correlationId,
      becknOrderId,
      status: existing.status,
      fulfillmentState: existing.fulfillmentStatus,
      location: 'Hyderabad Regional Sorting Facility',
      lastUpdated: new Date().toISOString(),
      becknPayload: {
        context: {
          action: 'on_status',
          transaction_id: correlationId,
          timestamp: new Date().toISOString()
        },
        message: {
          order: {
            id: becknOrderId,
            state: 'IN_TRANSIT'
          }
        }
      }
    };
  }
}

module.exports = new MockBecknNetwork();
