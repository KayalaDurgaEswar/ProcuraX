import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcurementRequest } from '../../models/procurement.model';

@Component({
  selector: 'app-intent-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card intent-card">
      <h3>🔍 Structured Intent & Requirements</h3>

      <div *ngIf="request?.intent" class="intent-content">
        <div class="intent-grid">
          <div class="intent-box">
            <div class="intent-label">Category</div>
            <div class="intent-value">{{ request?.intent?.category || 'General' }}</div>
          </div>
          <div class="intent-box">
            <div class="intent-label">Quantity</div>
            <div class="intent-value">{{ request?.quantity || request?.intent?.quantity || 0 }} Units</div>
          </div>
          <div class="intent-box">
            <div class="intent-label">Target Budget</div>
            <div class="intent-value">₹{{ ((request?.budgetPaise || (request?.intent?.budgetINR ? request.intent.budgetINR * 100 : 0)) / 100) | number:'1.0-0' }}</div>
          </div>
          <div class="intent-box">
            <div class="intent-label">Delivery Location</div>
            <div class="intent-value">{{ request?.location || request?.intent?.location || 'Not specified' }}</div>
          </div>
          <div class="intent-box">
            <div class="intent-label">Max Deadline</div>
            <div class="intent-value">{{ request?.deliveryDeadlineDays || request?.intent?.deliveryDeadlineDays || 0 }} Days</div>
          </div>
          <div class="intent-box">
            <div class="intent-label">Item / Specifications</div>
            <div class="intent-value specs-value">{{ specsSummary }}</div>
          </div>
        </div>

        <!-- Optional Structured Constraints and Preferences -->
        <div *ngIf="hasConstraintsOrPreferences" class="intent-tags-container">
          <div *ngIf="request?.intent?.constraints?.length" class="tag-group">
            <span class="tag-title">Constraints:</span>
            <span *ngFor="let c of request?.intent?.constraints" class="constraint-chip">{{ c }}</span>
          </div>
          <div *ngIf="request?.intent?.preferences?.length" class="tag-group">
            <span class="tag-title">Preferences:</span>
            <span *ngFor="let p of request?.intent?.preferences" class="preference-chip">{{ p }}</span>
          </div>
        </div>
      </div>

      <div *ngIf="!request?.intent" class="intent-empty">
        <p class="text-muted">Awaiting structured intent extraction from natural language prompt...</p>
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
    .specs-value { font-size: 12px; line-height: 1.4; color: var(--accent-silver); }
    .intent-tags-container {
      margin-top: 12px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding-top: 10px;
      border-top: 1px solid var(--border-subtle);
    }
    .tag-group { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; font-size: 11px; }
    .tag-title { color: var(--text-dim); font-weight: 600; }
    .constraint-chip {
      background: rgba(251, 191, 36, 0.12);
      border: 1px solid rgba(251, 191, 36, 0.25);
      color: var(--accent-amber);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      font-size: 10px;
    }
    .preference-chip {
      background: rgba(56, 189, 248, 0.12);
      border: 1px solid rgba(56, 189, 248, 0.25);
      color: var(--accent-cyan);
      padding: 2px 8px;
      border-radius: var(--radius-pill);
      font-size: 10px;
    }
    .intent-empty { padding: 14px 0; }
  `]
})
export class IntentCardComponent {
  @Input() request: ProcurementRequest | null = null;

  get specsSummary(): string {
    const req = this.request?.intent?.requirements;
    if (!req) return this.request?.intent?.item || 'Standard specification';
    const parts: string[] = [];
    if (req.processor) parts.push(req.processor);
    if (req.ram) parts.push(req.ram);
    if (req.storage) parts.push(req.storage);
    if (req.warranty) parts.push(req.warranty);
    return parts.length > 0 ? parts.join(' • ') : (this.request?.intent?.item || 'Standard specification');
  }

  get hasConstraintsOrPreferences(): boolean {
    return Boolean(
      this.request?.intent?.constraints?.length ||
      this.request?.intent?.preferences?.length
    );
  }
}
