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

export interface MemoryInsights {
  historicalVendor: boolean;
  avgCategoryPricePaise: number;
  memoryNote: string;
}

export interface BecknContext {
  domain: string;
  country: string;
  city?: string;
  action: string;
  core_version: string;
  bap_id: string;
  bpp_id?: string;
  bap_uri?: string;
  bpp_uri?: string;
  transaction_id: string;
  message_id: string;
  timestamp: string;
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
  becknContext?: BecknContext;
  negotiable?: boolean;
  minNegotiablePricePaise?: number;
  becknFulfillmentId?: string;
  memoryInsights?: MemoryInsights;
  negotiated?: boolean;
  savingsPaise?: number;
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
  offerCount?: number;
  selectedOfferId?: string;
  aiRecommendationReasoning?: string;
  approvalRequirement?: ApprovalRequirement;
  orderId?: string;
  becknOrderId?: string;
  failureReason?: string;
  rejectionReason?: string;
}

export interface CounterOffer {
  offerId: string;
  sellerId: string;
  originalTotalPricePaise: number;
  counterTotalPricePaise: number;
  savingsPaise: number;
  savingsINR: number;
  proposedUnitPricePaise: number;
  requestedDiscountPercent: number;
  policyValidation?: {
    withinEnterpriseLimit: boolean;
    aboveVendorFloor: boolean;
  };
  message?: string;
}

export interface SellerNegotiationResponse {
  accepted: boolean;
  sellerMessage: string;
  finalTotalPricePaise: number;
  finalUnitPricePaise?: number;
  concededDiscountPercent?: number;
}

export interface Negotiation {
  id: string;
  procurementId: string;
  offerId: string;
  counterOffer?: CounterOffer;
  response?: SellerNegotiationResponse;
  status: string;
  createdAt?: string;
}

export interface Approval {
  id: string;
  procurementId: string;
  approverId: string;
  status: string;
  comments: string;
  createdAt?: string;
}

export interface Order {
  id: string;
  procurementId: string;
  becknOrderId: string;
  sellerId?: string;
  sellerName: string;
  totalPricePaise?: number;
  totalPriceINR: number;
  quantity?: number;
  status?: string;
  fulfillmentStatus: string;
  trackingUrl: string;
  estimatedDeliveryDate: string;
  networkContext?: Record<string, unknown>;
  createdAt?: string;
}

export interface AuditEvent {
  id: string;
  procurementId: string;
  correlationId: string;
  action: string;
  actor: string;
  previousState?: string;
  newState?: string;
  entityId?: string;
  entityType?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
}

export interface MemoryPattern {
  id: string;
  category: string;
  preferredSellers: string[];
  averagePricePerUnitPaise: number;
  avgDeliveryDays: number;
  successfulProcurementsCount: number;
  lastProcuredAt: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ProcurementDetail {
  request: ProcurementRequest;
  offers: Offer[];
  negotiations: Negotiation[];
  approvals: Approval[];
  order?: Order;
  auditTrail: AuditEvent[];
  memoryPattern?: MemoryPattern | null;
}

export interface HealthStatus {
  status: string;
  service: string;
  protocol: string;
  frontend: string;
  timestamp: string;
}

export interface BecknTrackingStatus {
  correlationId: string;
  becknOrderId: string;
  status: string;
  fulfillmentState: string | null;
  location: string | null;
  lastUpdated: string;
  becknPayload?: Record<string, unknown>;
}

export interface OrderStatusResponse {
  order: Order;
  becknTracking: BecknTrackingStatus;
}

export interface ApprovalActionResponse {
  message: string;
  request: ProcurementRequest;
  order: Order;
  offer: Offer;
}

export interface RejectActionResponse {
  message: string;
  state: string;
}
