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

function testDatabaseUri(primaryUri) {
  try {
    const parsed = new URL(primaryUri);
    parsed.pathname = '/procurax-test';
    return parsed.toString();
  } catch {
    return 'mongodb://localhost:27017/procurax-test';
  }
}

async function connectDB() {
  const primaryUri = config.db.mongoUri;

  if (process.env.NODE_ENV === 'test') {
    const isolatedUri = testDatabaseUri(primaryUri);
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
      console.warn(
        `[MongoDB] Could not connect to ${primaryUri} (${err.message}). ` +
        'Launching embedded fallback database...'
      );
      await connectMemoryDB('fallback');
    }
  }

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
