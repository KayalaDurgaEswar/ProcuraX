const CommerceNetworkProvider = require('./commerceNetwork');
const realBecknNetwork = require('./realBecknProvider');
const config = require('../../config');

class BecknProvider extends CommerceNetworkProvider {
  constructor() {
    super('BecknProvider');
    this.mode = config.beckn.defaultProvider;
    this.gatewayUrl = config.beckn.gatewayUrl;
  }

  async search(intent, correlationId) {
    // Always try real gateway first
    return await realBecknNetwork.search(intent, correlationId);
  }

  async select(offer, correlationId) {
    return await realBecknNetwork.select(offer, correlationId);
  }

  async init(offer, customerDetails, correlationId) {
    return await realBecknNetwork.init(offer, customerDetails, correlationId);
  }

  async confirm(orderPayload, correlationId) {
    return await realBecknNetwork.confirm(orderPayload, correlationId);
  }

  async status(orderId, correlationId) {
    return await realBecknNetwork.status(orderId, correlationId);
  }
}

module.exports = new BecknProvider();
