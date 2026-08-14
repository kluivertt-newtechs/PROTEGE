import { Routes } from '@angular/router';

export const priceComponentsRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./component/price-components.component').then((c) => c.PriceComponentsComponent),
  },
];
