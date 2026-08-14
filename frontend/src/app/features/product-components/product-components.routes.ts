import { Routes } from '@angular/router';

export const productComponentsRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/product-components.component').then((c) => c.ProductComponentsComponent),
  },
];
