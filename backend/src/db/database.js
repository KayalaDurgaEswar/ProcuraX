const fs = require('fs');
const path = require('path');

class Database {
  constructor() {
    this.dbPath = path.join(__dirname, '../../data/db.json');
    this.data = {
      users: [],
      organizations: [],
      procurementRequests: [],
      procurementItems: [],
      sellers: [],
      offers: [],
      negotiations: [],
      approvals: [],
      orders: [],
      auditEvents: [],
      agentExecutions: [],
      memoryPatterns: []
    };
    this.init();
  }

  init() {
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dbPath)) {
      try {
        const raw = fs.readFileSync(this.dbPath, 'utf8');
        this.data = { ...this.data, ...JSON.parse(raw) };
      } catch (err) {
        console.error('Error loading db file, re-initializing:', err.message);
        this.seedInitialData();
      }
    } else {
      this.seedInitialData();
    }
  }

  seedInitialData() {
    this.data.organizations = [
      {
        id: 'org_acme_corp_001',
        name: 'Acme Enterprise Solutions',
        code: 'ACME-ENT',
        budgetCapPaise: 5000000000, // ₹5,00,00,000 in paise
        createdAt: new Date().toISOString()
      }
    ];

    this.data.users = [
      {
        id: 'user_procurement_lead',
        orgId: 'org_acme_corp_001',
        name: 'Sarah Connor',
        email: 'sarah.connor@acme.com',
        role: 'Procurement Manager',
        approvalLimitPaise: 50000000, // ₹5,00,000 in paise
        createdAt: new Date().toISOString()
      },
      {
        id: 'user_cfo',
        orgId: 'org_acme_corp_001',
        name: 'David Miller',
        email: 'david.cfo@acme.com',
        role: 'Chief Financial Officer',
        approvalLimitPaise: 1000000000, // ₹1,00,00,000 in paise
        createdAt: new Date().toISOString()
      }
    ];

    // Seed historical memory patterns for baseline learning
    this.data.memoryPatterns = [
      {
        id: 'mem_001',
        category: 'laptop',
        preferredSellers: ['seller_techsupply_01', 'seller_omni_02'],
        averagePricePerUnitPaise: 9200000, // ₹92,000
        avgDeliveryDays: 5,
        successfulProcurementsCount: 14,
        lastProcuredAt: new Date(Date.now() - 30 * 86400000).toISOString()
      }
    ];

    this.save();
  }

  save() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.data, null, 2), 'utf8');
    } catch (err) {
      console.error('Failed to write db to disk:', err.message);
    }
  }

  // Generic Helpers
  find(collection, predicate) {
    if (!this.data[collection]) return [];
    return this.data[collection].filter(predicate);
  }

  findOne(collection, predicate) {
    if (!this.data[collection]) return null;
    return this.data[collection].find(predicate) || null;
  }

  findById(collection, id) {
    return this.findOne(collection, item => item.id === id);
  }

  insert(collection, item) {
    if (!this.data[collection]) {
      this.data[collection] = [];
    }
    const record = {
      ...item,
      createdAt: item.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    this.data[collection].push(record);
    this.save();
    return record;
  }

  update(collection, id, updates) {
    if (!this.data[collection]) return null;
    const index = this.data[collection].findIndex(item => item.id === id);
    if (index === -1) return null;

    const current = this.data[collection][index];
    const updated = {
      ...current,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.data[collection][index] = updated;
    this.save();
    return updated;
  }

  delete(collection, id) {
    if (!this.data[collection]) return false;
    const initialLen = this.data[collection].length;
    this.data[collection] = this.data[collection].filter(item => item.id !== id);
    const deleted = this.data[collection].length < initialLen;
    if (deleted) this.save();
    return deleted;
  }
}

module.exports = new Database();
