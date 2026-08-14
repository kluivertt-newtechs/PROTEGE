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
      { path: '', pathMatch: 'full', redirectTo: 'product-components' },
      { path: 'pricing', redirectTo: 'product-components' },
      { path: 'simulation', redirectTo: 'product-components' },
      { path: 'formula-builder', redirectTo: 'product-components' },
      { path: 'consolidated', redirectTo: 'product-components' },
      {
        path: 'product-components',
        loadChildren: () =>
          import('./features/product-components/product-components.routes').then(
            (r) => r.productComponentsRoutes,
          ),
      },
      {
        path: 'price-components',
        loadChildren: () =>
          import('./features/price-components/price-components.routes').then(
            (r) => r.priceComponentsRoutes,
          ),
      },
      {
        path: 'product-tree',
        loadChildren: () =>
          import('./features/product-tree/product-tree.routes').then(
            (r) => r.productTreeRoutes,
          ),
      },
      {
        path: 'sale-price',
        loadChildren: () =>
          import('./features/sale-price/sale-price.routes').then(
            (r) => r.salePriceRoutes,
          ),
      },
    ],
  },
  { path: '**', redirectTo: 'product-components' },
];
