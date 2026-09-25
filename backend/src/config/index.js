const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

module.exports = {
  port: process.env.PORT || 3000,
  env: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'info',
  
  db: {
    mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/procurax'
  },

  ai: {
    provider: process.env.LLM_PROVIDER || 'ollama', // 'ollama' | 'mock'
    ollamaBaseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    model: process.env.OLLAMA_MODEL || 'qwen3-coder'
  },
  
  beckn: {
    defaultProvider: process.env.DEFAULT_NETWORK_PROVIDER || 'real',
    gatewayUrl: process.env.BECKN_GATEWAY_URL || 'https://gateway.beckn.io/protocol/v1',
    bapId: process.env.BECKN_BAP_ID || 'procure-ai-bap.domain.org',
    bapUri: process.env.BECKN_BAP_URI || 'https://api.yourdomain.com/beckn/bap',
    domain: process.env.BECKN_DOMAIN || 'nic2004:52110',
    country: process.env.BECKN_COUNTRY || 'IND',
    city: process.env.BECKN_CITY || 'std:040',
    protocolVersion: process.env.BECKN_PROTOCOL_VERSION || '1.1.0',
    requestTimeoutMs: parseInt(process.env.BECKN_REQUEST_TIMEOUT_MS || '5000', 10),
    callbackTimeoutMs: parseInt(process.env.BECKN_CALLBACK_TIMEOUT_MS || '7000', 10),
    callbackSettleMs: parseInt(process.env.BECKN_CALLBACK_SETTLE_MS || '350', 10),
    transactionTtlMs: parseInt(process.env.BECKN_TRANSACTION_TTL_MS || '600000', 10),
    allowMockFallback: process.env.BECKN_ALLOW_MOCK_FALLBACK === 'true',
    allowUnsignedCallbacks: process.env.BECKN_ALLOW_UNSIGNED_CALLBACKS === 'true',
    signatureMaxAgeSeconds: parseInt(process.env.BECKN_SIGNATURE_MAX_AGE_SECONDS || '3600', 10),
    callbackPublicKeys: (() => {
      try {
        return JSON.parse(process.env.BECKN_CALLBACK_PUBLIC_KEYS_JSON || '{}');
      } catch {
        throw new Error('BECKN_CALLBACK_PUBLIC_KEYS_JSON must be valid JSON');
      }
    })()
  },

  approvalPolicy: {
    // Stored in paise / cents (integers)
    autoApprovalLimitPaise: parseInt(process.env.AUTO_APPROVAL_THRESHOLD_INR || '50000', 10) * 100,
    managerApprovalLimitPaise: parseInt(process.env.MANAGER_APPROVAL_THRESHOLD_INR || '500000', 10) * 100
  },

  scoringWeights: {
    price: 0.35,
    deliveryTime: 0.25,
    sellerRating: 0.20,
    compliance: 0.10,
    specsMatch: 0.10
  },

  security: {
    apiKey: process.env.API_KEY || 'procure_ai_secret_key_2026',
    defaultOrgId: process.env.DEFAULT_ORG_ID || 'org_acme_corp_001',
    defaultUserId: process.env.DEFAULT_USER_ID || 'user_procurement_lead'
  }
};
