# Autonomous AI Procurement Agent on Beckn / ONDC Protocol

An enterprise-grade agentic procurement platform built on the **Beckn Protocol / ONDC open commerce architecture** with a **Modern Angular 17 Glassmorphism Enterprise Frontend** and stateful Node.js backend.

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

### Setup & Launch

1. **Build Frontend Angular Application**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

2. **Configure and Start Backend Server**:
   ```bash
   cd backend
   npm install
   copy .env.example .env
   npm start
   ```

   On macOS/Linux, use `cp .env.example .env` instead of `copy`.

   The example environment uses the verified local Beckn sandbox lifecycle and contains no real database credentials.

3. **Access Angular Dashboard**:
   Open browser at:
   ```
   http://localhost:3000
   ```

---

## 🧪 Running Automated Tests

Run backend unit, protocol, route, concurrency, and end-to-end tests:

```bash
cd backend
npm test
```

Verify the Angular production bundle:

```bash
cd frontend
npm run build
```

Tests force isolated MongoDB, mock commerce, and mock LLM settings before application modules load, so a developer's local `.env` cannot accidentally send test traffic to a live network.

---

## 🤝 Team Delegation & Task Specs

Detailed team ownership, API responsibilities, and module boundaries are documented in [`DELEGATION_ROADMAP.md`](DELEGATION_ROADMAP.md).

## Network Modes

- `mock`: deterministic in-process commerce fixtures.
- `sandbox`: verified local HTTP Beckn lifecycle covering search, select, init, confirm, status, and tracking.
- `real`: external Beckn/ONDC transport with outbound Ed25519 authorization signing and authenticated callbacks. Configure `ONDC_UNIQUE_KEY_ID`, `ONDC_SIGNING_PRIVATE_KEY`, trusted callback public keys, and the target gateway before enabling it.

## Persistence & Security Notes

- MongoDB is the canonical persistence layer; the retired JSON database is no longer part of the application.
- Production fails closed when the configured MongoDB is unavailable unless `ALLOW_EMBEDDED_DB_FALLBACK=true` is explicitly set.
- Audit events cannot be updated or deleted through the repository adapter.
- Approval/rejection policy checks enforce organization membership, role tier, monetary limits, and atomic decision transitions.
- Never commit real MongoDB, Beckn, or deployment credentials. Keep them in local/deployment secret configuration.
