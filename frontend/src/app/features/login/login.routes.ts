import { Routes } from '@angular/router';

export const loginRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/login.component').then((c) => c.LoginComponent),
  },
];
