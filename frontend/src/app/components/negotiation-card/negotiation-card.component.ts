import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Negotiation } from '../../models/procurement.model';

@Component({
  selector: 'app-negotiation-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card negotiation-card">
      <div class="card-header-flex">
        <h3>🤝 Autonomous Negotiation Log</h3>
        <span *ngIf="lastNegotiation" class="neg-status-pill" [ngClass]="{
          'status-success': lastNegotiation.response?.accepted,
          'status-partial': !lastNegotiation.response?.accepted && lastNegotiation.status === 'PARTIAL',
          'status-rejected': lastNegotiation.status === 'REJECTED'
        }">
          {{ lastNegotiation.response?.accepted ? 'COUNTER ACCEPTED' : lastNegotiation.status }}
        </span>
      </div>

      <div *ngIf="lastNegotiation" class="neg-body">
        <!-- Key Metrics Grid -->
        <div class="neg-metrics-grid">
          <div class="neg-metric" *ngIf="lastNegotiation.counterOffer?.requestedDiscountPercent">
            <span class="m-label">Requested Cut</span>
            <span class="m-val highlight">{{ lastNegotiation.counterOffer?.requestedDiscountPercent }}%</span>
          </div>

          <div class="neg-metric" *ngIf="lastNegotiation.counterOffer?.savingsINR !== undefined">
            <span class="m-label">Realized Savings</span>
            <span class="m-val savings">₹{{ (lastNegotiation.counterOffer?.savingsINR || 0) | number:'1.0-0' }}</span>
          </div>

          <div class="neg-metric" *ngIf="lastNegotiation.counterOffer?.proposedUnitPricePaise">
            <span class="m-label">Target Unit Price</span>
            <span class="m-val">₹{{ ((lastNegotiation.counterOffer?.proposedUnitPricePaise || 0) / 100) | number:'1.0-0' }}</span>
          </div>

          <div class="neg-metric" *ngIf="lastNegotiation.response?.finalUnitPricePaise">
            <span class="m-label">Final Agreed Unit</span>
            <span class="m-val price-agreed">₹{{ ((lastNegotiation.response?.finalUnitPricePaise || 0) / 100) | number:'1.0-0' }}</span>
          </div>
        </div>

        <!-- Policy Validation -->
        <div *ngIf="lastNegotiation.counterOffer?.policyValidation" class="policy-row">
          <span *ngIf="lastNegotiation.counterOffer?.policyValidation?.withinEnterpriseLimit" class="policy-chip pass">
            ✓ Within Enterprise Cap
          </span>
          <span *ngIf="lastNegotiation.counterOffer?.policyValidation?.aboveVendorFloor" class="policy-chip pass">
            ✓ Above Floor Price
          </span>
        </div>

        <!-- Seller Message -->
        <div *ngIf="lastNegotiation.response?.sellerMessage" class="seller-msg-box">
          <span class="msg-author">Seller BPP Response:</span>
          <p class="msg-content">"{{ lastNegotiation.response?.sellerMessage }}"</p>
        </div>
      </div>

      <div *ngIf="!lastNegotiation" class="neg-empty">
        <p class="text-muted">No negotiation required or initiated for this procurement batch.</p>
      </div>
    </div>
  `,
  styles: [`
    .card-header-flex { display: flex; justify-content: space-between; align-items: center; }
    .neg-status-pill {
      font-size: 10px;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-muted);
      border: 1px solid var(--border-subtle);
    }
    .neg-status-pill.status-success {
      background: var(--accent-emerald-subtle);
      color: var(--accent-emerald);
      border-color: rgba(52, 211, 153, 0.3);
    }
    .neg-status-pill.status-partial {
      background: var(--accent-amber-subtle);
      color: var(--accent-amber);
      border-color: rgba(251, 191, 36, 0.3);
    }
    .neg-status-pill.status-rejected {
      background: var(--accent-rose-subtle);
      color: var(--accent-rose);
      border-color: rgba(248, 113, 113, 0.3);
    }
    .neg-body { margin-top: 12px; display: flex; flex-direction: column; gap: 10px; }
    .neg-metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      background: rgba(0, 0, 0, 0.25);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 10px;
    }
    .neg-metric { display: flex; flex-direction: column; gap: 2px; }
    .m-label { font-size: 10px; color: var(--text-dim); }
    .m-val { font-size: 13px; font-weight: 600; color: var(--text-main); }
    .m-val.highlight { color: var(--accent-cyan); }
    .m-val.savings { color: var(--accent-emerald); }
    .m-val.price-agreed { color: var(--accent-silver); }
    .policy-row { display: flex; gap: 6px; flex-wrap: wrap; }
    .policy-chip {
      font-size: 10px;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
    }
    .policy-chip.pass {
      background: rgba(52, 211, 153, 0.1);
      border: 1px solid rgba(52, 211, 153, 0.25);
      color: var(--accent-emerald);
    }
    .seller-msg-box {
      background: rgba(255, 255, 255, 0.02);
      border-left: 2px solid var(--accent-cyan);
      padding: 8px 10px;
      border-radius: 4px;
    }
    .msg-author { font-size: 10px; font-weight: 600; color: var(--accent-cyan); display: block; margin-bottom: 2px; }
    .msg-content { font-size: 11px; color: var(--text-muted); font-style: italic; line-height: 1.4; margin: 0; }
    .neg-empty { padding: 12px 0; }
  `]
})
export class NegotiationCardComponent {
  @Input() negotiations: Negotiation[] = [];

  get lastNegotiation(): Negotiation | null {
    return this.negotiations && this.negotiations.length > 0
      ? this.negotiations[this.negotiations.length - 1]
      : null;
  }
}
