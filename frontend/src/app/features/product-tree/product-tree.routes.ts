import { Routes } from '@angular/router';

export const productTreeRoutes: Routes = [
  {
    path: '',
    loadComponent: () => import('./component/product-tree.component').then((c) => c.ProductTreeComponent),
  },
];
