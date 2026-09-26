import { Component, Output, EventEmitter } from '@angular/core';
import { Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-sidebar',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <aside class="sidebar">
      <!-- Navigation Tabs -->
      <div class="nav-tabs">
        <button 
          class="nav-tab" 
          [class.active]="activeTab === 'new'"
          (click)="activeTab = 'new'">
          ➕ New
        </button>
        <button 
          class="nav-tab" 
          [class.active]="activeTab === 'history'"
          (click)="activeTab = 'history'">
          📋 History
        </button>
        <button 
          class="nav-tab" 
          [class.active]="activeTab === 'analytics'"
          (click)="switchView.emit('analytics')">
          📊 Analytics
        </button>
        <button 
          class="nav-tab" 
          [class.active]="activeTab === 'bulk'"
          (click)="switchView.emit('bulk')">
          Bulk
        </button>
      </div>

      <!-- New Request Panel -->
      <div *ngIf="activeTab === 'new'" class="glass-card new-request-card">
        <h3><span class="icon-new"></span> New Procurement Request</h3>
        <p class="subtitle">Enter natural language specifications & constraints</p>

        <form (ngSubmit)="onSubmit()">
          <textarea
            [(ngModel)]="prompt"
            name="prompt"
            rows="4"
            placeholder="e.g. Procure 50 laptops with 16GB RAM, i7 processor, delivery to Hyderabad within 7 days, budget ₹5,00,000."
          ></textarea>

          <div class="quick-samples">
            <span class="sample-tag" (click)="fillSample(1)">50 Laptops (Hyderabad)</span>
            <span class="sample-tag" (click)="fillSample(2)">15 Servers (Express)</span>
            <span class="sample-tag" (click)="fillSample(3)">100 Monitors (Budget)</span>
          </div>

          <button type="submit" class="btn-primary" [disabled]="loading || !prompt.trim()">
            <span>{{ loading ? 'Processing...' : 'Launch Agent Workflow' }}</span>
          </button>
        </form>

        <div class="quick-actions">
          <button class="action-btn" (click)="switchView.emit('bulk')">
            Bulk Import
          </button>
        </div>
      </div>

      <!-- History Panel -->
      <div *ngIf="activeTab === 'history'" class="glass-card recent-requests-card">
        <div class="card-header-flex">
          <h3><span class="icon-history"></span> Procurement History</h3>
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
              <span class="req-item-state">{{ req.state }}</span>
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
    .nav-tabs {
      display: flex;
      gap: 4px;
      background: rgba(0, 0, 0, 0.3);
      padding: 4px;
      border-radius: 12px;
      margin-bottom: 10px;
    }
    .nav-tab {
      flex: 1;
      background: transparent;
      border: none;
      color: #94a3b8;
      padding: 10px 8px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s;
      text-align: center;
    }
    .nav-tab:hover {
      background: rgba(59, 130, 246, 0.1);
      color: #3b82f6;
    }
    .nav-tab.active {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
      border: 1px solid rgba(59, 130, 246, 0.3);
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
    .quick-actions {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 8px;
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .action-btn {
      background: rgba(139, 92, 246, 0.15);
      border: 1px solid rgba(139, 92, 246, 0.3);
      color: #a78bfa;
      padding: 8px;
      border-radius: 8px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 600;
      transition: all 0.2s;
    }
    .action-btn:hover {
      background: rgba(139, 92, 246, 0.25);
      transform: translateY(-2px);
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
    .req-item-top { display: flex; justify-content: space-between; margin-bottom: 6px; }
    .req-item-id { font-size: 11px; font-weight: 600; color: var(--accent-cyan); }
    .req-item-state { font-size: 10px; padding: 2px 6px; border-radius: 8px; font-weight: 600; background: rgba(255, 255, 255, 0.1); }
    .req-item-prompt { font-size: 12px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
  `]
})
export class SidebarComponent {
  prompt: string = '';
  requests: any[] = [];
  activeId: string | null = null;
  loading: boolean = false;
  activeTab: string = 'new';

  @Output() switchView = new EventEmitter<string>();

  constructor(private router: Router) {}

  ngOnInit() {
    this.loadRequests();
  }

  loadRequests() {
    this.requests = [];
  }

  refresh() {
    this.loadRequests();
  }

  onSubmit() {
    if (!this.prompt.trim() || this.loading) return;
    alert('Request submitted: ' + this.prompt);
    this.prompt = '';
  }

  selectRequest(id: string) {
    this.activeId = id;
  }

  fillSample(index: number) {
    if (index === 1) {
      this.prompt = 'Procure 50 laptops with at least 16GB RAM, i7 processor, delivery to Hyderabad within 7 days, budget below ₹5,00,000.';
    } else if (index === 2) {
      this.prompt = 'Procure 15 Rack Servers with 128GB RAM, Xeon Gold processor, express delivery to Bengaluru within 3 days, total budget ₹18,00,000.';
    } else if (index === 3) {
      this.prompt = 'Procure 100 27-inch 4K Monitors, IPS panel, USB-C hub, delivery to Delhi NCR within 10 days, budget ₹25,00,000.';
    }
  }
}
