import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcurementService } from './services/procurement.service';
import { ProcurementDetail, BecknContext } from './models/procurement.model';

import { HeaderComponent } from './components/header/header.component';
import { SidebarComponent } from './components/sidebar/sidebar.component';
import { StepperComponent } from './components/stepper/stepper.component';
import { IntentCardComponent } from './components/intent-card/intent-card.component';
import { OffersMatrixComponent } from './components/offers-matrix/offers-matrix.component';
import { ApprovalCardComponent } from './components/approval-card/approval-card.component';
import { NegotiationCardComponent } from './components/negotiation-card/negotiation-card.component';
import { OrderCardComponent } from './components/order-card/order-card.component';
import { AuditTimelineComponent } from './components/audit-timeline/audit-timeline.component';
import { PayloadInspectorComponent } from './components/payload-inspector/payload-inspector.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    CommonModule,
    HeaderComponent,
    SidebarComponent,
    StepperComponent,
    IntentCardComponent,
    OffersMatrixComponent,
    ApprovalCardComponent,
    NegotiationCardComponent,
    OrderCardComponent,
    AuditTimelineComponent,
    PayloadInspectorComponent
  ],
  template: `
    <div class="app-container">
      <app-header></app-header>

      <div class="main-layout">
        <app-sidebar></app-sidebar>

        <main class="workspace">
          <!-- Empty State -->
          <div *ngIf="!detail" class="empty-state">
            <div class="empty-icon">🛒</div>
            <h2>No Procurement Request Selected</h2>
            <p>Enter a natural language request on the left or select an existing procurement run from history to inspect the autonomous agent state machine.</p>
          </div>

          <!-- Active Procurement Workspace -->
          <div *ngIf="detail" class="active-workspace">
            <!-- Summary Bar & Stepper -->
            <div class="glass-card request-summary-card">
              <div class="req-header-row">
                <div>
                  <span class="req-id">{{ detail.request.id }}</span>
                  <h2>
                    {{ (detail.request.intent?.category || 'Procurement') | uppercase }} Batch ({{ detail.request.quantity || 0 }} Units)
                  </h2>
                  <p class="req-prompt">"{{ detail.request.rawPrompt }}"</p>
                </div>
                <div class="req-badge-group">
                  <span class="state-badge" [ngClass]="{
                    'badge-cancelled': detail.request.state === 'CANCELLED',
                    'badge-failed': detail.request.state === 'FAILED',
                    'badge-pending': detail.request.state === 'PENDING_APPROVAL',
                    'badge-approved': detail.request.state === 'APPROVED' || detail.request.state === 'TRACKING'
                  }">{{ detail.request.state }}</span>
                  <div class="correlation-pill">Correlation ID: {{ detail.request.correlationId }}</div>
                </div>
              </div>

              <app-stepper [currentState]="detail.request.state"></app-stepper>
            </div>

            <!-- Workspace Grid -->
            <div class="workspace-grid">
              <!-- Left Column -->
              <div class="grid-col main-col">
                <app-intent-card [request]="detail.request"></app-intent-card>

                <app-offers-matrix
                  [offers]="detail.offers"
                  [selectedOfferId]="detail.request.selectedOfferId"
                ></app-offers-matrix>

                <!-- AI Strategic Recommendation & Agent Memory Area -->
                <div class="glass-card reasoning-card">
                  <div class="card-header-flex">
                    <h3>🧠 AI Strategic Recommendation & Risk Analysis</h3>
                  </div>

                  <div class="reasoning-box">
                    <p>{{ detail.request.aiRecommendationReasoning || 'AI agent is evaluating discovered offers against constraints...' }}</p>
                  </div>

                  <!-- Connected Agent Memory Pattern -->
                  <div *ngIf="detail.memoryPattern" class="memory-pattern-block">
                    <div class="mem-title-row">
                      <span class="mem-tag">🏛️ Category Memory: {{ detail.memoryPattern.category | uppercase }}</span>
                      <span class="mem-procured-count">{{ detail.memoryPattern.successfulProcurementsCount }} Cycle(s) Learned</span>
                    </div>

                    <div class="mem-stats-row">
                      <div class="mem-stat-item">
                        <span class="stat-lbl">Historical Avg Price</span>
                        <span class="stat-val">₹{{ (detail.memoryPattern.averagePricePerUnitPaise / 100) | number:'1.0-0' }} / unit</span>
                      </div>
                      <div class="mem-stat-item">
                        <span class="stat-lbl">Avg Delivery Window</span>
                        <span class="stat-val">{{ detail.memoryPattern.avgDeliveryDays }} Days</span>
                      </div>
                      <div class="mem-stat-item" *ngIf="detail.memoryPattern.preferredSellers?.length">
                        <span class="stat-lbl">Trusted Sellers</span>
                        <span class="stat-val seller-pills">
                          <span *ngFor="let s of detail.memoryPattern.preferredSellers" class="seller-pill">{{ s }}</span>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div *ngIf="!detail.memoryPattern" class="memory-awaiting-block">
                    <span class="awaiting-icon">ℹ️</span>
                    <span>No historical memory baseline recorded yet for category <strong>{{ detail.request.intent?.category || 'general' }}</strong>. This workflow run will establish agent memory upon fulfillment.</span>
                  </div>
                </div>
              </div>

              <!-- Right Column -->
              <div class="grid-col side-col">
                <app-approval-card [request]="detail.request"></app-approval-card>
                <app-negotiation-card [negotiations]="detail.negotiations"></app-negotiation-card>
                <app-order-card [order]="detail.order"></app-order-card>
                <app-audit-timeline [auditTrail]="detail.auditTrail"></app-audit-timeline>
                <app-payload-inspector [payload]="topBecknPayload"></app-payload-inspector>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  `,
  styles: [`
    .main-layout { display: flex; flex: 1; overflow: hidden; }
    .workspace { flex: 1; padding: 24px; overflow-y: auto; }
    .empty-state {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: var(--text-muted);
    }
    .empty-icon { font-size: 64px; margin-bottom: 16px; opacity: 0.5; }
    .empty-state h2 { font-size: 22px; color: var(--text-main); margin-bottom: 8px; }
    .empty-state p { max-width: 440px; font-size: 14px; }
    .active-workspace { display: flex; flex-direction: column; gap: 20px; }
    .request-summary-card { background: linear-gradient(135deg, rgba(30, 41, 59, 0.9), rgba(15, 23, 42, 0.9)); }
    .req-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .req-id { font-size: 12px; font-weight: 700; color: var(--accent-cyan); letter-spacing: 0.5px; }
    .req-header-row h2 { font-size: 22px; margin: 4px 0; }
    .req-prompt { font-size: 13px; color: var(--text-muted); font-style: italic; }
    .req-badge-group { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .state-badge {
      font-size: 12px;
      font-weight: 700;
      padding: 6px 14px;
      border-radius: var(--radius-pill);
      letter-spacing: 0.5px;
      background: var(--accent-blue);
      color: white;
    }
    .state-badge.badge-pending { background: var(--accent-amber); color: #000000; }
    .state-badge.badge-approved { background: var(--accent-emerald); color: #000000; }
    .state-badge.badge-cancelled, .state-badge.badge-failed { background: var(--accent-rose); color: white; }
    .correlation-pill { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-dim); }
    .workspace-grid { display: grid; grid-template-columns: 1fr 380px; gap: 20px; }
    .grid-col { display: flex; flex-direction: column; gap: 20px; }
    .card-header-flex { display: flex; justify-content: space-between; align-items: center; }
    .reasoning-box {
      background: rgba(0, 0, 0, 0.25);
      border-left: 3px solid var(--accent-purple);
      padding: 14px;
      border-radius: var(--radius-sm);
      font-size: 13px;
      line-height: 1.6;
      color: #cbd5e1;
      white-space: pre-line;
      margin-top: 10px;
    }
    .memory-pattern-block {
      margin-top: 14px;
      background: rgba(139, 92, 246, 0.06);
      border: 1px solid rgba(139, 92, 246, 0.2);
      border-radius: var(--radius-sm);
      padding: 12px;
    }
    .mem-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .mem-tag { font-size: 11px; font-weight: 700; color: #c084fc; text-transform: uppercase; letter-spacing: 0.5px; }
    .mem-procured-count { font-size: 11px; color: var(--text-muted); }
    .mem-stats-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .mem-stat-item { display: flex; flex-direction: column; gap: 2px; }
    .stat-lbl { font-size: 10px; color: var(--text-dim); }
    .stat-val { font-size: 12px; font-weight: 600; color: var(--text-main); }
    .seller-pills { display: flex; flex-wrap: wrap; gap: 4px; }
    .seller-pill { font-size: 10px; background: rgba(255, 255, 255, 0.08); padding: 2px 6px; border-radius: 4px; }
    .memory-awaiting-block {
      margin-top: 12px;
      display: flex;
      gap: 8px;
      align-items: center;
      font-size: 12px;
      color: var(--text-muted);
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 10px;
    }
  `]
})
export class AppComponent implements OnInit {
  detail: ProcurementDetail | null = null;

  constructor(private procurementService: ProcurementService) {}

  ngOnInit() {
    this.procurementService.activeDetail$.subscribe(d => this.detail = d);
  }

  get topBecknPayload(): BecknContext | null {
    return this.detail?.offers?.[0]?.becknContext || null;
  }
}
