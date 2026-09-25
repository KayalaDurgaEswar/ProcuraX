import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditEvent } from '../../models/procurement.model';

@Component({
  selector: 'app-audit-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card audit-card">
      <div class="card-header-flex">
        <h3>📜 Immutable Audit Log</h3>
        <span class="audit-count">{{ auditTrail.length }} Event(s)</span>
      </div>

      <div class="audit-timeline">
        <div *ngFor="let item of auditTrail" class="audit-item">
          <div class="audit-content">
            <div class="audit-top">
              <span class="audit-action">{{ formatAction(item.action) }}</span>
              <span class="audit-time">{{ formatTime(item.timestamp) }}</span>
            </div>

            <div class="audit-meta-row" *ngIf="item.actor || (item.previousState && item.newState)">
              <span *ngIf="item.actor" class="actor-badge">👤 {{ item.actor }}</span>
              <span *ngIf="item.previousState && item.newState" class="state-diff">
                {{ item.previousState }} → {{ item.newState }}
              </span>
            </div>
          </div>
        </div>

        <div *ngIf="auditTrail.length === 0" class="audit-empty">
          <p class="text-muted">No audit trail events recorded yet for this procurement run.</p>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .card-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .audit-count { font-size: 11px; background: rgba(255, 255, 255, 0.06); padding: 2px 8px; border-radius: var(--radius-pill); color: var(--text-muted); }
    .audit-timeline {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 280px;
      overflow-y: auto;
      margin-top: 6px;
      padding-right: 4px;
    }
    .audit-item {
      display: flex;
      font-size: 12px;
      border-left: 2px solid var(--accent-blue);
      padding-left: 10px;
      transition: border-color 0.2s;
    }
    .audit-item:hover { border-left-color: var(--accent-cyan); }
    .audit-content { display: flex; flex-direction: column; gap: 4px; width: 100%; }
    .audit-top { display: flex; justify-content: space-between; align-items: center; }
    .audit-action { font-weight: 600; color: var(--text-main); font-size: 12px; }
    .audit-time { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-dim); }
    .audit-meta-row { display: flex; align-items: center; gap: 8px; font-size: 10px; }
    .actor-badge {
      background: rgba(255, 255, 255, 0.06);
      padding: 1px 6px;
      border-radius: 4px;
      color: var(--accent-silver);
    }
    .state-diff {
      color: var(--accent-cyan);
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
    }
    .audit-empty { padding: 12px 0; }
  `]
})
export class AuditTimelineComponent {
  @Input() auditTrail: AuditEvent[] = [];

  formatTime(isoStr: string): string {
    if (!isoStr) return '';
    const date = new Date(isoStr);
    return isNaN(date.getTime()) ? '' : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }

  formatAction(actionStr: string): string {
    if (!actionStr) return '';
    return actionStr.replace(/_/g, ' ');
  }
}
