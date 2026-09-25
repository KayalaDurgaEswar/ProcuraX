const db = require('../../db/database');
const { v4: uuidv4 } = require('uuid');

class AuditService {
  /**
   * Logs an immutable procurement audit event into MongoDB
   */
  async logEvent(params) {
    const {
      procurementId,
      action,
      actor = 'SYSTEM_AGENT',
      previousState = null,
      newState = null,
      entityId = null,
      entityType = null,
      metadata = {},
      correlationId = null
    } = params;

    const event = {
      id: `audit_${uuidv4().substring(0, 8)}`,
      procurementId,
      correlationId: correlationId || uuidv4(),
      action,
      actor,
      previousState,
      newState,
      entityId,
      entityType,
      metadata,
      timestamp: new Date()
    };

    await db.insert('auditEvents', event);

    if (process.env.NODE_ENV !== 'test') {
      console.log(`[AUDIT LOG] [${new Date().toISOString()}] [${event.correlationId.substring(0, 8)}] ${action}: ${previousState || 'NONE'} -> ${newState || 'NONE'} (${actor})`);
    }

    return event;
  }

  /**
   * Queries audit trail for a given procurement ID from MongoDB
   */
  async getProcurementAuditTrail(procurementId) {
    const events = await db.find('auditEvents', { procurementId });
    return events.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  /**
   * Queries all recent system audit events from MongoDB
   */
  async getAllAuditEvents(limit = 100) {
    const events = await db.find('auditEvents', {});
    return events
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, limit);
  }
}

module.exports = new AuditService();
