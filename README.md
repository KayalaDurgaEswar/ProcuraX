# Autonomous AI Procurement Agent on Beckn / ONDC Protocol

An enterprise-grade agentic procurement platform built on the **Beckn Protocol / ONDC open commerce architecture** with a **Modern Angular 17 Glassmorphism Enterprise Frontend** and stateful Node.js backend.

---

## 🌟 Key Features

### 🤖 AI-Powered Procurement
- **Natural Language Processing**: Submit procurement requests in plain English
- **Intelligent Intent Extraction**: Automatically parse requirements, quantities, budgets, and constraints
- **Multi-Vendor Comparison**: AI-powered scoring across price, delivery, ratings, and compliance
- **Automated Negotiation**: Smart negotiation engine with bounded discount strategies

### 📊 Analytics & Insights
- **Real-time Dashboard**: Comprehensive analytics with KPIs, charts, and vendor performance metrics
- **Cost Savings Tracker**: Monitor procurement efficiency and estimated savings
- **Category Breakdown**: Visualize spending patterns across different procurement categories
- **Success Rate Monitoring**: Track completion rates and processing times

### ⚡ Productivity Features
- **Quick Templates**: Pre-built templates for common procurement scenarios (laptops, servers, office supplies)
- **Bulk Import**: CSV-based bulk procurement request creation
- **Export Reports**: Generate procurement reports in JSON or CSV format
- **Procurement History**: Complete audit trail with state tracking

### 🔄 Beckn Protocol Integration
- **ONDC Network Discovery**: Automatic seller discovery through Beckn gateway
- **Real-time Order Tracking**: Live order status updates via Beckn /status API
- **Standardized Commerce**: Full Beckn protocol compliance for interoperability

### 🎯 Approval Workflow
- **Configurable Thresholds**: Auto-approval for requests under ₹50,000
- **Multi-Level Approvals**: Manager approval (₹50K-₹5L), CFO/Board approval (>₹5L)
- **Human-in-the-Loop**: Manual approval interface for pending requests

### 🔍 Audit & Compliance
- **Immutable Audit Trail**: Complete event logging with correlation IDs
- **Actor Tracking**: Record all actions with timestamps and actors
- **State Machine Visibility**: Full transparency of procurement state transitions

---

## 🏛️ System Architecture

```
User (Enterprise Procurement Lead / Angular 17 Dashboard)
  │
  ▼
Natural Language Procurement Request ("Procure 50 laptops with 16GB RAM...")
  │
  ▼
[ AI Intent Extraction Engine ]  ───► Structured Intent (JSON Schema)
  │
  ▼
[ Stateful Procurement Agent ] (RECEIVED ➔ PARSED ➔ VALIDATED ➔ SEARCHING)
  │
  ├─────────────────────────────────────────┐
  ▼                                         ▼
[ Beckn Network Provider Abstraction ]  [ Agent Memory Layer ]
  │ (Beckn /search, /select, /init)        (Historical vendor reliability)
  ▼
[ Beckn / ONDC Seller Nodes ]
  │ (Discovered Seller Catalog Offers)
  ▼
[ AI Comparison Engine ] (Price 35%, Delivery 25%, Rating 20%, Compliance 10%, Specs 10%)
  │
  ▼
[ Rule-Guided Negotiation Engine ] (Bounded Discount Strategy & Counter-Offers)
  │
  ▼
[ Configurable Approval Engine ] (< ₹50k Auto | ₹50k-₹5L Manager | > ₹5L CFO/Board)
  │
  ├── (Human-in-the-Loop Gate if required) ──► Angular Manager Approval Action
  │
  ▼
[ Beckn Order Confirmation ] (Beckn /confirm ➔ Live Tracking ➔ Fulfillment)
  │
  ▼
[ Immutable Audit Trail Log ] ──► Audit Event Store (UUID, Correlation ID, Actor, Payload)
```

---

## 📁 Repository Structure

```
.
├── backend/
│   ├── data/                 # File-backed SQLite/JSON persistent database
│   ├── src/
│   │   ├── config/           # Environment variables & threshold policies
│   │   ├── db/               # Entity models, database repository & seed data
│   │   ├── routes/           # REST APIs (/api/procurements, /api/orders, /beckn)
│   │   ├── services/         # State Machine, AI Provider, Beckn Sandbox, Scoring Engine
│   │   ├── app.js            # Express app assembly & Angular static dist serving
│   │   └── index.js          # Backend server entrypoint with port fallback
│   ├── tests/                # Automated unit & integration tests
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/   # Angular 17 Standalone Components (Stepper, Offers, Approval, Audit)
│   │   │   ├── models/       # TypeScript Interfaces & DTOs
│   │   │   ├── services/     # ProcurementService RxJS HttpClient State Management
│   │   │   └── app.component.ts
│   │   ├── index.html
│   │   ├── main.ts
│   │   └── styles.css        # Glassmorphism Dark Theme Styling
│   ├── angular.json          # Angular CLI Configuration
│   ├── tsconfig.json
│   └── package.json
├── DELEGATION_ROADMAP.md     # Task assignments, exact endpoints & tasks for Dev 1, Dev 2, Dev 3
└── README.md
```

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js**: `v18+`
- **npm**: `v9+`
- **MongoDB**: Local or Atlas (connection string in .env)

### Setup & Launch

1. **Install Backend Dependencies**:
   ```bash
   cd backend
   npm install
   ```

2. **Configure Environment Variables**:
   Edit `backend/.env` with your settings:
   - MongoDB connection string
   - LLM provider (Ollama or mock)
   - Beckn gateway URL
   - Approval thresholds

3. **Build Frontend Angular Application**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

4. **Start Backend Server**:
   ```bash
   cd backend
   npm start
   ```

5. **Access the Platform**:
   Open browser at:
   ```
   http://localhost:3000
   ```

### 🎯 Quick Demo

1. **Create a Procurement Request**:
   - Navigate to the "New" tab in the sidebar
   - Enter: "Order 50 laptops with 16GB RAM, i7 processor, delivery within 7 days"
   - Click "Launch Agent Workflow"

2. **Explore Analytics**:
   - Click the "📊 Analytics" tab
   - View procurement metrics, vendor performance, and cost savings

3. **Use Templates**:
   - Click the "⚡ Templates" tab
   - Select a pre-built template (e.g., "Laptop Bulk Order")
   - Customize and submit

4. **Bulk Import**:
   - Click the "📤 Bulk" tab
   - Download the sample CSV template
   - Upload your customized CSV with multiple procurement requests

---

## 📱 User Interface Features

### Main Dashboard
- **Request Summary Card**: Overview with state machine stepper
- **Intent Card**: Parsed procurement requirements and constraints
- **Offers Matrix**: Side-by-side vendor comparison with AI scoring
- **Approval Card**: Current approval status and actions
- **Negotiation Timeline**: Offer/counter-offer history
- **Order Status**: Real-time Beckn order tracking
- **Audit Timeline**: Complete event history

### Analytics Dashboard
- **KPI Cards**: Total requests, completed orders, pending approvals, active negotiations
- **Financial Metrics**: Total spend, estimated savings, avg processing time
- **Category Charts**: Procurement breakdown by category
- **State Distribution**: Visual representation of request states
- **Vendor Performance**: Top vendor statistics with pricing insights

### Bulk Import Tool
- **Drag & Drop**: Easy CSV file upload
- **Preview Table**: Verify data before import
- **Error Handling**: Detailed success/failure reporting
- **Sample Template**: Download pre-formatted CSV

### Templates Library
- **Pre-built Templates**: Common procurement scenarios
- **Variable Substitution**: Customize templates with dynamic fields
- **Quick Actions**: One-click template application

---

## 🧪 Running Automated Tests

Run backend integration test suite:

```bash
cd backend
npm test
```

---

## 🤝 Team Delegation & Task Specs

Detailed task specifications and API endpoint references for Developer 1 (Beckn Protocol Specialist), Developer 2 (AI Intent & Negotiation Specialist), and Developer 3 (Angular Frontend Specialist) are documented in [`DELEGATION_ROADMAP.md`](file:///Users/durgaeswar/Desktop/AI1_TEAM%20-%202/DELEGATION_ROADMAP.md).
# ProcuraX
