import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuditEvent } from '../../models/procurement.model';

@Component({
  selector: 'app-audit-timeline',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card audit-card">
      <h3><span class="icon-audit"></span> Immutable Audit Log</h3>
      <div class="audit-timeline">
        <div *ngFor="let item of auditTrail" class="audit-item">
          <div>
            <div class="audit-time">{{ formatTime(item.timestamp) }}</div>
            <div class="audit-action">{{ item.action }}</div>
          </div>
        </div>
        <p *ngIf="auditTrail.length === 0" class="text-muted">No audit logs recorded.</p>
      </div>
    </div>
  `,
  styles: [`
    .audit-timeline { display: flex; flex-direction: column; gap: 12px; max-height: 280px; overflow-y: auto; margin-top: 10px; }
    .audit-item { display: flex; gap: 10px; font-size: 12px; border-left: 2px solid var(--accent-blue); padding-left: 10px; }
    .audit-time { font-family: 'JetBrains Mono', monospace; font-size: 10px; color: var(--text-dim); }
    .audit-action { font-weight: 600; color: var(--text-main); }
  `]
})
export class AuditTimelineComponent {
  @Input() auditTrail: AuditEvent[] = [];

  formatTime(isoStr: string): string {
    if (!isoStr) return '';
    return new Date(isoStr).toLocaleTimeString();
  }
}
