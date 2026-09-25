const mongoose = require('mongoose');

const Schema = mongoose.Schema;

// Organization Schema
const OrganizationSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  name: { type: String, required: true },
  code: { type: String, required: true },
  budgetCapPaise: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// User Schema
const UserSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  orgId: { type: String, required: true },
  name: { type: String, required: true },
  email: { type: String, required: true },
  role: { type: String, required: true },
  approvalLimitPaise: { type: Number, required: true },
  createdAt: { type: Date, default: Date.now }
});

// ProcurementRequest Schema — all fields stored including agent state transitions
const ProcurementRequestSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  correlationId: { type: String, required: true, index: true },
  userId: { type: String, required: true },
  orgId: { type: String, required: true },
  rawPrompt: { type: String, required: true },
  state: { type: String, required: true, index: true },
  intent: { type: Schema.Types.Mixed },
  quantity: { type: Number },
  location: { type: String },
  budgetPaise: { type: Number },
  deliveryDeadlineDays: { type: Number },
  offerCount: { type: Number },
  selectedOfferId: { type: String },
  aiRecommendationReasoning: { type: String },
  approvalRequirement: { type: Schema.Types.Mixed },
  orderId: { type: String },
  becknOrderId: { type: String },
  failureReason: { type: String },
  rejectionReason: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Offer Schema
const OfferSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  procurementId: { type: String, required: true, index: true },
  sellerId: { type: String, required: true },
  sellerName: { type: String, required: true },
  sellerRating: { type: Number, required: true },
  complianceScore: { type: Number, required: true },
  itemTitle: { type: String, required: true },
  unitPricePaise: { type: Number, required: true },
  quantity: { type: Number, required: true },
  totalPricePaise: { type: Number, required: true },
  totalPriceINR: { type: Number },
  deliveryDays: { type: Number, required: true },
  location: { type: String },
  warranty: { type: String },
  negotiable: { type: Boolean, default: true },
  minNegotiablePricePaise: { type: Number },
  becknFulfillmentId: { type: String },
  becknItemId: { type: String },
  becknProviderId: { type: String },
  becknBppId: { type: String },
  becknBppUri: { type: String },
  becknContext: { type: Schema.Types.Mixed },
  score: { type: Number, default: 0 },
  scoreBreakdown: { type: Schema.Types.Mixed },
  explanation: { type: String },
  memoryInsights: { type: Schema.Types.Mixed },
  negotiated: { type: Boolean, default: false },
  savingsPaise: { type: Number, default: 0 },
  createdAt: { type: Date, default: Date.now }
});

// Negotiation Schema
const NegotiationSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  procurementId: { type: String, required: true, index: true },
  offerId: { type: String, required: true },
  counterOffer: { type: Schema.Types.Mixed },
  response: { type: Schema.Types.Mixed },
  status: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
});

// Approval Schema
const ApprovalSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  procurementId: { type: String, required: true, unique: true, index: true },
  approverId: { type: String, required: true },
  status: { type: String, required: true },
  comments: { type: String },
  createdAt: { type: Date, default: Date.now }
});

// Order Schema
const OrderSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  procurementId: { type: String, required: true, unique: true, index: true },
  becknOrderId: { type: String, required: true, unique: true },
  sellerId: { type: String, required: true },
  sellerName: { type: String, required: true },
  totalPricePaise: { type: Number, required: true },
  totalPriceINR: { type: Number, required: true },
  quantity: { type: Number, required: true },
  status: { type: String, required: true },
  fulfillmentStatus: { type: String, required: true },
  trackingUrl: { type: String },
  estimatedDeliveryDate: { type: Date },
  networkContext: { type: Schema.Types.Mixed },
  createdAt: { type: Date, default: Date.now }
});

// AuditEvent Schema (immutable event log)
const AuditEventSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  procurementId: { type: String, required: true, index: true },
  correlationId: { type: String, required: true, index: true },
  action: { type: String, required: true },
  actor: { type: String, required: true },
  previousState: { type: String },
  newState: { type: String },
  entityId: { type: String },
  entityType: { type: String },
  metadata: { type: Schema.Types.Mixed },
  timestamp: { type: Date, default: Date.now }
});

// MemoryPattern Schema — agent learning across procurement cycles
const MemoryPatternSchema = new Schema({
  id: { type: String, required: true, unique: true, index: true },
  category: { type: String, required: true, unique: true, index: true },
  preferredSellers: [{ type: String }],
  averagePricePerUnitPaise: { type: Number, required: true },
  avgDeliveryDays: { type: Number, required: true },
  successfulProcurementsCount: { type: Number, default: 1 },
  lastProcuredAt: { type: Date, default: Date.now }
});

module.exports = {
  Organization: mongoose.model('Organization', OrganizationSchema),
  User: mongoose.model('User', UserSchema),
  ProcurementRequest: mongoose.model('ProcurementRequest', ProcurementRequestSchema),
  Offer: mongoose.model('Offer', OfferSchema),
  Negotiation: mongoose.model('Negotiation', NegotiationSchema),
  Approval: mongoose.model('Approval', ApprovalSchema),
  Order: mongoose.model('Order', OrderSchema),
  AuditEvent: mongoose.model('AuditEvent', AuditEventSchema),
  MemoryPattern: mongoose.model('MemoryPattern', MemoryPatternSchema)
};
