import { Injectable } from '@angular/core';
import { CanActivate, Router, UrlTree } from '@angular/router';

@Injectable({ providedIn: 'root' })
export class AuthGuard implements CanActivate {
  canActivate(): boolean | UrlTree {
    const token = localStorage.getItem('procurex_auth_token');
    if (token) {
      return true;
    }
    return new Router().parseUrl('/auth');
  }
}
