import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  template: `
    <header class="app-header">
      <div class="brand">
        <div class="logo-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="brand-text">
          <h1>ProcuraX <span class="badge-beckn">ONDC / Beckn Protocol</span></h1>
          <p>Autonomous AI Enterprise Procurement Platform</p>
        </div>
      </div>
      <div class="header-controls">
        <div class="status-indicator">
          <span class="status-dot green"></span>
          <span>Beckn Node: <strong>Active</strong></span>
        </div>
        <div class="user-pill">
          <span class="avatar">DE</span>
          <div class="user-info">
            <span class="user-name">Durga Eswar (Lead)</span>
            <span class="user-role">AI Procurement Lead</span>
          </div>
        </div>
      </div>
    </header>
  `,
  styles: [`
    .app-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 32px;
      background: rgba(10, 10, 12, 0.75);
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      backdrop-filter: blur(30px) saturate(200%);
      -webkit-backdrop-filter: blur(30px) saturate(200%);
      box-shadow: 0 4px 30px rgba(0, 0, 0, 0.5);
    }
    .brand { display: flex; align-items: center; gap: 14px; }
    .logo-icon {
      font-size: 24px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
      border: 1px solid rgba(255, 255, 255, 0.2);
      padding: 6px 14px;
      border-radius: 16px;
      box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.3);
    }
    .brand-text h1 {
      font-size: 20px;
      font-weight: 700;
      letter-spacing: -0.5px;
      display: flex;
      align-items: center;
      gap: 10px;
      color: #ffffff;
    }
    .badge-beckn {
      font-size: 10px;
      font-weight: 600;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      background: rgba(255, 255, 255, 0.08);
      color: var(--accent-silver);
      border: 1px solid rgba(255, 255, 255, 0.18);
      padding: 3px 10px;
      border-radius: 20px;
    }
    .brand-text p { font-size: 12px; color: var(--text-muted); }
    .header-controls { display: flex; align-items: center; gap: 20px; }
    .status-indicator {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      background: rgba(255, 255, 255, 0.05);
      padding: 6px 14px;
      border-radius: 20px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: var(--text-muted);
    }
    .status-dot { width: 8px; height: 8px; border-radius: 50%; }
    .status-dot.green { background-color: var(--accent-emerald); box-shadow: 0 0 10px var(--accent-emerald); }
    .user-pill { display: flex; align-items: center; gap: 10px; }
    .avatar {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #ffffff, #a1a1aa);
      color: #000000;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 2px 10px rgba(255, 255, 255, 0.2);
    }
    .user-info { display: flex; flex-direction: column; }
    .user-name { font-size: 13px; font-weight: 600; color: #ffffff; }
    .user-role { font-size: 11px; color: var(--text-muted); }
  `]
})
export class HeaderComponent {}
