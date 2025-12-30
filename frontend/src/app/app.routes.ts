import { Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'all-tokens',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./all-tokens/all-tokens.component').then(
        m => m.AllTokensComponent
      ),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'all-tokens',
  },
  {
    path: '**',
    redirectTo: 'all-tokens',
  },
];