// import { Routes } from '@angular/router';
// import { AuthGuard } from './auth/auth.guard';

// export const routes: Routes = [
//   {
//     path: '',
//     loadComponent: () =>
//       import('./login/login.component').then(m => m.LoginComponent),
//   },
//   // {
//   //   path: 'all-tokens',
//   //   canActivate: [AuthGuard],
//   //   loadComponent: () =>
//   //     import('./all-tokens/all-tokens.component').then(
//   //       m => m.AllTokensComponent
//   //     ),
//   // },
//   {
//     path: 'AppComponent',
//     pathMatch: 'full',
//     redirectTo: 'dashboard',
//   },
//   {
//     path: '**',
//     redirectTo: 'dashboard',
//   },
// ];

import { Routes } from '@angular/router';
import { AuthGuard } from './auth/auth.guard';

export const routes: Routes = [
  // Login page (default)
  {
    path: '',
    loadComponent: () =>
      import('./login/login.component').then(m => m.LoginComponent),
  },

  // Dashboard (protected)
  {
    path: 'dashboard',
    canActivate: [AuthGuard],
    loadComponent: () =>
      import('./app.component').then(m => m.AppComponent),
  },

  // Wildcard → login
  {
    path: '**',
    redirectTo: '',
  },
];
