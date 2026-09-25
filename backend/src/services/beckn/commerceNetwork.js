/**
 * Abstract interface for Commerce Network Providers (Beckn, ONDC, Mock)
 */
class CommerceNetworkProvider {
  constructor(name) {
    this.name = name;
  }

  async search(intent, correlationId) {
    throw new Error('search() method must be implemented by subclass');
  }

  async select(offerId, correlationId) {
    throw new Error('select() method must be implemented by subclass');
  }

  async init(offerId, customerDetails, correlationId) {
    throw new Error('init() method must be implemented by subclass');
  }

  async confirm(orderPayload, correlationId) {
    throw new Error('confirm() method must be implemented by subclass');
  }

  async status(orderId, correlationId, networkContext = null) {
    void networkContext;
    throw new Error('status() method must be implemented by subclass');
  }
}

module.exports = CommerceNetworkProvider;
