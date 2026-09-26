import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';

@Component({
  selector: 'app-bulk-import',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="bulk-import-container">
      <div class="import-header">
        <h2>📤 Bulk Import Procurements</h2>
        <p>Upload multiple procurement requests at once using CSV format</p>
      </div>

      <div class="import-card">
        <div class="upload-area" 
             (dragover)="onDragOver($event)" 
             (drop)="onDrop($event)"
             (click)="fileInput.click()">
          <div class="upload-icon">📁</div>
          <h3>Drop CSV file here or click to browse</h3>
          <p class="upload-hint">Supports .csv files with columns: prompt, userId, orgId</p>
          <input #fileInput type="file" accept=".csv" hidden (change)="onFileSelected($event)">
        </div>

        <div *ngIf="csvData.length > 0" class="preview-section">
          <div class="preview-header">
            <h3>Preview ({{ csvData.length }} rows)</h3>
            <button class="btn-clear" (click)="clearData()">Clear</button>
          </div>
          <div class="preview-table">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <th>Prompt</th>
                  <th>User ID</th>
                  <th>Org ID</th>
                </tr>
              </thead>
              <tbody>
                <tr *ngFor="let row of csvData.slice(0, 5); let i = index">
                  <td>{{ i + 1 }}</td>
                  <td class="prompt-cell">{{ row.prompt }}</td>
                  <td>{{ row.userId || 'default' }}</td>
                  <td>{{ row.orgId || 'default' }}</td>
                </tr>
              </tbody>
            </table>
            <p *ngIf="csvData.length > 5" class="more-rows">
              + {{ csvData.length - 5 }} more rows...
            </p>
          </div>
        </div>

        <button *ngIf="csvData.length > 0" 
                class="btn-import" 
                [disabled]="importing"
                (click)="importData()">
          <span *ngIf="!importing">🚀 Import {{ csvData.length }} Procurements</span>
          <span *ngIf="importing">⏳ Importing...</span>
        </button>

        <div *ngIf="importResult" class="result-section">
          <div class="result-card" [ngClass]="importResult.errors.length === 0 ? 'success' : 'partial'">
            <h3>{{ importResult.message }}</h3>
            <div class="result-stats">
              <div class="stat-item success">
                <span class="stat-icon">✅</span>
                <span class="stat-value">{{ importResult.results.length }} Succeeded</span>
              </div>
              <div class="stat-item error" *ngIf="importResult.errors.length > 0">
                <span class="stat-icon">❌</span>
                <span class="stat-value">{{ importResult.errors.length }} Failed</span>
              </div>
            </div>
            <div *ngIf="importResult.errors.length > 0" class="error-list">
              <h4>Errors:</h4>
              <div *ngFor="let error of importResult.errors" class="error-item">
                Row {{ error.row }}: {{ error.error }}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div class="sample-section">
        <h3>📋 Sample CSV Format</h3>
        <div class="code-block">
          <pre>prompt,userId,orgId
"Order 100 laptops with 16GB RAM and 512GB SSD",user_001,org_acme
"Purchase 50 office chairs with ergonomic design",user_002,org_acme
"Get 200 notebooks and 100 pens for office supplies",user_001,org_acme</pre>
        </div>
        <button class="btn-download" (click)="downloadSample()">
          💾 Download Sample CSV
        </button>
      </div>
    </div>
  `,
  styles: [`
    .bulk-import-container {
      padding: 20px;
      max-width: 1000px;
      margin: 0 auto;
    }
    .import-header {
      margin-bottom: 24px;
    }
    .import-header h2 {
      font-size: 24px;
      color: #ffffff;
      margin: 0 0 8px;
    }
    .import-header p {
      color: #94a3b8;
      margin: 0;
    }
    .import-card {
      background: rgba(30, 41, 59, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .upload-area {
      border: 2px dashed rgba(59, 130, 246, 0.3);
      border-radius: 12px;
      padding: 60px 20px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      background: rgba(0, 0, 0, 0.2);
    }
    .upload-area:hover {
      border-color: #3b82f6;
      background: rgba(59, 130, 246, 0.1);
    }
    .upload-icon {
      font-size: 64px;
      margin-bottom: 16px;
    }
    .upload-area h3 {
      font-size: 18px;
      color: #ffffff;
      margin: 0 0 8px;
    }
    .upload-hint {
      font-size: 14px;
      color: #94a3b8;
      margin: 0;
    }
    .preview-section {
      margin-top: 24px;
    }
    .preview-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .preview-header h3 {
      font-size: 16px;
      color: #ffffff;
      margin: 0;
    }
    .btn-clear {
      background: rgba(239, 68, 68, 0.2);
      border: 1px solid rgba(239, 68, 68, 0.3);
      color: #ef4444;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 13px;
      font-weight: 600;
    }
    .preview-table {
      background: rgba(0, 0, 0, 0.3);
      border-radius: 8px;
      overflow: hidden;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 12px;
      text-align: left;
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
    }
    th {
      background: rgba(59, 130, 246, 0.2);
      color: #3b82f6;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    td {
      color: #cbd5e1;
      font-size: 13px;
    }
    .prompt-cell {
      max-width: 400px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .more-rows {
      padding: 12px;
      text-align: center;
      color: #64748b;
      font-size: 13px;
      font-style: italic;
      margin: 0;
    }
    .btn-import {
      width: 100%;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border: none;
      color: white;
      padding: 16px;
      border-radius: 8px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      margin-top: 20px;
      transition: all 0.2s;
    }
    .btn-import:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
    }
    .btn-import:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
    .result-section {
      margin-top: 24px;
    }
    .result-card {
      padding: 20px;
      border-radius: 8px;
      border-left: 4px solid;
    }
    .result-card.success {
      background: rgba(16, 185, 129, 0.1);
      border-color: #10b981;
    }
    .result-card.partial {
      background: rgba(245, 158, 11, 0.1);
      border-color: #f59e0b;
    }
    .result-card h3 {
      font-size: 16px;
      color: #ffffff;
      margin: 0 0 16px;
    }
    .result-stats {
      display: flex;
      gap: 16px;
      margin-bottom: 16px;
    }
    .stat-item {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 14px;
      font-weight: 600;
    }
    .stat-item.success { color: #10b981; }
    .stat-item.error { color: #ef4444; }
    .error-list {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid rgba(255, 255, 255, 0.1);
    }
    .error-list h4 {
      font-size: 14px;
      color: #ef4444;
      margin: 0 0 8px;
    }
    .error-item {
      font-size: 12px;
      color: #fca5a5;
      padding: 4px 0;
    }
    .sample-section {
      background: rgba(30, 41, 59, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 24px;
    }
    .sample-section h3 {
      font-size: 16px;
      color: #ffffff;
      margin: 0 0 16px;
    }
    .code-block {
      background: rgba(0, 0, 0, 0.4);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 16px;
    }
    .code-block pre {
      margin: 0;
      color: #06b6d4;
      font-family: 'JetBrains Mono', monospace;
      font-size: 13px;
      line-height: 1.6;
      overflow-x: auto;
    }
    .btn-download {
      background: rgba(6, 182, 212, 0.2);
      border: 1px solid rgba(6, 182, 212, 0.3);
      color: #06b6d4;
      padding: 10px 20px;
      border-radius: 8px;
      cursor: pointer;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s;
    }
    .btn-download:hover {
      background: rgba(6, 182, 212, 0.3);
      transform: translateY(-2px);
    }
  `]
})
export class BulkImportComponent {
  csvData: any[] = [];
  importing = false;
  importResult: any = null;

  constructor(private http: HttpClient) {}

  onDragOver(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
  }

  onDrop(event: DragEvent) {
    event.preventDefault();
    event.stopPropagation();
    const files = event.dataTransfer?.files;
    if (files && files.length > 0) {
      this.parseCSV(files[0]);
    }
  }

  onFileSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      this.parseCSV(file);
    }
  }

  parseCSV(file: File) {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      
      this.csvData = lines.slice(1).map(line => {
        const values = this.parseCSVLine(line);
        const row: any = {};
        headers.forEach((header, i) => {
          row[header] = values[i] || '';
        });
        return row;
      });
    };
    reader.readAsText(file);
  }

  parseCSVLine(line: string): string[] {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current.trim());
    return result;
  }

  clearData() {
    this.csvData = [];
    this.importResult = null;
  }

  importData() {
    this.importing = true;
    this.importResult = null;

    this.http.post('/api/procurements/bulk', { procurements: this.csvData }).subscribe({
      next: (result: any) => {
        this.importResult = result;
        this.importing = false;
        if (result.errors.length === 0) {
          setTimeout(() => {
            this.clearData();
          }, 3000);
        }
      },
      error: (err) => {
        console.error('Import failed:', err);
        this.importing = false;
        alert('Import failed: ' + err.message);
      }
    });
  }

  downloadSample() {
    const csv = `prompt,userId,orgId
"Order 100 laptops with 16GB RAM and 512GB SSD",user_001,org_acme
"Purchase 50 office chairs with ergonomic design",user_002,org_acme
"Get 200 notebooks and 100 pens for office supplies",user_001,org_acme
"Procure 25 monitors 27-inch 4K resolution",user_003,org_acme
"Buy 10 printers with duplex printing capability",user_001,org_acme`;

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'procurement_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
  }
}
