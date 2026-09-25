const mongoose = require('mongoose');
const config = require('../config');

let memoryServer = null;

async function connectDB() {
  const primaryUri = config.db.mongoUri;

  try {
    // Attempt connecting to specified MongoDB server
    await mongoose.connect(primaryUri, {
      serverSelectionTimeoutMS: 2000
    });
    console.log(`[MongoDB] Connected to primary database at ${primaryUri}`);
  } catch (err) {
    console.warn(`[MongoDB] Could not connect to ${primaryUri} (${err.message}). Launching embedded MongoDB server...`);
    
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      memoryServer = await MongoMemoryServer.create();
      const memUri = memoryServer.getUri();
      await mongoose.connect(memUri);
      console.log(`[MongoDB] Embedded MongoMemoryServer connected successfully at ${memUri}`);
    } catch (memErr) {
      console.error('[MongoDB] Failed to start embedded MongoDB server:', memErr.message);
      throw memErr;
    }
  }

  // Seed default organizations and users if empty
  const models = require('../models/mongoModels');
  const userCount = await models.User.countDocuments();
  if (userCount === 0) {
    await seedInitialMongoData();
  }
}

async function seedInitialMongoData() {
  const models = require('../models/mongoModels');

  await models.Organization.create({
    id: 'org_acme_corp_001',
    name: 'Acme Enterprise Solutions',
    code: 'ACME-ENT',
    budgetCapPaise: 5000000000
  });

  await models.User.create([
    {
      id: 'user_procurement_lead',
      orgId: 'org_acme_corp_001',
      name: 'Sarah Connor',
      email: 'sarah.connor@acme.com',
      role: 'Procurement Manager',
      approvalLimitPaise: 50000000
    },
    {
      id: 'user_cfo',
      orgId: 'org_acme_corp_001',
      name: 'David Miller',
      email: 'david.cfo@acme.com',
      role: 'Chief Financial Officer',
      approvalLimitPaise: 1000000000
    }
  ]);

  await models.MemoryPattern.create({
    id: 'mem_001',
    category: 'laptop',
    preferredSellers: ['seller_techsupply_01', 'seller_omni_02'],
    averagePricePerUnitPaise: 9200000,
    avgDeliveryDays: 5,
    successfulProcurementsCount: 14,
    lastProcuredAt: new Date(Date.now() - 30 * 86400000)
  });

  console.log('[MongoDB] Seeded default Users, Organizations & Memory patterns into MongoDB.');
}

module.exports = { connectDB };
