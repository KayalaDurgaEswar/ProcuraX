const mongoose = require('mongoose');
const config = require('../config');

let memoryServer = null;

async function connectMemoryDB(label = 'fallback') {
  const { MongoMemoryServer } = require('mongodb-memory-server');
  memoryServer = await MongoMemoryServer.create({
    instance: { dbName: label === 'test' ? 'procurax-test' : 'procurax-fallback' }
  });
  const memUri = memoryServer.getUri();
  await mongoose.connect(memUri);
  console.log(`[MongoDB] Embedded ${label} database connected at ${memUri}`);
}

async function connectDB() {
  const primaryUri = config.db.mongoUri;

  if (process.env.NODE_ENV === 'test') {
    const isolatedUri =
      process.env.TEST_MONGODB_URI || 'mongodb://127.0.0.1:27017/procurax-test';
    try {
      await mongoose.connect(isolatedUri, { serverSelectionTimeoutMS: 2000 });
      console.log(`[MongoDB] Connected to isolated test database at ${isolatedUri}`);
    } catch (err) {
      console.warn(
        `[MongoDB] Test database unavailable (${err.message}). ` +
        'Launching embedded test database...'
      );
      await connectMemoryDB('test');
    }
  } else {
    try {
      await mongoose.connect(primaryUri, {
        serverSelectionTimeoutMS: 2000
      });
      console.log(`[MongoDB] Connected to primary database at ${primaryUri}`);
    } catch (err) {
      const fallbackAllowed =
        process.env.NODE_ENV !== 'production' ||
        process.env.ALLOW_EMBEDDED_DB_FALLBACK === 'true';

      if (!fallbackAllowed) {
        throw new Error(
          `Primary MongoDB connection failed in production: ${err.message}`
        );
      }

      console.warn(
        `[MongoDB] Could not connect to ${primaryUri} (${err.message}). ` +
        'Launching embedded development fallback database...'
      );
      await connectMemoryDB('fallback');
    }
  }

  await seedInitialMongoData();
}

async function seedInitialMongoData() {
  const models = require('../models/mongoModels');

  await models.Organization.updateOne(
    { id: 'org_acme_corp_001' },
    {
      $setOnInsert: {
        id: 'org_acme_corp_001',
        name: 'Acme Enterprise Solutions',
        code: 'ACME-ENT',
        budgetCapPaise: 5000000000
      }
    },
    { upsert: true }
  );

  const users = [
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
  ];

  for (const user of users) {
    await models.User.updateOne(
      { id: user.id },
      { $setOnInsert: user },
      { upsert: true }
    );
  }

  await models.MemoryPattern.updateOne(
    { category: 'laptop' },
    {
      $setOnInsert: {
        id: 'mem_001',
        category: 'laptop',
        preferredSellers: ['seller_techsupply_01', 'seller_omni_02'],
        averagePricePerUnitPaise: 9200000,
        avgDeliveryDays: 5,
        successfulProcurementsCount: 14,
        lastProcuredAt: new Date(Date.now() - 30 * 86400000)
      }
    },
    { upsert: true }
  );

  if (process.env.NODE_ENV !== 'test') {
    console.log('[MongoDB] Ensured default demo organization, users, and memory pattern exist.');
  }
}

async function disconnectDB() {
  if (process.env.NODE_ENV === 'test' && mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
  }

  await mongoose.disconnect();

  if (memoryServer) {
    await memoryServer.stop();
    memoryServer = null;
  }
}

module.exports = { connectDB, disconnectDB };
