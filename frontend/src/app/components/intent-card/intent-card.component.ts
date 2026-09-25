import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcurementRequest } from '../../models/procurement.model';

@Component({
  selector: 'app-intent-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card intent-card">
      <h3><span class="icon-intent"></span> Structured Intent & Requirements</h3>
      <div class="intent-grid">
        <div class="intent-box">
          <div class="intent-label">Category</div>
          <div class="intent-value">{{ request?.intent?.category || 'N/A' }}</div>
        </div>
        <div class="intent-box">
          <div class="intent-label">Quantity</div>
          <div class="intent-value">{{ request?.quantity || 0 }} Units</div>
        </div>
        <div class="intent-box">
          <div class="intent-label">Target Budget</div>
          <div class="intent-value">₹{{ ((request?.budgetPaise || 0) / 100) | number:'1.0-0' }}</div>
        </div>
        <div class="intent-box">
          <div class="intent-label">Delivery Location</div>
          <div class="intent-value">{{ request?.location || 'N/A' }}</div>
        </div>
        <div class="intent-box">
          <div class="intent-label">Max Deadline</div>
          <div class="intent-value">{{ request?.deliveryDeadlineDays || 0 }} Days</div>
        </div>
        <div class="intent-box">
          <div class="intent-label">Key Specification</div>
          <div class="intent-value">
            {{ request?.intent?.requirements?.ram || '16GB' }}, {{ request?.intent?.requirements?.processor || 'i7' }}
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .intent-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-top: 12px; }
    .intent-box {
      background: rgba(255, 255, 255, 0.03);
      padding: 12px;
      border-radius: var(--radius-md);
      border: 1px solid var(--bg-card-border);
    }
    .intent-label { font-size: 11px; color: var(--text-muted); margin-bottom: 4px; }
    .intent-value { font-size: 14px; font-weight: 600; color: var(--text-main); }

    @media (max-width: 720px) {
      .intent-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }
    }

    @media (max-width: 460px) {
      .intent-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class IntentCardComponent {
  @Input() request: ProcurementRequest | null = null;
}
