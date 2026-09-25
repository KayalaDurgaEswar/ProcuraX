const crypto = require('crypto');
const config = require('../../config');

function parseSignatureHeader(value) {
  if (typeof value !== 'string' || !value.startsWith('Signature ')) {
    throw new Error('Missing or malformed Beckn Authorization signature');
  }

  const fields = {};
  const attributes = value.slice('Signature '.length).match(/([a-zA-Z_]+)="([^"]*)"/g) || [];

  for (const attribute of attributes) {
    const match = attribute.match(/^([a-zA-Z_]+)="([^"]*)"$/);
    if (match) fields[match[1]] = match[2];
  }

  const required = ['keyId', 'algorithm', 'created', 'expires', 'signature'];
  for (const field of required) {
    if (!fields[field]) throw new Error(`Authorization signature missing ${field}`);
  }

  const [subscriberId, uniqueKeyId, keyAlgorithm] = fields.keyId.split('|');
  if (!subscriberId || !uniqueKeyId || !keyAlgorithm) {
    throw new Error('Authorization keyId must be subscriber_id|unique_key_id|algorithm');
  }

  if (fields.algorithm.toLowerCase() !== 'ed25519' || keyAlgorithm.toLowerCase() !== 'ed25519') {
    throw new Error('Only Ed25519 Beckn callback signatures are supported');
  }

  const created = Number(fields.created);
  const expires = Number(fields.expires);
  if (!Number.isInteger(created) || !Number.isInteger(expires)) {
    throw new Error('Authorization created/expires must be Unix timestamps');
  }

  const now = Math.floor(Date.now() / 1000);
  if (created > now + 60) throw new Error('Authorization signature was created in the future');
  if (expires <= now) throw new Error('Authorization signature has expired');
  if (expires - created > config.beckn.signatureMaxAgeSeconds) {
    throw new Error('Authorization signature validity window is too large');
  }

  return {
    ...fields,
    subscriberId,
    uniqueKeyId,
    created,
    expires
  };
}

function publicKeyFromRawBase64(base64Key) {
  const raw = Buffer.from(base64Key, 'base64');
  if (raw.length !== 32) {
    throw new Error('Ed25519 public key must decode to 32 bytes');
  }

  // RFC 8410 SubjectPublicKeyInfo prefix for an Ed25519 raw public key.
  const spkiPrefix = Buffer.from('302a300506032b6570032100', 'hex');
  return crypto.createPublicKey({
    key: Buffer.concat([spkiPrefix, raw]),
    format: 'der',
    type: 'spki'
  });
}

function getConfiguredPublicKey(subscriberId, uniqueKeyId) {
  const keys = config.beckn.callbackPublicKeys || {};
  return keys[`${subscriberId}|${uniqueKeyId}`] || keys[subscriberId] || null;
}

function privateKeyFromBase64(base64Key) {
  const decoded = Buffer.from(base64Key || '', 'base64');
  if (!decoded.length) throw new Error('ONDC Ed25519 signing private key is missing');

  if (decoded.length === 32 || decoded.length === 64) {
    const seed = decoded.subarray(0, 32);
    const pkcs8Prefix = Buffer.from('302e020100300506032b657004220420', 'hex');
    return crypto.createPrivateKey({
      key: Buffer.concat([pkcs8Prefix, seed]),
      format: 'der',
      type: 'pkcs8'
    });
  }

  try {
    return crypto.createPrivateKey({ key: decoded, format: 'der', type: 'pkcs8' });
  } catch {
    throw new Error('ONDC Ed25519 signing private key must be base64 raw seed/secret or PKCS8 DER');
  }
}

function digestRawBody(rawBody) {
  return crypto.createHash('blake2b512').update(rawBody).digest('base64');
}

function signingString(created, expires, digest) {
  return [
    `(created): ${created}`,
    `(expires): ${expires}`,
    `digest: BLAKE-512=${digest}`
  ].join('\n');
}

function createAuthorizationHeader({
  rawBody,
  subscriberId,
  uniqueKeyId,
  privateKeyBase64,
  validitySeconds = 300
}) {
  if (!subscriberId) throw new Error('ONDC subscriber_id is required for outbound signing');
  if (!uniqueKeyId) throw new Error('ONDC unique_key_id is required for outbound signing');

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
  if (!body.length) throw new Error('Raw request body is required for ONDC signing');

  const created = Math.floor(Date.now() / 1000);
  const expires = created + Math.max(60, Math.min(Number(validitySeconds) || 300, 3600));
  const digest = digestRawBody(body);
  const signed = Buffer.from(signingString(created, expires, digest), 'utf8');
  const privateKey = privateKeyFromBase64(privateKeyBase64);
  const signature = crypto.sign(null, signed, privateKey).toString('base64');

  return (
    `Signature keyId="${subscriberId}|${uniqueKeyId}|ed25519",` +
    `algorithm="ed25519",created="${created}",expires="${expires}",` +
    `headers="(created) (expires) digest",signature="${signature}"`
  );
}

const registryKeyCache = new Map();

function findRegistrySigningKey(value, subscriberId, uniqueKeyId) {
  const queue = Array.isArray(value) ? [...value] : [value];
  let subscriberFallback = null;

  while (queue.length) {
    const current = queue.shift();
    if (!current || typeof current !== 'object') continue;
    if (Array.isArray(current)) {
      queue.push(...current);
      continue;
    }

    const currentSubscriber =
      current.subscriber_id || current.subscriberId || current.bpp_id || current.bap_id;
    const currentKeyId =
      current.unique_key_id || current.uniqueKeyId || current.ukId || current.br_id;
    const signingKey =
      current.signing_public_key || current.signingPublicKey || current.key_pair?.signing_public_key;

    if (currentSubscriber === subscriberId && signingKey) {
      if (!uniqueKeyId || !currentKeyId || String(currentKeyId) === String(uniqueKeyId)) {
        return signingKey;
      }
      subscriberFallback = subscriberFallback || signingKey;
    }

    queue.push(...Object.values(current).filter(item => item && typeof item === 'object'));
  }

  return subscriberFallback;
}

async function lookupRegistrySigningKey(subscriberId, uniqueKeyId, context = {}) {
  const cacheKey = `${subscriberId}|${uniqueKeyId || ''}`;
  const cached = registryKeyCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) return cached.publicKey;

  if (!config.beckn.registryUrl) throw new Error('ONDC registry URL is not configured');
  if (!config.beckn.uniqueKeyId || !config.beckn.signingPrivateKey) {
    throw new Error('ONDC registry lookup requires this BAP signing identity to be configured');
  }

  const lookupBody = JSON.stringify({
    country: context.country || config.beckn.country,
    domain: context.domain || config.beckn.domain,
    subscriber_id: subscriberId
  });
  const authorization = createAuthorizationHeader({
    rawBody: Buffer.from(lookupBody, 'utf8'),
    subscriberId: config.beckn.bapId,
    uniqueKeyId: config.beckn.uniqueKeyId,
    privateKeyBase64: config.beckn.signingPrivateKey
  });

  const response = await fetch(config.beckn.registryUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization
    },
    body: lookupBody
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    throw new Error(`ONDC registry lookup returned HTTP ${response.status}`);
  }

  const publicKey = findRegistrySigningKey(data, subscriberId, uniqueKeyId);
  if (!publicKey) {
    throw new Error(`ONDC registry did not return a signing key for ${subscriberId}|${uniqueKeyId}`);
  }

  registryKeyCache.set(cacheKey, {
    publicKey,
    expiresAt: Date.now() + 10 * 60 * 1000
  });
  return publicKey;
}

function verifyCallbackAuthorization({
  authorization,
  rawBody,
  expectedBppId = null,
  publicKeyBase64Override = null
}) {
  if (config.beckn.allowUnsignedCallbacks) {
    return { authenticated: false, bypassed: true };
  }

  const parsed = parseSignatureHeader(authorization);

  if (expectedBppId && parsed.subscriberId !== expectedBppId) {
    throw new Error('Authorization subscriber does not match expected bpp_id');
  }

  const publicKeyBase64 = publicKeyBase64Override ||
    getConfiguredPublicKey(parsed.subscriberId, parsed.uniqueKeyId);
  if (!publicKeyBase64) {
    throw new Error(
      `No trusted signing public key configured for ${parsed.subscriberId}|${parsed.uniqueKeyId}`
    );
  }

  const body = Buffer.isBuffer(rawBody) ? rawBody : Buffer.from(rawBody || '', 'utf8');
  if (!body.length) throw new Error('Raw callback body is required for signature verification');

  const digest = digestRawBody(body);
  const signed = Buffer.from(signingString(parsed.created, parsed.expires, digest), 'utf8');
  const signature = Buffer.from(parsed.signature, 'base64');
  const publicKey = publicKeyFromRawBase64(publicKeyBase64);

  const verified = crypto.verify(null, signed, publicKey, signature);
  if (!verified) throw new Error('Beckn callback signature verification failed');

  return {
    authenticated: true,
    subscriberId: parsed.subscriberId,
    uniqueKeyId: parsed.uniqueKeyId
  };
}

async function verifyCallbackAuthorizationWithRegistry({
  authorization,
  rawBody,
  expectedBppId = null,
  context = {}
}) {
  try {
    return verifyCallbackAuthorization({ authorization, rawBody, expectedBppId });
  } catch (err) {
    if (!/^No trusted signing public key configured/.test(err.message)) throw err;

    const parsed = parseSignatureHeader(authorization);
    const publicKey = await lookupRegistrySigningKey(
      parsed.subscriberId,
      parsed.uniqueKeyId,
      context
    );
    return verifyCallbackAuthorization({
      authorization,
      rawBody,
      expectedBppId,
      publicKeyBase64Override: publicKey
    });
  }
}

module.exports = {
  parseSignatureHeader,
  digestRawBody,
  signingString,
  createAuthorizationHeader,
  verifyCallbackAuthorization,
  verifyCallbackAuthorizationWithRegistry,
  lookupRegistrySigningKey,
  findRegistrySigningKey,
  publicKeyFromRawBase64,
  privateKeyFromBase64
};
