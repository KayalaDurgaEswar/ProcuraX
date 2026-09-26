import { Routes } from '@angular/router';
import { AppComponent } from './app.component';

export const APP_ROUTES: Routes = [
  { path: '', component: AppComponent },
  { path: 'dashboard', component: AppComponent },
  { path: '**', component: AppComponent }
];
