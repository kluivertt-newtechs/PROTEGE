import { Routes } from '@angular/router';

export const salePriceRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./component/sale-price.component').then((c) => c.SalePriceComponent),
  },
];
