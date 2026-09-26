import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

interface Analytics {
  summary: {
    totalRequests: number;
    completedOrders: number;
    pendingApprovals: number;
    activeNegotiations: number;
    totalSpendINR: number;
    estimatedSavingsINR: number;
    avgProcessingTimeMinutes: number;
    successRate: number;
  };
  categoryBreakdown: { [key: string]: number };
  stateDistribution: { [key: string]: number };
  vendorPerformance: Array<{
    vendor: string;
    totalOffers: number;
    avgPrice: number;
  }>;
}

@Component({
  selector: 'app-analytics-dashboard',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="analytics-container">
      <div class="analytics-header">
        <h2>📊 Procurement Analytics Dashboard</h2>
        <button class="refresh-btn" (click)="loadAnalytics()">
          <span>🔄</span> Refresh
        </button>
      </div>

      <div *ngIf="loading" class="loading-state">
        <div class="spinner"></div>
        <p>Loading analytics...</p>
      </div>

      <div *ngIf="!loading && analytics" class="analytics-content">
        <!-- KPI Cards -->
        <div class="kpi-grid">
          <div class="kpi-card">
            <div class="kpi-icon">📋</div>
            <div class="kpi-content">
              <div class="kpi-value">{{ analytics.summary.totalRequests }}</div>
              <div class="kpi-label">Total Requests</div>
            </div>
          </div>

          <div class="kpi-card success">
            <div class="kpi-icon">✅</div>
            <div class="kpi-content">
              <div class="kpi-value">{{ analytics.summary.completedOrders }}</div>
              <div class="kpi-label">Completed Orders</div>
            </div>
          </div>

          <div class="kpi-card warning">
            <div class="kpi-icon">⏳</div>
            <div class="kpi-content">
              <div class="kpi-value">{{ analytics.summary.pendingApprovals }}</div>
              <div class="kpi-label">Pending Approvals</div>
            </div>
          </div>

          <div class="kpi-card info">
            <div class="kpi-icon">🤝</div>
            <div class="kpi-content">
              <div class="kpi-value">{{ analytics.summary.activeNegotiations }}</div>
              <div class="kpi-label">Active Negotiations</div>
            </div>
          </div>

          <div class="kpi-card accent">
            <div class="kpi-icon">💰</div>
            <div class="kpi-content">
              <div class="kpi-value">₹{{ formatNumber(analytics.summary.totalSpendINR) }}</div>
              <div class="kpi-label">Total Spend</div>
            </div>
          </div>

          <div class="kpi-card savings">
            <div class="kpi-icon">💎</div>
            <div class="kpi-content">
              <div class="kpi-value">₹{{ formatNumber(analytics.summary.estimatedSavingsINR) }}</div>
              <div class="kpi-label">Estimated Savings</div>
            </div>
          </div>

          <div class="kpi-card">
            <div class="kpi-icon">⚡</div>
            <div class="kpi-content">
              <div class="kpi-value">{{ analytics.summary.avgProcessingTimeMinutes }}m</div>
              <div class="kpi-label">Avg Processing Time</div>
            </div>
          </div>

          <div class="kpi-card success">
            <div class="kpi-icon">📈</div>
            <div class="kpi-content">
              <div class="kpi-value">{{ analytics.summary.successRate }}%</div>
              <div class="kpi-label">Success Rate</div>
            </div>
          </div>
        </div>

        <!-- Charts Section -->
        <div class="charts-grid">
          <!-- Category Breakdown -->
          <div class="chart-card">
            <h3>📦 Procurement by Category</h3>
            <div class="chart-content">
              <div *ngFor="let item of getCategoryData()" class="bar-item">
                <div class="bar-label">{{ item.name }}</div>
                <div class="bar-wrapper">
                  <div class="bar-fill" [style.width.%]="item.percentage"></div>
                  <span class="bar-value">{{ item.count }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- State Distribution -->
          <div class="chart-card">
            <h3>🔄 Request State Distribution</h3>
            <div class="chart-content">
              <div *ngFor="let item of getStateData()" class="bar-item">
                <div class="bar-label">{{ item.name }}</div>
                <div class="bar-wrapper">
                  <div class="bar-fill state-bar" [style.width.%]="item.percentage"></div>
                  <span class="bar-value">{{ item.count }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Vendor Performance -->
          <div class="chart-card full-width">
            <h3>🏪 Top Vendor Performance</h3>
            <div class="vendor-grid">
              <div *ngFor="let vendor of analytics.vendorPerformance.slice(0, 6)" class="vendor-card">
                <div class="vendor-name">{{ vendor.vendor }}</div>
                <div class="vendor-stats">
                  <div class="vendor-stat">
                    <span class="stat-label">Offers:</span>
                    <span class="stat-value">{{ vendor.totalOffers }}</span>
                  </div>
                  <div class="vendor-stat">
                    <span class="stat-label">Avg Price:</span>
                    <span class="stat-value">₹{{ formatNumber(vendor.avgPrice) }}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .analytics-container {
      padding: 20px;
    }
    .analytics-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 24px;
    }
    .analytics-header h2 {
      font-size: 24px;
      color: #ffffff;
      margin: 0;
    }
    .refresh-btn {
      background: rgba(59, 130, 246, 0.2);
      border: 1px solid rgba(59, 130, 246, 0.3);
      color: #3b82f6;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      transition: all 0.2s;
    }
    .refresh-btn:hover {
      background: rgba(59, 130, 246, 0.3);
      transform: translateY(-2px);
    }
    .loading-state {
      text-align: center;
      padding: 60px;
      color: #94a3b8;
    }
    .spinner {
      width: 40px;
      height: 40px;
      border: 3px solid rgba(59, 130, 246, 0.2);
      border-top-color: #3b82f6;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .kpi-card {
      background: rgba(30, 41, 59, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 20px;
      display: flex;
      align-items: center;
      gap: 16px;
      transition: all 0.2s;
    }
    .kpi-card:hover {
      transform: translateY(-4px);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
    }
    .kpi-card.success { border-left: 3px solid #10b981; }
    .kpi-card.warning { border-left: 3px solid #f59e0b; }
    .kpi-card.info { border-left: 3px solid #3b82f6; }
    .kpi-card.accent { border-left: 3px solid #8b5cf6; }
    .kpi-card.savings { border-left: 3px solid #06b6d4; }
    .kpi-icon {
      font-size: 32px;
      opacity: 0.9;
    }
    .kpi-content {
      flex: 1;
    }
    .kpi-value {
      font-size: 24px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 4px;
    }
    .kpi-label {
      font-size: 12px;
      color: #94a3b8;
      font-weight: 500;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .charts-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
      gap: 20px;
    }
    .chart-card {
      background: rgba(30, 41, 59, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
    }
    .chart-card.full-width {
      grid-column: 1 / -1;
    }
    .chart-card h3 {
      font-size: 18px;
      color: #ffffff;
      margin: 0 0 20px;
    }
    .bar-item {
      margin-bottom: 16px;
    }
    .bar-label {
      font-size: 13px;
      color: #cbd5e1;
      margin-bottom: 6px;
      font-weight: 500;
    }
    .bar-wrapper {
      position: relative;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 6px;
      height: 32px;
      overflow: hidden;
    }
    .bar-fill {
      background: linear-gradient(90deg, #3b82f6, #8b5cf6);
      height: 100%;
      transition: width 0.6s ease;
      display: flex;
      align-items: center;
      justify-content: flex-end;
      padding-right: 10px;
      min-width: 40px;
    }
    .bar-fill.state-bar {
      background: linear-gradient(90deg, #06b6d4, #3b82f6);
    }
    .bar-value {
      position: absolute;
      right: 10px;
      top: 50%;
      transform: translateY(-50%);
      font-size: 12px;
      font-weight: 700;
      color: #ffffff;
    }
    .vendor-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
    }
    .vendor-card {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 16px;
    }
    .vendor-name {
      font-size: 14px;
      font-weight: 600;
      color: #ffffff;
      margin-bottom: 12px;
    }
    .vendor-stats {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .vendor-stat {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
    }
    .stat-label {
      color: #94a3b8;
    }
    .stat-value {
      color: #3b82f6;
      font-weight: 600;
    }
  `]
})
export class AnalyticsDashboardComponent implements OnInit {
  analytics: Analytics | null = null;
  loading = true;

  constructor(private http: HttpClient) {}

  ngOnInit() {
    this.loadAnalytics();
  }

  loadAnalytics() {
    this.loading = true;
    this.http.get<Analytics>('/api/analytics/dashboard').subscribe({
      next: (data) => {
        this.analytics = data;
        this.loading = false;
      },
      error: (err) => {
        console.error('Failed to load analytics:', err);
        this.loading = false;
      }
    });
  }

  formatNumber(num: number): string {
    if (num >= 10000000) return (num / 10000000).toFixed(2) + 'Cr';
    if (num >= 100000) return (num / 100000).toFixed(2) + 'L';
    if (num >= 1000) return (num / 1000).toFixed(2) + 'K';
    return num.toFixed(2);
  }

  getCategoryData() {
    if (!this.analytics) return [];
    const data = Object.entries(this.analytics.categoryBreakdown);
    const total = data.reduce((sum, [, count]) => sum + count, 0);
    return data.map(([name, count]) => ({
      name,
      count,
      percentage: (count / total) * 100
    })).sort((a, b) => b.count - a.count);
  }

  getStateData() {
    if (!this.analytics) return [];
    const data = Object.entries(this.analytics.stateDistribution);
    const total = data.reduce((sum, [, count]) => sum + count, 0);
    return data.map(([name, count]) => ({
      name,
      count,
      percentage: (count / total) * 100
    })).sort((a, b) => b.count - a.count);
  }
}
