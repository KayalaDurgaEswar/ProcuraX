const models = require('../models/mongoModels');

class Database {
  getModel(collection) {
    const map = {
      users: models.User,
      organizations: models.Organization,
      procurementRequests: models.ProcurementRequest,
      offers: models.Offer,
      negotiations: models.Negotiation,
      approvals: models.Approval,
      orders: models.Order,
      auditEvents: models.AuditEvent,
      memoryPatterns: models.MemoryPattern
    };
    return map[collection];
  }

  async find(collection, query = {}) {
    const Model = this.getModel(collection);
    if (!Model) return [];
    
    let filter = query;
    if (typeof query === 'function') {
      // Compatibility helper for legacy array predicate functions
      const all = await Model.find({}).lean();
      return all.filter(query);
    }
    return await Model.find(filter).lean();
  }

  async findOne(collection, query = {}) {
    const Model = this.getModel(collection);
    if (!Model) return null;

    if (typeof query === 'function') {
      const all = await Model.find({}).lean();
      return all.find(query) || null;
    }
    return await Model.findOne(query).lean();
  }

  async findById(collection, id) {
    return await this.findOne(collection, { id });
  }

  async insert(collection, item) {
    const Model = this.getModel(collection);
    if (!Model) throw new Error(`Collection ${collection} not found`);

    const record = await Model.create({
      ...item,
      createdAt: item.createdAt || new Date(),
      updatedAt: new Date()
    });
    return record.toObject ? record.toObject() : record;
  }

  async update(collection, id, updates) {
    const Model = this.getModel(collection);
    if (!Model) return null;

    const updated = await Model.findOneAndUpdate(
      { id },
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();

    return updated;
  }

  async delete(collection, id) {
    const Model = this.getModel(collection);
    if (!Model) return false;

    const res = await Model.deleteOne({ id });
    return res.deletedCount > 0;
  }
}

module.exports = new Database();
