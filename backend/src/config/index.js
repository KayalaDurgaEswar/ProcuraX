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
    defaultProvider: process.env.DEFAULT_NETWORK_PROVIDER || 'mock',
    gatewayUrl: process.env.BECKN_GATEWAY_URL || 'http://localhost:3000/beckn/gateway',
    bapId: process.env.BECKN_BAP_ID || 'procure-ai-bap.domain.org',
    bapUri: process.env.BECKN_BAP_URI || 'http://localhost:3000/beckn/bap'
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
