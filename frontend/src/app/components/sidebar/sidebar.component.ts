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
    <aside class="sidebar">
      <div class="glass-card new-request-card">
        <h3>⚡ New Procurement Request</h3>
        <p class="subtitle">Enter natural language specifications & constraints</p>

        <form (ngSubmit)="onSubmit()">
          <textarea
            [(ngModel)]="prompt"
            name="prompt"
            rows="4"
            placeholder="e.g. Procure 50 laptops with 16GB RAM, i7 processor, delivery to Hyderabad within 7 days, budget ₹5,00,000."
            (input)="errorMessage = null"
          ></textarea>

          <div class="quick-samples">
            <span class="sample-tag" (click)="fillSample(1)">50 Laptops (Hyderabad)</span>
            <span class="sample-tag" (click)="fillSample(2)">15 Servers (Express)</span>
            <span class="sample-tag" (click)="fillSample(3)">100 Monitors (Budget)</span>
          </div>

          <div *ngIf="errorMessage" class="sidebar-error-notice">
            ⚠️ {{ errorMessage }}
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading || !prompt.trim()">
            <span>{{ loading ? '⏳ Agent Running...' : '🚀 Launch Agent Workflow' }}</span>
          </button>
        </form>
      </div>

      <div class="glass-card recent-requests-card">
        <div class="card-header-flex">
          <h3>📋 Procurement History</h3>
          <button class="btn-icon" (click)="refresh()" title="Refresh">🔄</button>
        </div>
        <div class="request-list">
          <div
            *ngFor="let req of requests"
            class="request-item"
            [class.active]="activeId === req.id"
            (click)="selectRequest(req.id)"
          >
            <div class="req-item-top">
              <span class="req-item-id">{{ req.id }}</span>
              <span class="req-item-state" [ngClass]="{
                'badge-blue': req.state === 'RECEIVED' || req.state === 'PARSED' || req.state === 'SEARCHING' || req.state === 'COMPARING',
                'badge-amber': req.state === 'PENDING_APPROVAL' || req.state === 'NEGOTIATING',
                'badge-emerald': req.state === 'APPROVED' || req.state === 'TRACKING',
                'badge-rose': req.state === 'FAILED' || req.state === 'CANCELLED'
              }">{{ req.state }}</span>
            </div>
            <div class="req-item-prompt">{{ req.rawPrompt }}</div>
          </div>
          <p *ngIf="requests.length === 0" class="text-muted" style="font-size:12px;">No past procurements yet.</p>
        </div>
      </div>
    </aside>
  `,
  styles: [`
    .sidebar {
      width: 360px;
      background: rgba(15, 23, 42, 0.5);
      border-right: 1px solid var(--bg-card-border);
      padding: 20px;
      display: flex;
      flex-direction: column;
      gap: 20px;
      overflow-y: auto;
    }
    .subtitle { font-size: 12px; color: var(--text-muted); margin-bottom: 14px; }
    textarea {
      width: 100%;
      background: var(--bg-input);
      border: 1px solid var(--bg-card-border);
      border-radius: var(--radius-md);
      color: var(--text-main);
      padding: 12px;
      font-size: 13px;
      resize: none;
      outline: none;
      transition: border-color 0.2s;
    }
    textarea:focus { border-color: var(--accent-blue); }
    .quick-samples { display: flex; flex-wrap: wrap; gap: 6px; margin: 10px 0 16px 0; }
    .sample-tag {
      font-size: 11px;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      padding: 4px 10px;
      border-radius: 12px;
      cursor: pointer;
      border: 1px solid rgba(255, 255, 255, 0.05);
      transition: all 0.2s;
    }
    .sample-tag:hover {
      background: rgba(59, 130, 246, 0.2);
      color: var(--text-main);
      border-color: var(--accent-blue);
    }
    .sidebar-error-notice {
      background: rgba(244, 63, 94, 0.1);
      border: 1px solid var(--accent-rose);
      color: var(--accent-rose);
      padding: 8px 12px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      margin-bottom: 12px;
    }
    .card-header-flex { display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; }
    .btn-icon { background: none; border: none; cursor: pointer; font-size: 14px; opacity: 0.7; color: white; }
    .btn-icon:hover { opacity: 1; }
    .request-list { display: flex; flex-direction: column; gap: 10px; max-height: 380px; overflow-y: auto; }
    .request-item {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--bg-card-border);
      border-radius: var(--radius-md);
      padding: 12px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .request-item:hover, .request-item.active {
      background: rgba(59, 130, 246, 0.12);
      border-color: var(--accent-blue);
    }
    .req-item-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
    .req-item-id { font-size: 11px; font-weight: 600; color: var(--accent-cyan); }
    .req-item-state { font-size: 10px; padding: 2px 8px; border-radius: var(--radius-pill); font-weight: 600; background: rgba(255, 255, 255, 0.1); }
    .req-item-prompt { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `]
})
export class SidebarComponent implements OnInit {
  prompt: string = '';
  requests: ProcurementRequest[] = [];
  activeId: string | null = null;
  loading: boolean = false;
  errorMessage: string | null = null;

  constructor(private procurementService: ProcurementService) {}

  ngOnInit() {
    this.procurementService.requests$.subscribe(reqs => this.requests = reqs);
    this.procurementService.activeDetail$.subscribe(detail => this.activeId = detail?.request?.id || null);
    this.procurementService.loading$.subscribe(l => this.loading = l);
    this.refresh();
  }

  refresh() {
    this.procurementService.loadProcurements().subscribe();
  }

  onSubmit() {
    if (!this.prompt.trim() || this.loading) return;
    this.errorMessage = null;

    this.procurementService.createProcurement(this.prompt).subscribe({
      next: (req) => {
        this.prompt = '';
        this.activeId = req.id;
      },
      error: (err) => {
        this.errorMessage = err?.error?.error || err?.message || 'Error launching autonomous agent workflow';
      }
    });
  }

  selectRequest(id: string) {
    this.errorMessage = null;
    this.procurementService.loadProcurementDetail(id).subscribe();
  }

  fillSample(index: number) {
    this.errorMessage = null;
    if (index === 1) {
      this.prompt = 'Procure 50 laptops with at least 16GB RAM, i7 processor, delivery to Hyderabad within 7 days, budget below ₹5,00,000.';
    } else if (index === 2) {
      this.prompt = 'Procure 15 Rack Servers with 128GB RAM, Xeon Gold processor, express delivery to Bengaluru within 3 days, total budget ₹18,00,000.';
    } else if (index === 3) {
      this.prompt = 'Procure 100 27-inch 4K Monitors, IPS panel, USB-C hub, delivery to Delhi NCR within 10 days, budget ₹25,00,000.';
    }
  }
}
