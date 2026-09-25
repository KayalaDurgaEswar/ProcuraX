const config = require('../../config');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ISO_DURATION_PATTERN = /^P(?!$)(?:\d+Y)?(?:\d+M)?(?:\d+D)?(?:T(?=\d)(?:\d+H)?(?:\d+M)?(?:\d+(?:\.\d+)?S)?)?$/;

class BecknSchemaValidationError extends Error {
  constructor(action, errors) {
    super(`Invalid Beckn ${action} payload: ${errors.join('; ')}`);
    this.name = 'BecknSchemaValidationError';
    this.action = action;
    this.errors = errors;
  }
}

function isObject(value) {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requiredString(value, path, errors) {
  if (typeof value !== 'string' || !value.trim()) {
    errors.push(`${path} must be a non-empty string`);
    return false;
  }
  return true;
}

function validateUrl(value, path, errors) {
  if (!requiredString(value, path, errors)) return;
  try {
    const url = new URL(value);
    if (!['http:', 'https:'].includes(url.protocol)) {
      errors.push(`${path} must use http or https`);
    }
  } catch {
    errors.push(`${path} must be a valid URL`);
  }
}

function validateUuid(value, path, errors) {
  if (!requiredString(value, path, errors)) return;
  if (!UUID_PATTERN.test(value)) {
    errors.push(`${path} must be a UUID`);
  }
}

function validateTimestamp(value, path, errors) {
  if (!requiredString(value, path, errors)) return;
  if (!/^\d{4}-\d{2}-\d{2}T/.test(value) || Number.isNaN(Date.parse(value))) {
    errors.push(`${path} must be an RFC3339/ISO-8601 date-time`);
  }
}

function validateContext(context, expectedAction, errors, options = {}) {
  if (!isObject(context)) {
    errors.push('context must be an object');
    return;
  }

  requiredString(context.domain, 'context.domain', errors);
  requiredString(context.country, 'context.country', errors);
  requiredString(context.city, 'context.city', errors);
  requiredString(context.action, 'context.action', errors);

  if (context.action && context.action !== expectedAction) {
    errors.push(`context.action must be ${expectedAction}`);
  }

  const version = context.core_version || context.version;
  if (!requiredString(version, 'context.core_version or context.version', errors)) {
    // requiredString records the error.
  } else if (version !== config.beckn.protocolVersion) {
    errors.push(
      `context protocol version must be ${config.beckn.protocolVersion}; received ${version}`
    );
  }

  requiredString(context.bap_id, 'context.bap_id', errors);
  validateUrl(context.bap_uri, 'context.bap_uri', errors);
  validateUuid(context.transaction_id, 'context.transaction_id', errors);
  validateUuid(context.message_id, 'context.message_id', errors);
  validateTimestamp(context.timestamp, 'context.timestamp', errors);

  if (context.ttl !== undefined &&
      (typeof context.ttl !== 'string' || !ISO_DURATION_PATTERN.test(context.ttl))) {
    errors.push('context.ttl must be an ISO-8601 duration');
  }

  if (options.requireBpp) {
    requiredString(context.bpp_id, 'context.bpp_id', errors);
    validateUrl(context.bpp_uri, 'context.bpp_uri', errors);
  }
}

function validateOrder(order, errors, options = {}) {
  if (!isObject(order)) {
    errors.push('message.order must be an object');
    return;
  }

  if (options.requireOrderId) {
    requiredString(order.id, 'message.order.id', errors);
  }

  if (options.requireSelection) {
    if (!isObject(order.provider)) {
      errors.push('message.order.provider must be an object');
    } else {
      requiredString(order.provider.id, 'message.order.provider.id', errors);
    }

    if (!Array.isArray(order.items) || order.items.length === 0) {
      errors.push('message.order.items must be a non-empty array');
    } else {
      order.items.forEach((item, index) => {
        if (!isObject(item)) {
          errors.push(`message.order.items[${index}] must be an object`);
          return;
        }
        requiredString(item.id, `message.order.items[${index}].id`, errors);
      });
    }
  }
}

function validateCatalog(catalog, errors) {
  if (!isObject(catalog)) {
    errors.push('message.catalog must be an object');
    return;
  }

  if (!Array.isArray(catalog.providers)) {
    errors.push('message.catalog.providers must be an array');
    return;
  }

  catalog.providers.forEach((provider, providerIndex) => {
    if (!isObject(provider)) {
      errors.push(`message.catalog.providers[${providerIndex}] must be an object`);
      return;
    }

    // ProcuraX's local sandbox returns already-normalized offer objects.
    if (provider.itemTitle && provider.unitPricePaise !== undefined) {
      requiredString(provider.sellerId, `providers[${providerIndex}].sellerId`, errors);
      requiredString(provider.itemTitle, `providers[${providerIndex}].itemTitle`, errors);
      if (!Number.isFinite(Number(provider.unitPricePaise)) || Number(provider.unitPricePaise) <= 0) {
        errors.push(`providers[${providerIndex}].unitPricePaise must be positive`);
      }
      return;
    }

    requiredString(provider.id, `providers[${providerIndex}].id`, errors);
    if (!Array.isArray(provider.items)) {
      errors.push(`providers[${providerIndex}].items must be an array`);
      return;
    }

    provider.items.forEach((item, itemIndex) => {
      if (!isObject(item)) {
        errors.push(`providers[${providerIndex}].items[${itemIndex}] must be an object`);
        return;
      }
      requiredString(
        item.id,
        `providers[${providerIndex}].items[${itemIndex}].id`,
        errors
      );
      if (!isObject(item.price)) {
        errors.push(`providers[${providerIndex}].items[${itemIndex}].price must be an object`);
      } else {
        requiredString(
          item.price.currency,
          `providers[${providerIndex}].items[${itemIndex}].price.currency`,
          errors
        );
        if (!Number.isFinite(Number(item.price.value)) || Number(item.price.value) <= 0) {
          errors.push(
            `providers[${providerIndex}].items[${itemIndex}].price.value must be positive`
          );
        }
      }
    });
  });
}

function validateMessage(action, message, errors) {
  if (!isObject(message)) {
    errors.push('message must be an object');
    return;
  }

  switch (action) {
    case 'search':
      if (!isObject(message.intent)) {
        errors.push('message.intent must be an object');
      }
      break;
    case 'on_search':
      validateCatalog(message.catalog, errors);
      break;
    case 'select':
      validateOrder(message.order, errors, { requireSelection: true });
      break;
    case 'on_select':
    case 'init':
    case 'on_init':
      validateOrder(message.order, errors);
      break;
    case 'confirm':
      validateOrder(message.order, errors);
      break;
    case 'on_confirm':
      validateOrder(message.order, errors, { requireOrderId: true });
      break;
    case 'status':
      requiredString(message.order_id, 'message.order_id', errors);
      break;
    case 'on_status':
      validateOrder(message.order, errors, { requireOrderId: true });
      break;
    default:
      errors.push(`Unsupported Beckn action: ${action}`);
  }
}

function validateBecknPayload(action, payload, options = {}) {
  const errors = [];

  if (!isObject(payload)) {
    throw new BecknSchemaValidationError(action, ['payload must be an object']);
  }

  const callback = action.startsWith('on_');
  validateContext(payload.context, action, errors, {
    requireBpp: callback || Boolean(options.requireBpp)
  });
  validateMessage(action, payload.message, errors);

  if (errors.length) {
    throw new BecknSchemaValidationError(action, errors);
  }

  return payload;
}

module.exports = {
  BecknSchemaValidationError,
  validateBecknPayload,
  validateContext
};
