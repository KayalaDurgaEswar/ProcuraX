import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BecknContext } from '../../models/procurement.model';

@Component({
  selector: 'app-payload-inspector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card protocol-card">
      <div class="card-header-flex">
        <h3>🌐 Beckn Protocol Context</h3>
        <button
          *ngIf="payload"
          class="btn-copy"
          (click)="copyPayload()"
          title="Copy payload to clipboard"
        >
          {{ copied ? '✓ Copied' : '📋 Copy JSON' }}
        </button>
      </div>

      <div *ngIf="payload" class="payload-viewer">
        <div class="payload-meta" *ngIf="actionName">
          <span class="action-tag">{{ actionName }}</span>
          <span class="version-tag" *ngIf="coreVersion">v{{ coreVersion }}</span>
        </div>
        <pre class="json-inspector">{{ formattedJson }}</pre>
      </div>

      <div *ngIf="!payload" class="payload-empty">
        <p class="text-muted">Awaiting Beckn protocol payload... (Context will be generated upon network catalog discovery)</p>
      </div>
    </div>
  `,
  styles: [`
    .protocol-card { margin-top: 10px; }
    .card-header-flex { display: flex; justify-content: space-between; align-items: center; }
    .btn-copy {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--border-subtle);
      color: var(--text-muted);
      font-size: 11px;
      padding: 3px 8px;
      border-radius: var(--radius-pill);
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-copy:hover {
      background: rgba(255, 255, 255, 0.12);
      color: var(--text-main);
    }
    .payload-viewer { margin-top: 8px; }
    .payload-meta { display: flex; gap: 6px; margin-bottom: 6px; }
    .action-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      background: var(--accent-cyan-subtle);
      border: 1px solid rgba(56, 189, 248, 0.3);
      color: var(--accent-cyan);
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .version-tag {
      font-family: 'JetBrains Mono', monospace;
      font-size: 10px;
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-dim);
      padding: 2px 6px;
      border-radius: 4px;
    }
    .json-inspector {
      background: #020617;
      color: #38bdf8;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 12px;
      border-radius: var(--radius-md);
      max-height: 220px;
      overflow: auto;
      border: 1px solid var(--border-subtle);
      white-space: pre-wrap;
      word-break: break-all;
    }
    .payload-empty { padding: 12px 0; }
  `]
})
export class PayloadInspectorComponent {
  @Input() payload: BecknContext | Record<string, unknown> | null | undefined;

  copied: boolean = false;

  get formattedJson(): string {
    if (!this.payload) return '';
    return JSON.stringify(this.payload, null, 2);
  }

  get actionName(): string {
    if (!this.payload) return '';
    const p = this.payload as BecknContext;
    return p.action || '';
  }

  get coreVersion(): string {
    if (!this.payload) return '';
    const p = this.payload as BecknContext;
    return p.core_version || '';
  }

  copyPayload() {
    if (!this.formattedJson) return;
    navigator.clipboard.writeText(this.formattedJson);
    this.copied = true;
    setTimeout(() => {
      this.copied = false;
    }, 1500);
  }
}
