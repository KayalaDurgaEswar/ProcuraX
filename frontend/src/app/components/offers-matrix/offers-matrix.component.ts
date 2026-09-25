import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Offer, ProcurementRequest } from '../../models/procurement.model';

@Component({
  selector: 'app-offers-matrix',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card offers-card">
      <div class="card-header-flex">
        <h3><span class="icon-offers"></span> Discovered Seller Offers (Beckn Network)</h3>
        <span class="offer-count-pill">{{ offers.length }} Offers</span>
      </div>

      <div class="offers-container">
        <div
          *ngFor="let o of offers"
          class="offer-card"
          [class.top-offer]="o.id === selectedOfferId"
        >
          <span *ngIf="o.id === selectedOfferId" class="top-badge">AI TOP MATCH</span>

          <div class="offer-header">
            <div>
              <div class="offer-seller">{{ o.sellerName }}</div>
              <div class="offer-title">{{ o.itemTitle }}</div>
              <div *ngIf="o.becknContext?.bpp_id" class="network-id">
                BPP {{ o.becknContext.bpp_id }}
              </div>
            </div>
            <div class="offer-score-badge">{{ o.score }}/100</div>
          </div>

          <div class="offer-metrics">
            <div class="metric-item">
              <span class="metric-label">Total Price</span>
              <span class="metric-val price">₹{{ (o.totalPricePaise / 100) | number:'1.0-0' }}</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Delivery Speed</span>
              <span class="metric-val">{{ o.deliveryDays }} Days</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Seller Rating</span>
              <span class="metric-val">{{ o.sellerRating }}/5</span>
            </div>
            <div class="metric-item">
              <span class="metric-label">Compliance</span>
              <span class="metric-val">{{ o.complianceScore }}%</span>
            </div>
          </div>

          <div class="score-bars" *ngIf="o.scoreBreakdown">
            <div class="bar-group">
              <span class="bar-label">Price ({{ o.scoreBreakdown.priceScore }}%)</span>
              <div class="bar-track"><div class="bar-fill" [style.width.%]="o.scoreBreakdown.priceScore"></div></div>
            </div>
            <div class="bar-group">
              <span class="bar-label">Delivery ({{ o.scoreBreakdown.deliveryScore }}%)</span>
              <div class="bar-track"><div class="bar-fill" [style.width.%]="o.scoreBreakdown.deliveryScore"></div></div>
            </div>
            <div class="bar-group">
              <span class="bar-label">Rating ({{ o.scoreBreakdown.ratingScore }}%)</span>
              <div class="bar-track"><div class="bar-fill" [style.width.%]="o.scoreBreakdown.ratingScore"></div></div>
            </div>
            <div class="bar-group">
              <span class="bar-label">Compliance ({{ o.scoreBreakdown.complianceScore }}%)</span>
              <div class="bar-track"><div class="bar-fill" [style.width.%]="o.scoreBreakdown.complianceScore"></div></div>
            </div>
            <div class="bar-group">
              <span class="bar-label">Specs ({{ o.scoreBreakdown.specsScore }}%)</span>
              <div class="bar-track"><div class="bar-fill" [style.width.%]="o.scoreBreakdown.specsScore"></div></div>
            </div>
          </div>

          <div class="explanation-text" *ngIf="o.explanation">
            {{ o.explanation }}
          </div>
        </div>

        <p *ngIf="offers.length === 0" class="text-muted">No seller offers discovered yet.</p>
      </div>
    </div>
  `,
  styles: [`
    .card-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .offer-count-pill { font-size: 11px; background: rgba(255, 255, 255, 0.06); padding: 4px 10px; border-radius: 12px; color: var(--text-muted); }
    .offers-container { display: flex; flex-direction: column; gap: 14px; }
    .offer-card {
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--bg-card-border);
      border-radius: var(--radius-md);
      padding: 16px;
      position: relative;
      transition: all 0.2s;
    }
    .offer-card.top-offer { border-color: var(--accent-emerald); background: rgba(16, 185, 129, 0.05); }
    .top-badge { position: absolute; top: 12px; right: 12px; background: var(--accent-emerald); color: white; font-size: 10px; font-weight: 700; padding: 3px 8px; border-radius: 10px; }
    .offer-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; }
    .offer-seller { font-size: 15px; font-weight: 700; }
    .offer-title { font-size: 13px; color: var(--text-muted); margin-top: 2px; }
    .network-id {
      width: fit-content;
      max-width: 100%;
      margin-top: 7px;
      padding: 3px 7px;
      border-radius: var(--radius-pill);
      background: rgba(56, 189, 248, 0.07);
      border: 1px solid rgba(56, 189, 248, 0.18);
      color: var(--accent-cyan);
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
      font-size: 9px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .offer-score-badge { font-size: 18px; font-weight: 800; color: var(--accent-cyan); }
    .offer-metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 12px 0; padding: 10px; background: rgba(0, 0, 0, 0.2); border-radius: var(--radius-sm); }
    .metric-item { display: flex; flex-direction: column; }
    .metric-label { font-size: 10px; color: var(--text-dim); }
    .metric-val { font-size: 13px; font-weight: 600; }
    .metric-val.price { color: var(--accent-emerald); }
    .score-bars { display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px; margin-top: 10px; }
    .bar-group { display: flex; flex-direction: column; gap: 2px; }
    .bar-label { font-size: 9px; color: var(--text-dim); }
    .bar-track { height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; overflow: hidden; }
    .bar-fill { height: 100%; background: var(--accent-blue); }
    .explanation-text { font-size: 11px; color: var(--text-muted); margin-top: 10px; line-height: 1.4; border-top: 1px dashed rgba(255,255,255,0.08); padding-top: 8px; }

    @media (max-width: 720px) {
      .offer-header {
        gap: 12px;
      }

      .offer-score-badge {
        font-size: 15px;
      }

      .offer-metrics {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .score-bars {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }
  `]
})
export class OffersMatrixComponent {
  @Input() offers: Offer[] = [];
  @Input() selectedOfferId: string | undefined;
}
