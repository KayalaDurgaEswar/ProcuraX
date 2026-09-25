import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProcurementService } from '../../services/procurement.service';
import { ProcurementRequest } from '../../models/procurement.model';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="sidebar" aria-label="Procurement controls">
      <div class="glass-card new-request-card">
        <div class="section-kicker">Agent command</div>
        <h3><span class="icon-new" aria-hidden="true"></span> New Procurement Request</h3>
        <p class="subtitle">Describe the item, constraints, budget and delivery target.</p>

        <form (ngSubmit)="onSubmit()">
          <label class="sr-label" for="procurement-prompt">Procurement request</label>
          <textarea
            id="procurement-prompt"
            [(ngModel)]="prompt"
            name="prompt"
            rows="5"
            maxlength="1200"
            [disabled]="loading"
            placeholder="Procure 50 laptops with 16GB RAM, i7 processor, delivery to Hyderabad within 7 days, budget ₹5,00,000."
          ></textarea>

          <div class="prompt-meta">
            <span>Natural language</span>
            <span>{{ prompt.length }}/1200</span>
          </div>

          <div class="quick-samples" aria-label="Sample procurement prompts">
            <button type="button" class="sample-tag" (click)="fillSample(1)">50 Laptops</button>
            <button type="button" class="sample-tag" (click)="fillSample(2)">15 Servers</button>
            <button type="button" class="sample-tag" (click)="fillSample(3)">100 Monitors</button>
          </div>

          <div *ngIf="error" class="inline-error" role="alert">
            <span>{{ error }}</span>
            <button type="button" (click)="dismissError()" aria-label="Dismiss error">Dismiss</button>
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading || !prompt.trim()">
            <span class="loading-dot" *ngIf="loading" aria-hidden="true"></span>
            <span>{{ loading ? 'Processing request...' : 'Launch Agent Workflow' }}</span>
          </button>
        </form>
      </div>

      <div class="glass-card recent-requests-card">
        <div class="card-header-flex">
          <div>
            <div class="section-kicker">Workspace</div>
            <h3><span class="icon-history" aria-hidden="true"></span> Procurement History</h3>
          </div>
          <button
            type="button"
            class="btn-icon"
            (click)="refresh()"
            [disabled]="loading"
            aria-label="Refresh procurement history"
          >
            Refresh
          </button>
        </div>

        <div class="request-list">
          <button
            type="button"
            *ngFor="let req of requests"
            class="request-item"
            [class.active]="activeId === req.id"
            [attr.aria-pressed]="activeId === req.id"
            (click)="selectRequest(req.id)"
          >
            <span class="req-item-top">
              <span class="req-item-id">{{ req.id }}</span>
              <span class="req-item-state">{{ req.state }}</span>
            </span>
            <span class="req-item-prompt">{{ req.rawPrompt }}</span>
          </button>

          <p *ngIf="requests.length === 0" class="empty-history">
            No procurement runs yet. Launch one above to populate this workspace.
          </p>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 360px;
      flex: 0 0 360px;
      background: rgba(7, 7, 9, 0.58);
      border-right: 1px solid var(--bg-card-border);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 18px;
      overflow-y: auto;
      backdrop-filter: blur(18px);
      -webkit-backdrop-filter: blur(18px);
    }

    .section-kicker {
      color: var(--text-dim);
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      margin-bottom: 5px;
    }

    h3 {
      font-size: 15px;
      letter-spacing: -0.2px;
    }

    .subtitle {
      font-size: 12px;
      line-height: 1.5;
      color: var(--text-muted);
      margin: 7px 0 14px;
    }

    .sr-label {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }

    textarea {
      width: 100%;
      min-height: 116px;
      background: rgba(255, 255, 255, 0.055);
      border: 1px solid var(--bg-card-border);
      border-radius: var(--radius-md);
      color: var(--text-main);
      padding: 13px 14px;
      font-size: 13px;
      line-height: 1.5;
      resize: vertical;
      outline: none;
      transition: border-color 0.2s, background 0.2s;
    }

    textarea:hover {
      background: rgba(255, 255, 255, 0.07);
    }

    textarea:focus {
      border-color: rgba(96, 165, 250, 0.75);
    }

    textarea:disabled {
      opacity: 0.55;
      cursor: not-allowed;
    }

    .prompt-meta {
      display: flex;
      justify-content: space-between;
      gap: 12px;
      margin-top: 6px;
      color: var(--text-dim);
      font-size: 10px;
    }

    .quick-samples {
      display: flex;
      flex-wrap: wrap;
      gap: 7px;
      margin: 12px 0 16px;
    }

    .sample-tag,
    .btn-icon {
      border: 1px solid rgba(255, 255, 255, 0.10);
      color: var(--text-muted);
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .sample-tag {
      background: rgba(255, 255, 255, 0.045);
      padding: 6px 10px;
      border-radius: var(--radius-pill);
      font-size: 11px;
    }

    .sample-tag:hover {
      background: rgba(96, 165, 250, 0.12);
      color: var(--text-main);
      border-color: rgba(96, 165, 250, 0.45);
    }

    .inline-error {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: 10px;
      margin-bottom: 12px;
      padding: 10px 12px;
      border-radius: var(--radius-md);
      border: 1px solid rgba(251, 113, 133, 0.30);
      background: rgba(251, 113, 133, 0.08);
      color: #fecdd3;
      font-size: 11px;
      line-height: 1.4;
    }

    .inline-error button {
      border: 0;
      background: transparent;
      color: #fda4af;
      font-size: 10px;
      cursor: pointer;
    }

    .loading-dot {
      display: inline-block;
      width: 7px;
      height: 7px;
      margin-right: 7px;
      border-radius: 50%;
      background: currentColor;
      animation: pulse 1s ease-in-out infinite alternate;
    }

    @keyframes pulse {
      from { opacity: 0.25; transform: scale(0.8); }
      to { opacity: 1; transform: scale(1); }
    }

    .card-header-flex {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      margin-bottom: 13px;
    }

    .btn-icon {
      background: rgba(255, 255, 255, 0.045);
      border-radius: var(--radius-pill);
      padding: 6px 10px;
      font-size: 11px;
    }

    .btn-icon:hover:not(:disabled) {
      color: var(--text-main);
      border-color: rgba(255, 255, 255, 0.22);
    }

    .btn-icon:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    .request-list {
      display: flex;
      flex-direction: column;
      gap: 9px;
      max-height: 390px;
      overflow-y: auto;
    }

    .request-item {
      width: 100%;
      text-align: left;
      appearance: none;
      background: rgba(255, 255, 255, 0.025);
      border: 1px solid var(--bg-card-border);
      border-radius: var(--radius-md);
      padding: 12px;
      color: inherit;
      cursor: pointer;
      transition: all 0.18s ease;
    }

    .request-item:hover,
    .request-item.active {
      background: rgba(96, 165, 250, 0.09);
      border-color: rgba(96, 165, 250, 0.42);
      transform: translateY(-1px);
    }

    .request-item.active {
      box-shadow: inset 3px 0 0 var(--accent-blue);
    }

    .req-item-top {
      display: flex;
      justify-content: space-between;
      gap: 8px;
      margin-bottom: 6px;
    }

    .req-item-id {
      max-width: 58%;
      overflow: hidden;
      text-overflow: ellipsis;
      font-size: 10px;
      font-weight: 700;
      color: var(--accent-cyan);
    }

    .req-item-state {
      font-size: 9px;
      padding: 3px 7px;
      border-radius: var(--radius-pill);
      font-weight: 700;
      background: rgba(255, 255, 255, 0.08);
      color: var(--accent-silver);
      white-space: nowrap;
    }

    .req-item-prompt {
      display: block;
      font-size: 12px;
      line-height: 1.4;
      color: var(--text-muted);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .empty-history {
      color: var(--text-dim);
      font-size: 11px;
      line-height: 1.5;
      padding: 6px 2px;
    }

    @media (max-width: 860px) {
      .sidebar {
        width: 100%;
        flex-basis: auto;
        border-right: 0;
        border-bottom: 1px solid var(--bg-card-border);
        overflow: visible;
        padding: 14px;
      }

      .request-list {
        max-height: 230px;
      }
    }
  `]
})
export class SidebarComponent implements OnInit {
  prompt = '';
  requests: ProcurementRequest[] = [];
  activeId: string | null = null;
  loading = false;
  error: string | null = null;

  constructor(private procurementService: ProcurementService) {}

  ngOnInit(): void {
    this.procurementService.requests$.subscribe(reqs => this.requests = reqs);
    this.procurementService.activeDetail$.subscribe(
      detail => this.activeId = detail?.request?.id || null
    );
    this.procurementService.loading$.subscribe(loading => this.loading = loading);
    this.procurementService.error$.subscribe(error => this.error = error);
    this.refresh();
  }

  refresh(): void {
    this.procurementService.loadProcurements().subscribe({
      error: () => undefined
    });
  }

  onSubmit(): void {
    if (!this.prompt.trim() || this.loading) return;

    this.procurementService.createProcurement(this.prompt.trim()).subscribe({
      next: () => this.prompt = '',
      error: () => undefined
    });
  }

  selectRequest(id: string): void {
    this.procurementService.loadProcurementDetail(id).subscribe({
      error: () => undefined
    });
  }

  dismissError(): void {
    this.procurementService.clearError();
  }

  fillSample(index: number): void {
    if (index === 1) {
      this.prompt = 'Procure 50 laptops with at least 16GB RAM, i7 processor, delivery to Hyderabad within 7 days, budget below ₹5,00,000.';
    } else if (index === 2) {
      this.prompt = 'Procure 15 Rack Servers with 128GB RAM, Xeon Gold processor, express delivery to Bengaluru within 3 days, total budget ₹18,00,000.';
    } else if (index === 3) {
      this.prompt = 'Procure 100 27-inch 4K Monitors, IPS panel, USB-C hub, delivery to Delhi NCR within 10 days, budget ₹25,00,000.';
    }
  }
}
