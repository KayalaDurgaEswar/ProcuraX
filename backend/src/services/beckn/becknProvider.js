const CommerceNetworkProvider = require('./commerceNetwork');
const mockBecknNetwork = require('./mockNetwork');
const callbackStore = require('./callbackStore');
const config = require('../../config');
const { v4: uuidv4 } = require('uuid');

class BecknProvider extends CommerceNetworkProvider {
  constructor() {
    super('BecknProvider');
    this.mode = config.beckn.defaultProvider;
    this.gatewayUrl = config.beckn.gatewayUrl;
    this.transactions = new Map();
  }

  _context(action, transactionId, overrides = {}) {
    return {
      domain: config.beckn.domain,
      country: config.beckn.country,
      city: config.beckn.city,
      action,
      core_version: config.beckn.protocolVersion,
      bap_id: config.beckn.bapId,
      bap_uri: config.beckn.bapUri,
      transaction_id: transactionId,
      message_id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...overrides
    };
  }
  _joinUrl(baseUrl, action) {
    return `${String(baseUrl).replace(/\/$/, '')}/${action}`;
  }

  _assertAck(data) {
    const status = data?.message?.ack?.status || data?.ack?.status;
    if (status === 'NACK') {
      const message = data?.error?.message || 'Beckn peer returned NACK';
      throw new Error(message);
    }
  }

  async _postJson(url, payload) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.beckn.requestTimeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};

      if (!response.ok) {
        throw new Error(`Beckn peer ${url} returned HTTP ${response.status}`);
      }
      this._assertAck(data);
      return data;
    } finally {
      clearTimeout(timer);
    }
  }
  async _callbackOrDirect(action, transactionId, response, collect = false) {
    const isDirect = response?.context?.action === action ||
      (action === 'on_search' && response?.message?.catalog);

    if (isDirect) {
      return collect ? [response] : response;
    }

    if (collect) {
      return callbackStore.collect(
        action,
        transactionId,
        config.beckn.callbackTimeoutMs,
        config.beckn.callbackSettleMs
      );
    }

    return callbackStore.waitFor(action, transactionId, config.beckn.callbackTimeoutMs);
  }

  async _realOrFallback(label, realOperation, fallbackOperation) {
    try {
      return await realOperation();
    } catch (err) {
      if (!config.beckn.allowMockFallback) {
        throw new Error(`${label} failed: ${err.message}`);
      }
      console.warn(`[BecknProvider] ${label} failed (${err.message}); explicit mock fallback enabled.`);
      return fallbackOperation();
    }
  }

  _targetFromOffer(offer) {
    const bppUri = offer?.becknBppUri || offer?.becknContext?.bpp_uri;
    const bppId = offer?.becknBppId || offer?.becknContext?.bpp_id;
    if (!bppUri) throw new Error('Selected offer does not include Beckn bpp_uri');
    return { bppUri, bppId };
  }
  _deliveryDays(fulfillment) {
    const duration = fulfillment?.time?.duration;
    const match = typeof duration === 'string' ? duration.match(/^P(\d+)D$/i) : null;
    if (match) return Number(match[1]);

    const end = fulfillment?.end?.time?.timestamp || fulfillment?.end?.time?.range?.end;
    if (end) {
      const days = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000);
      if (Number.isFinite(days) && days > 0) return days;
    }
    return 7;
  }

  _mapSearchCallbacks(payloads, intent, correlationId) {
    const offers = [];
    const quantity = Number(intent.quantity || 1);

    for (const payload of payloads) {
      const context = payload?.context || {};
      const providers = payload?.message?.catalog?.providers || [];

      for (const provider of providers) {
        if (provider.itemTitle && provider.unitPricePaise) {
          offers.push({
            ...provider,
            quantity: provider.quantity || quantity,
            becknContext: { ...(provider.becknContext || {}), ...context }
          });
          continue;
        }

        const items = provider.items || [];
        for (const item of items) {
          const unitPriceINR = Number(item?.price?.value);
          if (!Number.isFinite(unitPriceINR) || unitPriceINR <= 0) continue;

          const unitPricePaise = Math.round(unitPriceINR * 100);
          const fulfillment = provider.fulfillments?.[0] ||
            payload?.message?.catalog?.fulfillments?.[0] || {};
          offers.push({
            id: `off_${provider.id || 'provider'}_${item.id || uuidv4().slice(0, 8)}`,
            sellerId: provider.id || context.bpp_id || 'unknown_bpp',
            sellerName: provider?.descriptor?.name || provider.id || context.bpp_id || 'Beckn Seller',
            sellerRating: Number(provider.rating || 4),
            complianceScore: 100,
            itemTitle: item?.descriptor?.name || item.id || intent.category,
            unitPricePaise,
            quantity,
            totalPricePaise: unitPricePaise * quantity,
            totalPriceINR: unitPriceINR * quantity,
            deliveryDays: this._deliveryDays(fulfillment),
            location: provider?.locations?.[0]?.descriptor?.name || intent.location,
            warranty: item?.descriptor?.short_desc || 'As per seller terms',
            negotiable: false,
            minNegotiablePricePaise: unitPricePaise,
            becknFulfillmentId: fulfillment.id || null,
            becknItemId: item.id,
            becknProviderId: provider.id,
            becknBppId: context.bpp_id,
            becknBppUri: context.bpp_uri,
            becknContext: context
          });
        }
      }
    }

    if (!offers.length) {
      throw new Error(`No usable offers received for Beckn transaction ${correlationId}`);
    }
    return offers;
  }

  async search(intent, correlationId) {
    if (this.mode === 'mock') {
      return mockBecknNetwork.search(intent, correlationId);
    }
    return this._realOrFallback('search', async () => {
      const payload = {
        context: this._context('search', correlationId),
        message: {
          intent: {
            item: {
              descriptor: { name: intent.category },
              quantity: { selected: { count: Number(intent.quantity || 1) } }
            },
            fulfillment: {
              end: { location: { address: { area_code: intent.location } } }
            }
          }
        }
      };

      const response = await this._postJson(this._joinUrl(this.gatewayUrl, 'search'), payload);
      const callbacks = await this._callbackOrDirect('on_search', correlationId, response, true);
      const offers = this._mapSearchCallbacks(callbacks, intent, correlationId);

      return {
        correlationId,
        provider: this.name,
        callbackCount: callbacks.length,
        offers
      };
    }, () => mockBecknNetwork.search(intent, correlationId));
  }

  async select(offer, correlationId) {
    if (this.mode === 'mock') return mockBecknNetwork.select(offer, correlationId);

    return this._realOrFallback('select', async () => {
      const target = this._targetFromOffer(offer);
      const payload = {
        context: this._context('select', correlationId, {
          bpp_id: target.bppId,
          bpp_uri: target.bppUri
        }),
        message: {
          order: {
            provider: { id: offer.becknProviderId || offer.sellerId },
            items: [{
              id: offer.becknItemId,
              quantity: { selected: { count: Number(offer.quantity || 1) } }
            }],
            fulfillments: offer.becknFulfillmentId ? [{ id: offer.becknFulfillmentId }] : []
          }
        }
      };

      const response = await this._postJson(this._joinUrl(target.bppUri, 'select'), payload);
      const callback = await this._callbackOrDirect('on_select', correlationId, response);
      this.transactions.set(correlationId, { offer, target, onSelect: callback });

      return {
        correlationId,
        status: 'SELECTED',
        order: callback?.message?.order,
        becknPayload: callback
      };
    }, () => mockBecknNetwork.select(offer, correlationId));
  }

  async init(offer, customerDetails, correlationId) {
    if (this.mode === 'mock') return mockBecknNetwork.init(offer, customerDetails, correlationId);

    return this._realOrFallback('init', async () => {
      const state = this.transactions.get(correlationId) || {};
      const target = state.target || this._targetFromOffer(offer);
      const baseOrder = state.onSelect?.message?.order || {
        provider: { id: offer.becknProviderId || offer.sellerId },
        items: [{ id: offer.becknItemId }]
      };

      const payload = {
        context: this._context('init', correlationId, {
          bpp_id: target.bppId,
          bpp_uri: target.bppUri
        }),
        message: {
          order: {
            ...baseOrder,
            billing: {
              name: customerDetails.orgName || 'Enterprise Buyer',
              address: { name: customerDetails.location || '' }
            }
          }
        }
      };

      const response = await this._postJson(this._joinUrl(target.bppUri, 'init'), payload);
      const callback = await this._callbackOrDirect('on_init', correlationId, response);
      this.transactions.set(correlationId, { ...state, offer, target, onInit: callback });

      return {
        correlationId,
        status: 'INITIALIZED',
        order: callback?.message?.order,
        becknPayload: callback
      };
    }, () => mockBecknNetwork.init(offer, customerDetails, correlationId));
  }
  async confirm(orderPayload, correlationId) {
    if (this.mode === 'mock') return mockBecknNetwork.confirm(orderPayload, correlationId);

    return this._realOrFallback('confirm', async () => {
      const state = this.transactions.get(correlationId) || {};
      const target = state.target || this._targetFromOffer(orderPayload);
      const order = state.onInit?.message?.order || state.onSelect?.message?.order;

      if (!order) {
        throw new Error('Cannot confirm before receiving on_init/on_select order state');
      }

      const payload = {
        context: this._context('confirm', correlationId, {
          bpp_id: target.bppId,
          bpp_uri: target.bppUri
        }),
        message: { order }
      };

      const response = await this._postJson(this._joinUrl(target.bppUri, 'confirm'), payload);
      const callback = await this._callbackOrDirect('on_confirm', correlationId, response);
      const confirmedOrder = callback?.message?.order || {};
      const fulfillment = confirmedOrder.fulfillments?.[0] || confirmedOrder.fulfillment || {};
      const becknOrderId = confirmedOrder.id;

      if (!becknOrderId) throw new Error('on_confirm did not include message.order.id');

      const normalized = {
        becknOrderId,
        status: confirmedOrder.state || 'CONFIRMED',
        fulfillmentStatus: fulfillment?.state?.descriptor?.code || 'ORDER_ACKNOWLEDGED',
        trackingUrl: fulfillment.tracking_url || confirmedOrder.tracking_url || null,
        estimatedDeliveryDate: fulfillment?.end?.time?.timestamp || null,
        confirmedAt: new Date().toISOString()
      };
      this.transactions.set(correlationId, {
        ...state,
        target,
        onConfirm: callback,
        becknOrderId
      });

      return {
        correlationId,
        becknOrderId,
        order: normalized,
        becknPayload: callback,
        networkContext: {
          bppId: target.bppId,
          bppUri: target.bppUri
        }
      };
    }, () => mockBecknNetwork.confirm(orderPayload, correlationId));
  }

  async status(orderId, correlationId, networkContext = null) {
    if (this.mode === 'mock') return mockBecknNetwork.status(orderId, correlationId);

    return this._realOrFallback('status', async () => {
      const state = this.transactions.get(correlationId) || {};
      const bppUri = networkContext?.bppUri || state.target?.bppUri;
      const bppId = networkContext?.bppId || state.target?.bppId;

      if (!bppUri) throw new Error('Missing bpp_uri for Beckn status request');

      const payload = {
        context: this._context('status', correlationId, {
          bpp_id: bppId,
          bpp_uri: bppUri
        }),
        message: { order_id: orderId }
      };
      const response = await this._postJson(this._joinUrl(bppUri, 'status'), payload);
      const callback = await this._callbackOrDirect('on_status', correlationId, response);
      const order = callback?.message?.order || {};
      const fulfillment = order.fulfillments?.[0] || order.fulfillment || {};

      return {
        correlationId,
        becknOrderId: order.id || orderId,
        status: order.state || 'UNKNOWN',
        fulfillmentState: fulfillment?.state?.descriptor?.code || null,
        location: fulfillment?.current_location?.descriptor?.name || null,
        lastUpdated: callback?.context?.timestamp || new Date().toISOString(),
        becknPayload: callback
      };
    }, () => mockBecknNetwork.status(orderId, correlationId));
  }
}

module.exports = new BecknProvider();
