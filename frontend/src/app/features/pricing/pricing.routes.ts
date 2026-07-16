import { Routes } from '@angular/router';

export const pricingRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/pricing.component').then((c) => c.PricingComponent),
  },
];
