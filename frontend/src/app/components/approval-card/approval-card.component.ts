import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProcurementRequest } from '../../models/procurement.model';
import { ProcurementService } from '../../services/procurement.service';

@Component({
  selector: 'app-approval-card',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="glass-card approval-card" [class.pending]="request?.state === 'PENDING_APPROVAL'">
      <h3>🛡️ Human Approval Gate</h3>

      <!-- State: PENDING_APPROVAL -->
      <div *ngIf="request?.state === 'PENDING_APPROVAL'" class="approval-body">
        <div class="approval-warning">
          ⚠️ Approval Required: {{ request?.approvalRequirement?.level || 'MANAGER_APPROVAL' }}
        </div>
        <p class="approval-desc">{{ request?.approvalRequirement?.description }}</p>

        <!-- Optional Comments Field -->
        <div class="approval-comment-section">
          <input
            type="text"
            [(ngModel)]="comments"
            placeholder="Approval comments (optional)"
            class="approval-input"
            [disabled]="processing"
          />
        </div>

        <!-- Error Feedback -->
        <div *ngIf="errorMessage" class="error-notice">
          ⚠️ {{ errorMessage }}
        </div>

        <div class="approval-btn-group">
          <button
            class="btn-approve"
            (click)="onApprove()"
            [disabled]="processing"
          >
            {{ processing ? '⏳ Authorizing...' : 'Grant Approval' }}
          </button>
          <button
            class="btn-reject"
            (click)="onReject()"
            [disabled]="processing"
          >
            {{ processing ? '⏳ Rejecting...' : 'Reject Order' }}
          </button>
        </div>
      </div>

      <!-- State: APPROVED / ORDERING / TRACKING -->
      <div *ngIf="isApproved" class="approval-body">
        <div class="approval-success">
          ✅ Order Approved & Execution Authorized
        </div>
        <p class="approval-desc">Authorized by Manager. Beckn order sequence triggered and recorded in audit register.</p>
      </div>

      <!-- State: CANCELLED -->
      <div *ngIf="request?.state === 'CANCELLED'" class="approval-body">
        <div class="approval-cancelled">
          🚫 Procurement Request Cancelled
        </div>
        <p class="approval-desc">Reason: {{ request?.rejectionReason || 'Rejected during managerial review.' }}</p>
      </div>

      <!-- Initial / Pre-Approval States -->
      <div *ngIf="!isApproved && request?.state !== 'PENDING_APPROVAL' && request?.state !== 'CANCELLED'" class="approval-body">
        <p class="text-muted">Approval policy check status: <strong>{{ request?.state }}</strong></p>
      </div>
    </div>
  `,
  styles: [`
    .approval-card { border-color: rgba(255, 255, 255, 0.12); }
    .approval-card.pending { border-color: rgba(245, 158, 11, 0.4); box-shadow: 0 0 16px rgba(245, 158, 11, 0.12); }
    .approval-body { margin-top: 12px; display: flex; flex-direction: column; gap: 8px; }
    .approval-warning { color: var(--accent-amber); font-weight: 600; font-size: 13px; }
    .approval-success { color: var(--accent-emerald); font-weight: 600; font-size: 13px; }
    .approval-cancelled { color: var(--accent-rose); font-weight: 600; font-size: 13px; }
    .approval-desc { font-size: 12px; color: var(--text-muted); line-height: 1.4; }
    .approval-comment-section { margin-top: 4px; }
    .approval-input {
      width: 100%;
      background: var(--bg-input);
      border: 1px solid var(--border-medium);
      border-radius: var(--radius-sm);
      color: var(--text-main);
      padding: 8px 12px;
      font-size: 12px;
      outline: none;
    }
    .approval-input:focus {
      border-color: var(--accent-blue);
      box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.2);
    }
    .error-notice {
      background: rgba(244, 63, 94, 0.1);
      border: 1px solid var(--accent-rose);
      color: var(--accent-rose);
      padding: 6px 10px;
      border-radius: var(--radius-sm);
      font-size: 11px;
    }
    .approval-btn-group { display: flex; gap: 10px; margin-top: 8px; }
    .btn-approve {
      flex: 1;
      background: var(--accent-emerald);
      color: #000000;
      border: none;
      padding: 10px;
      border-radius: var(--radius-md);
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-approve:hover:not(:disabled) {
      background: #10b981;
      transform: translateY(-1px);
    }
    .btn-approve:disabled { opacity: 0.4; cursor: not-allowed; }
    .btn-reject {
      flex: 1;
      background: rgba(248, 113, 113, 0.15);
      border: 1px solid var(--accent-rose);
      color: var(--accent-rose);
      padding: 10px;
      border-radius: var(--radius-md);
      font-weight: 600;
      font-size: 13px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .btn-reject:hover:not(:disabled) {
      background: rgba(248, 113, 113, 0.25);
      transform: translateY(-1px);
    }
    .btn-reject:disabled { opacity: 0.4; cursor: not-allowed; }
  `]
})
export class ApprovalCardComponent {
  @Input() request: ProcurementRequest | null = null;

  comments: string = '';
  processing: boolean = false;
  errorMessage: string | null = null;

  constructor(private procurementService: ProcurementService) {}

  get isApproved(): boolean {
    return ['APPROVED', 'ORDERING', 'TRACKING', 'COMPLETED'].includes(this.request?.state || '');
  }

  onApprove() {
    if (!this.request || this.processing) return;
    this.processing = true;
    this.errorMessage = null;

    const approvalComment = this.comments.trim() || 'Approved via ProcuraX Enterprise Dashboard';
    this.procurementService.approveProcurement(this.request.id, approvalComment).subscribe({
      next: () => {
        this.processing = false;
        this.comments = '';
      },
      error: (err) => {
        this.processing = false;
        this.errorMessage = err?.error?.error || 'Approval request failed';
      }
    });
  }

  onReject() {
    if (!this.request || this.processing) return;
    this.processing = true;
    this.errorMessage = null;

    const reason = this.comments.trim() || 'Rejected during managerial review';
    this.procurementService.rejectProcurement(this.request.id, reason).subscribe({
      next: () => {
        this.processing = false;
        this.comments = '';
      },
      error: (err) => {
        this.processing = false;
        this.errorMessage = err?.error?.error || 'Rejection request failed';
      }
    });
  }
}
