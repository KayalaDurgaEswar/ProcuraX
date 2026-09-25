import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcurementService } from './services/procurement.service';
import { ProcurementDetail } from './models/procurement.model';

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
            <div class="empty-icon">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 2H9C9.55228 2 10 2.44772 10 3V5H14V3C14 2.44772 14.4477 2 15 2H18C18.5523 2 19 2.44772 19 3V5H21C21.5523 5 22 5.44772 22 6V8H20" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 16.5C16 16.5 15.5 18 13 18C10.5 18 10 16.5 10 16.5C10 16.5 9.5 18 7 18C4.5 18 4 16.5 4 16.5V6H16V16.5Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                <path d="M16 21H8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </div>
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
                  <span class="state-badge">{{ detail.request.state }}</span>
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

                <div class="glass-card reasoning-card">
                  <h3>AI Strategic Recommendation & Risk Analysis</h3>
                  <div class="reasoning-box">
                    <p>{{ detail.request.aiRecommendationReasoning || 'AI agent is compiling scoring matrices...' }}</p>
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
    .main-layout { display: flex; flex: 1; min-height: 0; overflow: hidden; }
    app-sidebar { display: block; flex: 0 0 360px; min-width: 0; }
    .workspace { flex: 1; width: 100%; min-width: 0; padding: 24px; overflow-y: auto; }
    .empty-state {
      height: 100%;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      color: var(--text-muted);
    }
    .empty-icon {
      display: grid;
      place-items: center;
      width: 88px;
      height: 88px;
      margin-bottom: 18px;
      border-radius: 28px;
      color: var(--accent-silver);
      background: rgba(255, 255, 255, 0.045);
      border: 1px solid var(--bg-card-border);
      box-shadow: var(--shadow-iphone-glass);
    }
    .empty-state h2 { font-size: 22px; color: var(--text-main); margin-bottom: 8px; }
    .empty-state p { max-width: 440px; font-size: 14px; }
    .active-workspace { display: flex; flex-direction: column; gap: 20px; }
    .request-summary-card {
      background:
        linear-gradient(135deg, rgba(96, 165, 250, 0.055), transparent 44%),
        var(--bg-glass-shine),
        var(--bg-card-strong);
    }
    .req-header-row { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px; }
    .req-id { font-size: 12px; font-weight: 700; color: var(--accent-cyan); letter-spacing: 0.5px; }
    .req-header-row h2 { font-size: 22px; margin: 4px 0; }
    .req-prompt { font-size: 13px; color: var(--text-muted); font-style: italic; }
    .req-badge-group { display: flex; flex-direction: column; align-items: flex-end; gap: 8px; }
    .state-badge { font-size: 12px; font-weight: 700; padding: 6px 14px; border-radius: 20px; letter-spacing: 0.5px; background: var(--accent-blue); color: white; }
    .correlation-pill { font-family: 'JetBrains Mono', monospace; font-size: 11px; color: var(--text-dim); }
    .workspace-grid {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
      gap: 20px;
      align-items: start;
    }
    .grid-col { display: flex; flex-direction: column; gap: 20px; }
    .reasoning-box {
      background: rgba(255, 255, 255, 0.035);
      border: 1px solid rgba(167, 139, 250, 0.18);
      border-left: 3px solid var(--accent-purple);
      padding: 14px;
      border-radius: var(--radius-md);
      font-size: 13px;
      line-height: 1.6;
      color: var(--accent-silver);
      white-space: pre-line;
      margin-top: 10px;
    }

    @media (max-width: 1180px) {
      .workspace-grid {
        grid-template-columns: minmax(0, 1fr);
      }

      .side-col {
        display: grid;
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 860px) {
      .main-layout {
        display: block;
        overflow: visible;
      }

      app-sidebar {
        width: 100%;
        max-width: 100%;
      }

      .workspace {
        width: 100%;
        max-width: 100vw;
        padding: 14px;
        overflow: hidden;
      }

      .empty-state {
        min-height: 360px;
        padding: 30px 12px;
      }

      .req-header-row {
        flex-direction: column;
        gap: 14px;
      }

      .req-badge-group {
        align-items: flex-start;
      }
    }

    @media (max-width: 620px) {
      .side-col {
        display: flex;
      }

      .req-header-row h2 {
        font-size: 19px;
      }

      .req-prompt {
        line-height: 1.5;
      }

      .correlation-pill {
        max-width: 100%;
        overflow-wrap: anywhere;
      }
    }
  `]
})
export class AppComponent implements OnInit {
  detail: ProcurementDetail | null = null;

  constructor(private procurementService: ProcurementService) {}

  ngOnInit() {
    this.procurementService.activeDetail$.subscribe(d => this.detail = d);
  }

  get topBecknPayload(): any {
    return this.detail?.offers?.[0]?.becknContext || null;
  }
}
