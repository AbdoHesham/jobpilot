import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/auth-guard';

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · JobPilot',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'signup',
    title: 'Create account · JobPilot',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/signup').then((m) => m.Signup),
  },
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./features/shell/shell').then((m) => m.Shell),
    children: [
      {
        path: 'jobs',
        title: 'Jobs · JobPilot',
        loadComponent: () => import('./features/jobs/jobs').then((m) => m.Jobs),
      },
      {
        path: 'cvs',
        title: 'CVs · JobPilot',
        loadComponent: () => import('./features/cvs/cvs').then((m) => m.Cvs),
      },
      { path: '', pathMatch: 'full', redirectTo: 'jobs' },
    ],
  },
  { path: '**', redirectTo: '' },
];
