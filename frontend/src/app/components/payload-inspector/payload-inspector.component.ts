import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-payload-inspector',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card protocol-card">
      <h3><span class="icon-protocol"></span> Beckn Protocol Payloads</h3>
      <pre class="json-inspector">{{ formattedJson }}</pre>
    </div>
  `,
  styles: [`
    .protocol-card { margin-top: 10px; }
    .json-inspector {
      background: #020617;
      color: #38bdf8;
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      padding: 12px;
      border-radius: var(--radius-md);
      max-height: 200px;
      overflow: auto;
      margin-top: 10px;
    }
  `]
})
export class PayloadInspectorComponent {
  @Input() payload: any;

  get formattedJson(): string {
    if (!this.payload) {
      return JSON.stringify({
        domain: 'nic2004:52110',
        country: 'IND',
        action: 'search',
        bap_id: 'procure-ai-bap.domain.org'
      }, null, 2);
    }
    return JSON.stringify(this.payload, null, 2);
  }
}
