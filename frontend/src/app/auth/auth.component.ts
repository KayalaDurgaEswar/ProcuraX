import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';

@Component({
  selector: 'app-auth',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="auth-container">
      <div class="auth-card">
        <div class="auth-header">
          <div class="auth-logo">
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 17L12 22L22 17" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </div>
          <h1>ProcuraX</h1>
          <p class="auth-subtitle">Enterprise AI Procurement Platform</p>
          <p class="auth-badge">ONDC / Beckn Protocol</p>
        </div>

        <div class="auth-form">
          <form (ngSubmit)="onLogin()">
            <div class="form-group">
              <label for="email">Email Address</label>
              <input
                type="email"
                id="email"
                [(ngModel)]="email"
                name="email"
                placeholder="Enter your corporate email"
                required
                autocomplete="email"
              />
            </div>

            <div class="form-group">
              <label for="password">Password</label>
              <input
                type="password"
                id="password"
                [(ngModel)]="password"
                name="password"
                placeholder="Enter your password"
                required
                autocomplete="current-password"
              />
            </div>

            <div class="form-options">
              <label class="checkbox-label">
                <input type="checkbox" [(ngModel)]="rememberMe" name="rememberMe" />
                <span>Remember me</span>
              </label>
              <a href="#" class="forgot-link">Forgot password?</a>
            </div>

            <button type="submit" class="btn-login" [disabled]="loading">
              <span>{{ loading ? 'Signing in...' : 'Sign In' }}</span>
            </button>
          </form>

          <div class="auth-footer">
            <p>Don't have an account? <a href="#">Contact Admin</a></p>
          </div>
        </div>
      </div>

      <div class="auth-footer-bottom">
        <p>&copy; 2026 ProcuraX. All rights reserved.</p>
      </div>
    </div>
  `,
  styles: [`
    .auth-container {
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
      padding: 20px;
    }
    .auth-card {
      background: rgba(30, 41, 59, 0.8);
      backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 24px;
      padding: 40px;
      width: 100%;
      max-width: 440px;
      box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
    }
    .auth-header {
      text-align: center;
      margin-bottom: 32px;
    }
    .auth-logo {
      margin: 0 auto 16px;
      color: #3b82f6;
    }
    .auth-header h1 {
      font-size: 32px;
      font-weight: 700;
      color: #ffffff;
      margin: 0 0 8px;
      letter-spacing: -0.5px;
    }
    .auth-subtitle {
      font-size: 15px;
      color: #94a3b8;
      margin: 0 0 8px;
    }
    .auth-badge {
      font-size: 11px;
      font-weight: 600;
      background: rgba(6, 182, 212, 0.15);
      color: #06b6d4;
      border: 1px solid rgba(6, 182, 212, 0.3);
      padding: 4px 10px;
      border-radius: 20px;
      display: inline-block;
    }
    .auth-form {
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .form-group {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }
    .form-group label {
      font-size: 13px;
      font-weight: 500;
      color: #cbd5e1;
    }
    .form-group input {
      width: 100%;
      background: rgba(15, 23, 42, 0.6);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 14px 16px;
      color: #ffffff;
      font-size: 14px;
      transition: all 0.2s;
      outline: none;
    }
    .form-group input:focus {
      border-color: #3b82f6;
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2);
    }
    .form-options {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 13px;
    }
    .checkbox-label {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #94a3b8;
      cursor: pointer;
    }
    .checkbox-label input {
      width: 16px;
      height: 16px;
      accent-color: #3b82f6;
    }
    .forgot-link {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }
    .btn-login {
      width: 100%;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      border: none;
      color: white;
      padding: 14px;
      border-radius: 12px;
      font-size: 15px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
      margin-top: 8px;
    }
    .btn-login:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 24px rgba(59, 130, 246, 0.3);
    }
    .btn-login:disabled {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
    }
    .auth-footer {
      text-align: center;
      margin-top: 16px;
      font-size: 13px;
      color: #94a3b8;
    }
    .auth-footer a {
      color: #3b82f6;
      text-decoration: none;
      font-weight: 500;
    }
    .auth-footer-bottom {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: #64748b;
    }
  `]
})
export class AuthComponent {
  email: string = '';
  password: string = '';
  rememberMe: boolean = false;
  loading: boolean = false;

  constructor(private router: Router) {}

  onLogin() {
    if (!this.email || !this.password) return;
    this.loading = true;

    // Simulate authentication
    setTimeout(() => {
      this.loading = false;
      // Store auth token in localStorage
      localStorage.setItem('procurex_auth_token', 'authenticated');
      localStorage.setItem('procurex_user', JSON.stringify({
        name: 'Durga Eswar',
        email: this.email,
        role: 'Procurement Lead',
        approvalLimitPaise: 50000000
      }));
      this.router.navigate(['/dashboard']);
    }, 1000);
  }
}
