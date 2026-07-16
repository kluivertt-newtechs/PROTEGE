import { Routes } from '@angular/router';
import { MainComponent } from './main/main.component';

export const routes: Routes = [
  {
    path: 'login',
    loadChildren: () =>
      import('./features/login/login.routes').then((r) => r.loginRoutes),
  },
  {
    path: '',
    component: MainComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'home' },
      {
        path: 'home',
        loadChildren: () =>
          import('./features/home/home.routes').then((r) => r.homeRoutes),
      },
      {
        path: 'pricing',
        loadChildren: () =>
          import('./features/pricing/pricing.routes').then(
            (r) => r.pricingRoutes,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
