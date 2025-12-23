import { LoginComponent } from './login/login.component';
import { AuthGuard } from './auth/auth.guard';
import { Routes } from '@angular/router';

export const routes = [
  {
    path: 'login',
    loadComponent: () => LoginComponent
  },
  {
    path: '',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./app.component').then(m => m.AppComponent),
  }
];
