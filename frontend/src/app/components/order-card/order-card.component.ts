import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Order } from '../../models/procurement.model';

@Component({
  selector: 'app-order-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card order-card">
      <h3><span class="icon-order"></span> Beckn Order Tracking</h3>

      <div *ngIf="order" class="order-body">
        <div class="order-id">Beckn ID: {{ order.becknOrderId }}</div>
        <div class="order-detail">Seller: {{ order.sellerName }}</div>
        <div class="order-detail">Fulfillment: {{ order.fulfillmentStatus }}</div>
        <div class="order-link">
          <a [href]="order.trackingUrl" target="_blank">Live Tracking</a>
        </div>
      </div>

      <div *ngIf="!order" class="order-body">
        <p class="text-muted">Order placement pending approval.</p>
      </div>
    </div>
  `,
  styles: [`
    .order-body { margin-top: 10px; }
    .order-id { font-size: 13px; font-weight: 700; color: var(--accent-emerald); margin-bottom: 4px; }
    .order-detail { font-size: 12px; color: var(--text-main); }
    .order-link { font-size: 11px; margin-top: 8px; }
    .order-link a { color: var(--accent-blue); text-decoration: none; }
  `]
})
export class OrderCardComponent {
  @Input() order: Order | undefined;
}
