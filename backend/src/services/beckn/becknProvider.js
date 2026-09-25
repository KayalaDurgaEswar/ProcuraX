const CommerceNetworkProvider = require('./commerceNetwork');
const mockBecknNetwork = require('./mockNetwork');
const callbackStore = require('./callbackStore');
const { validateBecknPayload } = require('./schemaValidator');
const { createAuthorizationHeader } = require('./authVerifier');
const config = require('../../config');
const { v4: uuidv4 } = require('uuid');

class BecknProvider extends CommerceNetworkProvider {
  constructor() {
    super('BecknProvider');
    this.mode = config.beckn.defaultProvider;
    this.gatewayUrl = config.beckn.gatewayUrl;
    this.transactions = new Map();
    this.transactionTimers = new Map();
  }

  _setTransaction(correlationId, state) {
    const currentTimer = this.transactionTimers.get(correlationId);
    if (currentTimer) clearTimeout(currentTimer);

    this.transactions.set(correlationId, state);
    const timer = setTimeout(
      () => this._clearTransaction(correlationId),
      config.beckn.transactionTtlMs
    );
    if (typeof timer.unref === 'function') timer.unref();
    this.transactionTimers.set(correlationId, timer);
    return state;
  }

  _getOrCreateTransaction(correlationId, transactionId = null) {
    const existing = this.transactions.get(correlationId);
    if (existing) return existing;
    return this._setTransaction(correlationId, {
      transactionId: transactionId || uuidv4()
    });
  }

  _clearTransaction(correlationId) {
    const timer = this.transactionTimers.get(correlationId);
    if (timer) clearTimeout(timer);
    this.transactionTimers.delete(correlationId);
    this.transactions.delete(correlationId);
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
      ttl: 'PT30S',
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

  async _postJson(url, payload, action) {
    validateBecknPayload(action, payload, { requireBpp: action !== 'search' });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), config.beckn.requestTimeoutMs);

    try {
      const body = JSON.stringify(payload);
      const headers = { 'Content-Type': 'application/json' };

      if (this.mode === 'real') {
        headers.Authorization = createAuthorizationHeader({
          rawBody: Buffer.from(body, 'utf8'),
          subscriberId: config.beckn.bapId,
          uniqueKeyId: config.beckn.uniqueKeyId,
          privateKeyBase64: config.beckn.signingPrivateKey
        });
      }

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
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
      validateBecknPayload(action, response);
      if (!collect) {
        callbackStore.complete(action, transactionId);
        return response;
      }
      callbackStore.record(action, response);
    }

    if (collect) {
      const callbacks = await callbackStore.collect(
        action,
        transactionId,
        config.beckn.callbackTimeoutMs,
        config.beckn.callbackSettleMs
      );
      callbacks.forEach(payload => validateBecknPayload(action, payload));
      return callbacks;
    }

    const callback = await callbackStore.waitFor(
      action,
      transactionId,
      config.beckn.callbackTimeoutMs
    );
    validateBecknPayload(action, callback);
    return callback;
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
    const offersByKey = new Map();
    const quantity = Number(intent.quantity || 1);

    for (const payload of payloads) {
      const context = payload?.context || {};
      const providers = payload?.message?.catalog?.providers || [];

      for (const provider of providers) {
        if (provider.itemTitle && provider.unitPricePaise) {
          const key = [
            context.bpp_id || 'sandbox',
            provider.sellerId || provider.id || 'seller',
            provider.id || provider.itemTitle
          ].join('|');

          if (!offersByKey.has(key)) {
            offersByKey.set(key, {
              ...provider,
              quantity: provider.quantity || quantity,
              becknBppId: context.bpp_id || provider.becknBppId,
              becknBppUri: context.bpp_uri || provider.becknBppUri,
              becknContext: { ...(provider.becknContext || {}), ...context }
            });
          }
          continue;
        }

        const items = provider.items || [];
        for (const item of items) {
          const unitPriceINR = Number(item?.price?.value);
          if (!Number.isFinite(unitPriceINR) || unitPriceINR <= 0) continue;

          const key = [
            context.bpp_id || 'unknown_bpp',
            provider.id || 'provider',
            item.id || item?.descriptor?.name || 'item'
          ].join('|');
          if (offersByKey.has(key)) continue;

          const unitPricePaise = Math.round(unitPriceINR * 100);
          const fulfillment = provider.fulfillments?.[0] ||
            payload?.message?.catalog?.fulfillments?.[0] || {};

          offersByKey.set(key, {
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

    const offers = [...offersByKey.values()];
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
      const state = this._getOrCreateTransaction(correlationId);
      const payload = {
        context: this._context('search', state.transactionId),
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

      callbackStore.expect('on_search', state.transactionId, {
        messageId: payload.context.message_id,
        multi: true,
        ttlMs: config.beckn.callbackTimeoutMs + config.beckn.callbackSettleMs + 1000
      });

      const response = await this._postJson(
        this._joinUrl(this.gatewayUrl, 'search'),
        payload,
        'search'
      );
      const callbacks = await this._callbackOrDirect(
        'on_search',
        state.transactionId,
        response,
        true
      );
      const offers = this._mapSearchCallbacks(callbacks, intent, correlationId);

      this._setTransaction(correlationId, {
        ...state,
        transactionId: state.transactionId,
        searchMessageId: payload.context.message_id
      });

      return {
        correlationId,
        becknTransactionId: state.transactionId,
        provider: this.name,
        callbackCount: callbacks.length,
        bppCount: new Set(callbacks.map(item => item?.context?.bpp_id).filter(Boolean)).size,
        offers
      };
    }, () => mockBecknNetwork.search(intent, correlationId));
  }

  async select(offer, correlationId) {
    if (this.mode === 'mock') return mockBecknNetwork.select(offer, correlationId);

    return this._realOrFallback('select', async () => {
      const target = this._targetFromOffer(offer);
      const protocolTransactionId = offer?.becknContext?.transaction_id || null;
      const state = this._getOrCreateTransaction(correlationId, protocolTransactionId);
      const payload = {
        context: this._context('select', state.transactionId, {
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

      callbackStore.expect('on_select', state.transactionId, {
        messageId: payload.context.message_id,
        bppId: target.bppId,
        bppUri: target.bppUri,
        ttlMs: config.beckn.callbackTimeoutMs + 1000
      });

      const response = await this._postJson(
        this._joinUrl(target.bppUri, 'select'),
        payload,
        'select'
      );
      const callback = await this._callbackOrDirect(
        'on_select',
        state.transactionId,
        response
      );

      this._setTransaction(correlationId, {
        ...state,
        transactionId: state.transactionId,
        offer,
        target,
        onSelect: callback
      });

      return {
        correlationId,
        becknTransactionId: state.transactionId,
        status: 'SELECTED',
        order: callback?.message?.order,
        becknPayload: callback
      };
    }, () => mockBecknNetwork.select(offer, correlationId));
  }

  async init(offer, customerDetails, correlationId) {
    if (this.mode === 'mock') return mockBecknNetwork.init(offer, customerDetails, correlationId);

    return this._realOrFallback('init', async () => {
      const fallbackTransactionId = offer?.becknContext?.transaction_id || null;
      const state = this._getOrCreateTransaction(correlationId, fallbackTransactionId);
      const target = state.target || this._targetFromOffer(offer);
      const baseOrder = state.onSelect?.message?.order || {
        provider: { id: offer.becknProviderId || offer.sellerId },
        items: [{ id: offer.becknItemId }]
      };

      const payload = {
        context: this._context('init', state.transactionId, {
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

      callbackStore.expect('on_init', state.transactionId, {
        messageId: payload.context.message_id,
        bppId: target.bppId,
        bppUri: target.bppUri,
        ttlMs: config.beckn.callbackTimeoutMs + 1000
      });

      const response = await this._postJson(
        this._joinUrl(target.bppUri, 'init'),
        payload,
        'init'
      );
      const callback = await this._callbackOrDirect(
        'on_init',
        state.transactionId,
        response
      );

      this._setTransaction(correlationId, {
        ...state,
        transactionId: state.transactionId,
        offer,
        target,
        onInit: callback
      });

      return {
        correlationId,
        becknTransactionId: state.transactionId,
        status: 'INITIALIZED',
        order: callback?.message?.order,
        becknPayload: callback
      };
    }, () => mockBecknNetwork.init(offer, customerDetails, correlationId));
  }
  async confirm(orderPayload, correlationId) {
    if (this.mode === 'mock') return mockBecknNetwork.confirm(orderPayload, correlationId);

    return this._realOrFallback('confirm', async () => {
      const fallbackTransactionId = orderPayload?.becknContext?.transaction_id || null;
      const state = this._getOrCreateTransaction(correlationId, fallbackTransactionId);
      const target = state.target || this._targetFromOffer(orderPayload);
      const order = state.onInit?.message?.order || state.onSelect?.message?.order;

      if (!order) {
        throw new Error('Cannot confirm before receiving on_init/on_select order state');
      }

      const payload = {
        context: this._context('confirm', state.transactionId, {
          bpp_id: target.bppId,
          bpp_uri: target.bppUri
        }),
        message: { order }
      };

      callbackStore.expect('on_confirm', state.transactionId, {
        messageId: payload.context.message_id,
        bppId: target.bppId,
        bppUri: target.bppUri,
        ttlMs: config.beckn.callbackTimeoutMs + 1000
      });

      const response = await this._postJson(
        this._joinUrl(target.bppUri, 'confirm'),
        payload,
        'confirm'
      );
      const callback = await this._callbackOrDirect(
        'on_confirm',
        state.transactionId,
        response
      );
      const confirmedOrder = callback?.message?.order || {};
      const fulfillment = confirmedOrder.fulfillments?.[0] || confirmedOrder.fulfillment || {};
      const becknOrderId = confirmedOrder.id;

      if (!becknOrderId) throw new Error('on_confirm did not include message.order.id');

      const quoteValue = Number(
        confirmedOrder?.quote?.price?.value ??
        state.onInit?.message?.order?.quote?.price?.value ??
        state.onSelect?.message?.order?.quote?.price?.value
      );
      const finalTotalPricePaise = Number.isFinite(quoteValue) && quoteValue > 0
        ? Math.round(quoteValue * 100)
        : null;

      const normalized = {
        becknOrderId,
        status: confirmedOrder.state || 'CONFIRMED',
        fulfillmentStatus: fulfillment?.state?.descriptor?.code || 'ORDER_ACKNOWLEDGED',
        trackingUrl: fulfillment.tracking_url || confirmedOrder.tracking_url || null,
        estimatedDeliveryDate: fulfillment?.end?.time?.timestamp || null,
        finalTotalPricePaise,
        finalTotalPriceINR: finalTotalPricePaise ? finalTotalPricePaise / 100 : null,
        confirmedAt: new Date().toISOString()
      };

      const networkContext = {
        bppId: target.bppId,
        bppUri: target.bppUri,
        transactionId: state.transactionId
      };

      this._clearTransaction(correlationId);

      return {
        correlationId,
        becknOrderId,
        order: normalized,
        becknPayload: callback,
        networkContext
      };
    }, () => mockBecknNetwork.confirm(orderPayload, correlationId));
  }

  async status(orderId, correlationId, networkContext = null) {
    if (this.mode === 'mock') return mockBecknNetwork.status(orderId, correlationId);

    return this._realOrFallback('status', async () => {
      const state = this.transactions.get(correlationId) || {};
      const bppUri = networkContext?.bppUri || state.target?.bppUri;
      const bppId = networkContext?.bppId || state.target?.bppId;
      const transactionId =
        networkContext?.transactionId || state.transactionId || uuidv4();

      if (!bppUri || !bppId) {
        throw new Error('Missing bpp_id/bpp_uri for Beckn status request');
      }

      const payload = {
        context: this._context('status', transactionId, {
          bpp_id: bppId,
          bpp_uri: bppUri
        }),
        message: { order_id: orderId }
      };

      callbackStore.expect('on_status', transactionId, {
        messageId: payload.context.message_id,
        bppId,
        bppUri,
        ttlMs: config.beckn.callbackTimeoutMs + 1000
      });

      const response = await this._postJson(
        this._joinUrl(bppUri, 'status'),
        payload,
        'status'
      );
      const callback = await this._callbackOrDirect('on_status', transactionId, response);
      const order = callback?.message?.order || {};
      const fulfillment = order.fulfillments?.[0] || order.fulfillment || {};

      return {
        correlationId,
        becknTransactionId: transactionId,
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
