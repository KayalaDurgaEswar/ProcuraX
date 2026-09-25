import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Negotiation } from '../../models/procurement.model';

@Component({
  selector: 'app-negotiation-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card negotiation-card">
      <h3><span class="icon-negotiation"></span> Autonomous Negotiation Log</h3>

      <div *ngIf="lastNegotiation" class="neg-body">
        <div style="font-size:12px; margin-bottom:6px;">
          <strong>Status:</strong> <span style="color:var(--accent-cyan);">{{ lastNegotiation.status }}</span>
        </div>
        <div style="font-size:12px; color:var(--accent-emerald);">
          <strong>Savings:</strong> ₹{{ (lastNegotiation.counterOffer?.savingsINR || 0) | number:'1.0-0' }}
        </div>
        <div style="font-size:11px; color:var(--text-muted); margin-top:6px; font-style:italic;">
          "{{ lastNegotiation.response?.sellerMessage || '' }}"
        </div>
      </div>

      <div *ngIf="!lastNegotiation" class="neg-body">
        <p class="text-muted">No negotiation required or executed yet.</p>
      </div>
    </div>
  `,
  styles: [`
    .neg-body { margin-top: 10px; }
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
