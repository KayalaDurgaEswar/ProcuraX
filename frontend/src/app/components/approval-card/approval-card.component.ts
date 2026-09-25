import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProcurementRequest } from '../../models/procurement.model';
import { ProcurementService } from '../../services/procurement.service';

@Component({
  selector: 'app-approval-card',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="glass-card approval-card">
      <h3><span class="icon-approval"></span> Human Approval Gate</h3>

      <div *ngIf="request?.state === 'PENDING_APPROVAL'" class="approval-body">
        <div class="approval-warning">
          <span class="icon-warning"></span> Approval Required: {{ request?.approvalRequirement?.level || 'MANAGER_APPROVAL' }}
        </div>
        <p class="approval-desc">{{ request?.approvalRequirement?.description }}</p>
        <div class="approval-btn-group">
          <button class="btn-approve" (click)="onApprove()">Grant Approval</button>
          <button class="btn-reject" (click)="onReject()">Reject Order</button>
        </div>
      </div>

      <div *ngIf="isApproved" class="approval-body">
        <div class="approval-success">
          <span class="icon-success"></span> Order Approved & Execution Authorized
        </div>
        <p class="approval-desc">Action logged in immutable audit register.</p>
      </div>

      <div *ngIf="!isApproved && request?.state !== 'PENDING_APPROVAL'" class="approval-body">
        <p class="text-muted">Approval policy check status: {{ request?.state }}</p>
      </div>
    </div>
  `,
  styles: [`
    .approval-card { border-color: rgba(245, 158, 11, 0.3); }
    .approval-warning { color: var(--accent-amber); font-weight: 600; font-size: 13px; margin-bottom: 8px; }
    .approval-success { color: var(--accent-emerald); font-weight: 600; font-size: 13px; }
    .approval-desc { font-size: 12px; color: var(--text-muted); margin-top: 4px; }
    .approval-btn-group { display: flex; gap: 10px; margin-top: 14px; }
    .btn-approve {
      flex: 1;
      background: var(--accent-emerald);
      color: white;
      border: none;
      padding: 10px;
      border-radius: var(--radius-md);
      font-weight: 600;
      cursor: pointer;
    }
    .btn-reject {
      flex: 1;
      background: var(--accent-rose);
      color: white;
      border: none;
      padding: 10px;
      border-radius: var(--radius-md);
      font-weight: 600;
      cursor: pointer;
    }
  `]
})
export class ApprovalCardComponent {
  @Input() request: ProcurementRequest | null = null;

  constructor(private procurementService: ProcurementService) {}

  get isApproved(): boolean {
    return ['APPROVED', 'ORDERING', 'TRACKING', 'COMPLETED'].includes(this.request?.state || '');
  }

  onApprove() {
    if (!this.request) return;
    this.procurementService.approveProcurement(this.request.id).subscribe();
  }

  onReject() {
    if (!this.request) return;
    this.procurementService.rejectProcurement(this.request.id).subscribe();
  }
}
