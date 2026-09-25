const CommerceNetworkProvider = require('./commerceNetwork');
const mockBecknNetwork = require('./mockNetwork');
const config = require('../../config');

class BecknProvider extends CommerceNetworkProvider {
  constructor() {
    super('BecknProvider');
    this.mode = config.beckn.defaultProvider; // 'mock' or 'real'
    this.gatewayUrl = config.beckn.gatewayUrl;
  }

  async search(intent, correlationId) {
    if (this.mode === 'mock') {
      return await mockBecknNetwork.search(intent, correlationId);
    }

    // Real Beckn Gateway Integration (/search)
    try {
      const becknPayload = {
        context: {
          domain: 'nic2004:52110',
          country: 'IND',
          city: 'std:040',
          action: 'search',
          core_version: '1.1.0',
          bap_id: config.beckn.bapId,
          bap_uri: config.beckn.bapUri,
          transaction_id: correlationId,
          message_id: correlationId,
          timestamp: new Date().toISOString()
        },
        message: {
          intent: {
            item: { descriptor: { name: intent.category } },
            fulfillment: { end: { location: { address: { area_code: intent.location } } } }
          }
        }
      };

      const response = await fetch(`${this.gatewayUrl}/search`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(becknPayload)
      });

      if (!response.ok) {
        throw new Error(`Beckn Gateway returned ${response.status}`);
      }

      const resData = await response.json();
      return resData;
    } catch (err) {
      console.warn(`[BecknProvider] Real gateway failed (${err.message}). Using Mock sandbox network.`);
      return await mockBecknNetwork.search(intent, correlationId);
    }
  }

  async select(offer, correlationId) {
    if (this.mode === 'mock') {
      return await mockBecknNetwork.select(offer, correlationId);
    }
    return await mockBecknNetwork.select(offer, correlationId);
  }

  async init(offer, customerDetails, correlationId) {
    if (this.mode === 'mock') {
      return await mockBecknNetwork.init(offer, customerDetails, correlationId);
    }
    return await mockBecknNetwork.init(offer, customerDetails, correlationId);
  }

  async confirm(orderPayload, correlationId) {
    if (this.mode === 'mock') {
      return await mockBecknNetwork.confirm(orderPayload, correlationId);
    }
    return await mockBecknNetwork.confirm(orderPayload, correlationId);
  }

  async status(orderId, correlationId) {
    if (this.mode === 'mock') {
      return await mockBecknNetwork.status(orderId, correlationId);
    }
    return await mockBecknNetwork.status(orderId, correlationId);
  }
}

module.exports = new BecknProvider();
