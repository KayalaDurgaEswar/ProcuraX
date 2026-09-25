import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order, BecknTrackingStatus } from '../../models/procurement.model';
import { ProcurementService } from '../../services/procurement.service';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card order-card">
      <div class="card-header-flex">
        <h3>📦 Beckn Order Tracking</h3>
        <button
          *ngIf="order"
          class="btn-icon"
          (click)="refreshTracking()"
          [disabled]="loadingTracking"
          title="Refresh Live Beckn Tracking"
        >🔄</button>
      </div>

      <div *ngIf="order" class="order-body">
        <div class="order-id">Beckn ID: {{ order.becknOrderId }}</div>
        <div class="order-detail"><strong>Seller:</strong> {{ order.sellerName }}</div>
        <div class="order-detail"><strong>Total Value:</strong> ₹{{ order.totalPriceINR | number:'1.0-0' }}</div>
        <div class="order-detail">
          <strong>Fulfillment Status:</strong>
          <span class="badge-status">{{ order.fulfillmentStatus }}</span>
        </div>

        <!-- Live Beckn Network Tracking Feed -->
        <div class="live-tracking-box">
          <div class="live-header">
            <span class="live-dot" [class.pulse]="loadingTracking"></span>
            <span class="live-title">Live Beckn Network Sync</span>
          </div>

          <div *ngIf="loadingTracking" class="tracking-loading">
            <span>Querying Beckn BPP fulfillment node...</span>
          </div>

          <div *ngIf="!loadingTracking && trackingData" class="tracking-data">
            <div class="tracking-row">
              <span class="trk-label">State:</span>
              <span class="trk-val status-val">{{ trackingData.status }}</span>
            </div>
            <div class="tracking-row" *ngIf="trackingData.fulfillmentState">
              <span class="trk-label">Fulfillment:</span>
              <span class="trk-val">{{ trackingData.fulfillmentState }}</span>
            </div>
            <div class="tracking-row" *ngIf="trackingData.location">
              <span class="trk-label">Location:</span>
              <span class="trk-val">{{ trackingData.location }}</span>
            </div>
            <div class="tracking-row" *ngIf="trackingData.lastUpdated">
              <span class="trk-label">Last Node Sync:</span>
              <span class="trk-val dim">{{ formatTime(trackingData.lastUpdated) }}</span>
            </div>
          </div>

          <div *ngIf="!loadingTracking && trackingError" class="tracking-error">
            <span>⚠️ {{ trackingError }}</span>
            <button class="btn-retry" (click)="refreshTracking()">Retry</button>
          </div>
        </div>

        <div class="order-link" *ngIf="order.trackingUrl">
          <a [href]="order.trackingUrl" target="_blank" rel="noopener noreferrer">
            🔗 External Beckn Tracking URL
          </a>
        </div>
      </div>

      <div *ngIf="!order" class="order-body empty">
        <p class="text-muted">Order placement pending manager approval.</p>
      </div>
    </div>
  `,
  styles: [`
    .card-header-flex { display: flex; justify-content: space-between; align-items: center; }
    .order-body { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
    .order-body.empty { padding: 8px 0; }
    .order-id { font-size: 13px; font-weight: 700; color: var(--accent-emerald); }
    .order-detail { font-size: 12px; color: var(--text-main); }
    .badge-status {
      display: inline-block;
      margin-left: 6px;
      font-size: 10px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      background: var(--accent-emerald-subtle);
      color: var(--accent-emerald);
      border: 1px solid rgba(52, 211, 153, 0.3);
    }
    .live-tracking-box {
      margin-top: 6px;
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border-subtle);
      border-radius: var(--radius-sm);
      padding: 10px;
    }
    .live-header { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
    .live-dot { width: 6px; height: 6px; border-radius: 50%; background: var(--accent-cyan); box-shadow: 0 0 8px var(--accent-cyan); }
    .live-dot.pulse { animation: dot-pulse 1s infinite alternate; }
    @keyframes dot-pulse { from { opacity: 0.3; } to { opacity: 1; } }
    .live-title { font-size: 11px; font-weight: 600; color: var(--accent-cyan); text-transform: uppercase; letter-spacing: 0.5px; }
    .tracking-loading { font-size: 11px; color: var(--text-muted); font-style: italic; }
    .tracking-data { display: flex; flex-direction: column; gap: 4px; font-size: 11px; }
    .tracking-row { display: flex; justify-content: space-between; }
    .trk-label { color: var(--text-dim); }
    .trk-val { color: var(--text-main); font-weight: 500; }
    .trk-val.status-val { color: var(--accent-emerald); font-weight: 700; }
    .trk-val.dim { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-dim); }
    .tracking-error { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: var(--accent-amber); }
    .btn-retry { background: none; border: 1px solid var(--accent-amber); color: var(--accent-amber); border-radius: 4px; padding: 2px 6px; cursor: pointer; font-size: 10px; }
    .order-link { font-size: 11px; margin-top: 4px; }
    .order-link a { color: var(--accent-blue); text-decoration: none; }
    .order-link a:hover { text-decoration: underline; }
  `]
})
export class OrderCardComponent implements OnChanges {
  @Input() order: Order | undefined;

  trackingData: BecknTrackingStatus | null = null;
  loadingTracking: boolean = false;
  trackingError: string | null = null;

  constructor(private procurementService: ProcurementService) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['order'] && this.order?.id) {
      this.refreshTracking();
    } else if (!this.order) {
      this.trackingData = null;
      this.trackingError = null;
    }
  }

  refreshTracking() {
    if (!this.order?.id) return;
    this.loadingTracking = true;
    this.trackingError = null;

    this.procurementService.getOrderStatus(this.order.id).subscribe({
      next: (res) => {
        this.trackingData = res.becknTracking;
        this.loadingTracking = false;
      },
      error: (err) => {
        this.trackingError = err?.error?.error || 'Unable to sync with Beckn tracking node';
        this.loadingTracking = false;
      }
    });
  }

  formatTime(isoStr: string): string {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleTimeString();
  }
}
