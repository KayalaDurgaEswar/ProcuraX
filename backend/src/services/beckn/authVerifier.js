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

function verifyCallbackAuthorization({
  authorization,
  rawBody,
  expectedBppId = null
}) {
  if (config.beckn.allowUnsignedCallbacks) {
    return { authenticated: false, bypassed: true };
  }

  const parsed = parseSignatureHeader(authorization);

  if (expectedBppId && parsed.subscriberId !== expectedBppId) {
    throw new Error('Authorization subscriber does not match expected bpp_id');
  }

  const publicKeyBase64 = getConfiguredPublicKey(parsed.subscriberId, parsed.uniqueKeyId);
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

module.exports = {
  parseSignatureHeader,
  digestRawBody,
  signingString,
  verifyCallbackAuthorization,
  publicKeyFromRawBase64
};
