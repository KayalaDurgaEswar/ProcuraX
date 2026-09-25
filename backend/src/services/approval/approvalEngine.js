const config = require('../../config');

class ApprovalEngine {
  constructor() {
    this.autoApprovalLimitPaise = config.approvalPolicy.autoApprovalLimitPaise;
    this.managerApprovalLimitPaise = config.approvalPolicy.managerApprovalLimitPaise;
  }

  /**
   * Determines required approval level for a procurement order
   */
  evaluateRequiredApproval(totalPricePaise) {
    const amountINR = totalPricePaise / 100;

    if (totalPricePaise <= this.autoApprovalLimitPaise) {
      return {
        level: 'AUTO_APPROVED',
        requiresHumanApproval: false,
        requiredRole: 'SYSTEM',
        description: `Order amount (₹${amountINR.toLocaleString('en-IN')}) is within automatic approval threshold (₹${(this.autoApprovalLimitPaise / 100).toLocaleString('en-IN')}).`
      };
    } else if (totalPricePaise <= this.managerApprovalLimitPaise) {
      return {
        level: 'MANAGER_APPROVAL',
        requiresHumanApproval: true,
        requiredRole: 'Procurement Manager',
        description: `Order amount (₹${amountINR.toLocaleString('en-IN')}) requires Procurement Manager approval (Threshold: ₹${(this.autoApprovalLimitPaise / 100).toLocaleString('en-IN')} - ₹${(this.managerApprovalLimitPaise / 100).toLocaleString('en-IN')}).`
      };
    } else {
      return {
        level: 'ENTERPRISE_BOARD_APPROVAL',
        requiresHumanApproval: true,
        requiredRole: 'Chief Financial Officer / Procurement Board',
        description: `High-value order (₹${amountINR.toLocaleString('en-IN')}) requires CFO / Enterprise Procurement Board approval (> ₹${(this.managerApprovalLimitPaise / 100).toLocaleString('en-IN')}).`
      };
    }
  }

  /**
   * Validates if a specific user role has permission to grant approval
   */
  canUserApprove(userRole, userLimitPaise, orderAmountPaise) {
    if (userRole === 'Chief Financial Officer' || userRole === 'CFO' || userRole === 'Admin') {
      return { allowed: true, reason: 'Supervisory override granted by CFO/Admin' };
    }

    if (userLimitPaise >= orderAmountPaise) {
      return { allowed: true, reason: `User limit (₹${(userLimitPaise / 100).toLocaleString('en-IN')}) meets order amount` };
    }

    return {
      allowed: false,
      reason: `User limit (₹${(userLimitPaise / 100).toLocaleString('en-IN')}) is insufficient for order amount (₹${(orderAmountPaise / 100).toLocaleString('en-IN')})`
    };
  }
}

module.exports = new ApprovalEngine();
