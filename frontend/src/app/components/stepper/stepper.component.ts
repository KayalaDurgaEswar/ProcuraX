import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-stepper',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="stepper-container">
      <!-- Special Terminal State Indicators -->
      <div *ngIf="isCancelled" class="stepper-status-banner cancelled">
        <span>🚫 Workflow Terminated: CANCELLED (Request rejected by Manager / Approver)</span>
      </div>

      <div *ngIf="isFailed" class="stepper-status-banner failed">
        <span>⚠️ Workflow Terminated: FAILED (Execution encountered validation or network exception)</span>
      </div>

      <div class="stepper-wrapper">
        <div class="stepper">
          <div
            *ngFor="let step of steps; let idx = index"
            class="step-node"
            [class.completed]="!isTerminated && idx < currentIndex"
            [class.active]="!isTerminated && idx === currentIndex"
            [class.frozen]="isTerminated"
          >
            <div class="step-circle">{{ idx + 1 }}</div>
            <div class="step-label">{{ step.replace('_', ' ') }}</div>
            <div *ngIf="idx < steps.length - 1" class="step-line"></div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .stepper-container { display: flex; flex-direction: column; gap: 10px; }
    .stepper-status-banner {
      padding: 8px 14px;
      border-radius: var(--radius-sm);
      font-size: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .stepper-status-banner.cancelled {
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid var(--accent-rose);
      color: var(--accent-rose);
    }
    .stepper-status-banner.failed {
      background: rgba(251, 191, 36, 0.12);
      border: 1px solid var(--accent-amber);
      color: var(--accent-amber);
    }
    .stepper-wrapper { overflow-x: auto; padding-bottom: 8px; }
    .stepper { display: flex; align-items: center; min-width: 750px; }
    .step-node { display: flex; flex-direction: column; align-items: center; position: relative; flex: 1; }
    .step-circle {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #334155;
      color: var(--text-muted);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 12px;
      font-weight: 700;
      z-index: 2;
      border: 2px solid var(--bg-primary);
      transition: all 0.3s;
    }
    .step-node.completed .step-circle { background: var(--accent-emerald); color: #000000; }
    .step-node.active .step-circle {
      background: var(--accent-blue);
      color: white;
      box-shadow: 0 0 12px var(--accent-blue);
      transform: scale(1.15);
    }
    .step-node.frozen .step-circle { opacity: 0.4; }
    .step-label { font-size: 10px; font-weight: 600; color: var(--text-dim); margin-top: 6px; text-transform: uppercase; }
    .step-node.active .step-label { color: var(--accent-blue); }
    .step-node.completed .step-label { color: var(--accent-emerald); }
    .step-line {
      position: absolute;
      top: 14px;
      left: 50%;
      width: 100%;
      height: 3px;
      background: #334155;
      z-index: 1;
    }
    .step-node.completed .step-line { background: var(--accent-emerald); }
  `]
})
export class StepperComponent {
  @Input() currentState: string = 'RECEIVED';

  steps = [
    'RECEIVED',
    'PARSED',
    'VALIDATED',
    'SEARCHING',
    'OFFERS_RECEIVED',
    'COMPARING',
    'NEGOTIATING',
    'PENDING_APPROVAL',
    'APPROVED',
    'ORDERING',
    'TRACKING'
  ];

  get isFailed(): boolean {
    return this.currentState === 'FAILED';
  }

  get isCancelled(): boolean {
    return this.currentState === 'CANCELLED';
  }

  get isTerminated(): boolean {
    return this.isFailed || this.isCancelled;
  }

  get currentIndex(): number {
    const idx = this.steps.indexOf(this.currentState);
    return idx >= 0 ? idx : 0;
  }
}
