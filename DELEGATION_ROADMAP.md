# 🗺️ ProcuraX — Team Delegation Roadmap & Technical Specifications

This document outlines the clear, modular task assignments, exact API endpoints, target files, and technical roadmap for **ProcuraX — Autonomous AI Enterprise Procurement Platform on Beckn / ONDC Protocol**.

---

## 🏛️ Team Role Delegation Matrix

| Team Member | Module Role | Target Files & Directory | Key APIs & Responsibilities |
| :--- | :--- | :--- | :--- |
| **Durga Eswar (Lead)** | **AI Architecture & Agent State Machine** | `backend/src/services/ai/`<br>`backend/src/services/agent/` | `POST /api/procurements`<br>Ollama & Fallback AI Intent parsing, workflow state loop |
| **Sampath** | **Beckn / ONDC Protocol Integration** | `backend/src/services/beckn/`<br>`backend/src/routes/becknRoutes.js` | `/beckn/gateway/search`<br>`/beckn/on_search`, `/on_select`, `/on_confirm`<br>Beckn v1.1.0 schema compliance & multi-network discovery |
| **Janu** | **Angular Frontend & Glass UI** | `frontend/src/app/components/`<br>`frontend/src/styles.css` | Angular 17 Glassmorphic Standalone components, RxJS state, iPhone frosted glass aesthetics |
| **Krishna Vamsi** | **Audit Trail & Approval Policy** | `backend/src/services/audit/`<br>`backend/src/services/approval/` | `GET /api/procurements/:id/audit`<br>`POST /api/procurements/:id/approve`<br>Immutable event logging & monetary threshold policies |

---

## ⚡ ProcuraX Demo Happy Path

To run the live interactive demo:

1. **Start Backend Server**:
   ```bash
   cd backend
   npm start
   ```
2. **Access ProcuraX Angular Dashboard**:
   Open browser at: `http://localhost:3000`
3. **Execute Happy Path**:
   - **Input Request**: Select sample prompt:
     > *"Procure 50 laptops with at least 16GB RAM, i7 processor, delivery to Hyderabad within 7 days, budget below ₹5,00,000."*
   - **Click 🚀 Launch Agent Workflow**:
     - State Stepper advances: `RECEIVED` ➔ `PARSED` ➔ `VALIDATED` ➔ `SEARCHING` ➔ `OFFERS_RECEIVED` ➔ `COMPARING` ➔ `NEGOTIATING` ➔ `PENDING_APPROVAL`.
     - Displays 4 discovered seller nodes on Beckn network.
   - **Grant Approval**: Manager/CFO human gate authorization.
   - **Order Confirmation & Live Beckn Tracking**: Generates Beckn Order ID and live tracking link.
