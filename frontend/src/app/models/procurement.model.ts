export interface ProcurementRequirements {
  ram?: string;
  processor?: string;
  storage?: string;
  warranty?: string;
}

export interface ProcurementIntent {
  category: string;
  item: string;
  quantity: number;
  location: string;
  budgetINR: number;
  currency: string;
  deliveryDeadlineDays: number;
  requirements?: ProcurementRequirements;
  constraints?: string[];
  preferences?: string[];
}

export interface ScoreBreakdown {
  priceScore: number;
  deliveryScore: number;
  ratingScore: number;
  complianceScore: number;
  specsScore: number;
}

export interface Offer {
  id: string;
  procurementId: string;
  sellerId: string;
  sellerName: string;
  sellerRating: number;
  complianceScore: number;
  itemTitle: string;
  unitPricePaise: number;
  quantity: number;
  totalPricePaise: number;
  totalPriceINR: number;
  deliveryDays: number;
  location: string;
  warranty: string;
  score: number;
  scoreBreakdown?: ScoreBreakdown;
  explanation?: string;
  becknContext?: any;
}

export interface ApprovalRequirement {
  level: string;
  requiresHumanApproval: boolean;
  requiredRole: string;
  description: string;
}

export interface ProcurementRequest {
  id: string;
  correlationId: string;
  userId: string;
  orgId: string;
  rawPrompt: string;
  state: string;
  createdAt: string;
  updatedAt?: string;
  intent?: ProcurementIntent;
  quantity?: number;
  location?: string;
  budgetPaise?: number;
  deliveryDeadlineDays?: number;
  selectedOfferId?: string;
  aiRecommendationReasoning?: string;
  approvalRequirement?: ApprovalRequirement;
}

export interface Negotiation {
  id: string;
  procurementId: string;
  offerId: string;
  counterOffer?: any;
  response?: {
    accepted: boolean;
    sellerMessage: string;
    finalTotalPricePaise: number;
  };
  status: string;
}

export interface Approval {
  id: string;
  procurementId: string;
  approverId: string;
  status: string;
  comments: string;
}

export interface Order {
  id: string;
  procurementId: string;
  becknOrderId: string;
  sellerName: string;
  totalPriceINR: number;
  fulfillmentStatus: string;
  trackingUrl: string;
  estimatedDeliveryDate: string;
}

export interface AuditEvent {
  id: string;
  procurementId: string;
  correlationId: string;
  action: string;
  actor: string;
  previousState?: string;
  newState?: string;
  timestamp: string;
}

export interface ProcurementDetail {
  request: ProcurementRequest;
  offers: Offer[];
  negotiations: Negotiation[];
  approvals: Approval[];
  order?: Order;
  auditTrail: AuditEvent[];
  memoryPattern?: any;
}
