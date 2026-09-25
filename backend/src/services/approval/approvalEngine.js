const config = require('../../config');

class ApprovalEngine {
  constructor() {
    this.autoApprovalLimitPaise = config.approvalPolicy.autoApprovalLimitPaise;
    this.managerApprovalLimitPaise = config.approvalPolicy.managerApprovalLimitPaise;
  }

  evaluateRequiredApproval(totalPricePaise) {
    const amountINR = totalPricePaise / 100;

    if (totalPricePaise <= this.autoApprovalLimitPaise) {
      return {
        level: 'AUTO_APPROVED',
        requiresHumanApproval: false,
        requiredRole: 'SYSTEM',
        description: `Order amount (₹${amountINR.toLocaleString('en-IN')}) is within automatic approval threshold (₹${(this.autoApprovalLimitPaise / 100).toLocaleString('en-IN')}).`
      };
    }

    if (totalPricePaise <= this.managerApprovalLimitPaise) {
      return {
        level: 'MANAGER_APPROVAL',
        requiresHumanApproval: true,
        requiredRole: 'Procurement Manager',
        description: `Order amount (₹${amountINR.toLocaleString('en-IN')}) requires Procurement Manager approval (Threshold: ₹${(this.autoApprovalLimitPaise / 100).toLocaleString('en-IN')} - ₹${(this.managerApprovalLimitPaise / 100).toLocaleString('en-IN')}).`
      };
    }

    return {
      level: 'ENTERPRISE_BOARD_APPROVAL',
      requiresHumanApproval: true,
      requiredRole: 'Chief Financial Officer / Procurement Board',
      description: `High-value order (₹${amountINR.toLocaleString('en-IN')}) requires CFO / Enterprise Procurement Board approval (> ₹${(this.managerApprovalLimitPaise / 100).toLocaleString('en-IN')}).`
    };
  }

  canUserApprove(userRole, userLimitPaise, orderAmountPaise) {
    const normalizedRole = String(userRole || '').trim().toLowerCase();
    const cfoRoles = new Set([
      'chief financial officer',
      'cfo',
      'admin',
      'finance lead',
      'procurement board'
    ]);
    const isCfo = cfoRoles.has(normalizedRole);
    const isManager =
      normalizedRole === 'procurement manager' ||
      normalizedRole === 'manager' ||
      normalizedRole === 'procurement lead';

    if (orderAmountPaise > this.managerApprovalLimitPaise) {
      return isCfo
        ? { allowed: true, reason: 'CFO/Board authority satisfies enterprise approval policy' }
        : {
            allowed: false,
            reason: `CFO/Board approval is required for ₹${(orderAmountPaise / 100).toLocaleString('en-IN')}`
          };
    }

    if (orderAmountPaise > this.autoApprovalLimitPaise) {
      if (!isManager && !isCfo) {
        return {
          allowed: false,
          reason: 'Procurement Manager or CFO authority is required for this order'
        };
      }

      if (Number(userLimitPaise || 0) < orderAmountPaise) {
        return {
          allowed: false,
          reason: `Approver limit (₹${(Number(userLimitPaise || 0) / 100).toLocaleString('en-IN')}) is insufficient for order amount (₹${(orderAmountPaise / 100).toLocaleString('en-IN')})`
        };
      }

      return { allowed: true, reason: 'Approver role and monetary limit satisfy policy' };
    }

    return Number(userLimitPaise || 0) >= orderAmountPaise
      ? { allowed: true, reason: 'Approver monetary limit satisfies policy' }
      : {
          allowed: false,
          reason: `Approver limit (₹${(Number(userLimitPaise || 0) / 100).toLocaleString('en-IN')}) is insufficient for order amount (₹${(orderAmountPaise / 100).toLocaleString('en-IN')})`
        };
  }
}

module.exports = new ApprovalEngine();
