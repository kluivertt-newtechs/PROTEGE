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
      // {
      //   path: 'home',
      //   loadChildren: () =>
      //     import('./features/home/home.routes').then((r) => r.homeRoutes),
      // },
      {
        path: 'pricing',
        loadChildren: () =>
          import('./features/pricing/pricing.routes').then(
            (r) => r.pricingRoutes,
          ),
      },
      {
        path: 'product-components',
        loadChildren: () =>
          import('./features/product-components/product-components.routes').then(
            (r) => r.productComponentsRoutes,
          ),
      },
      {
        path: 'price-components',
        loadComponent: () =>
          import('./features/formula-builder/component/formula-builder.component').then(
            (c) => c.FormulaBuilderComponent,
          ),
        data: {
          title: 'Componentes de Preço',
          catalogTitle: 'Catálogo de componentes de preço',
        },
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
      {
        path: 'simulation',
        loadChildren: () =>
          import('./features/simulation/simulation.routes').then(
            (r) => r.simulationRoutes,
          ),
      },
      {
        path: 'formula-builder',
        loadChildren: () =>
          import('./features/formula-builder/formula-builder.routes').then(
            (r) => r.formulaBuilderRoutes,
          ),
      },
      {
        path: 'consolidated',
        loadChildren: () =>
          import('./features/consolidated/consolidated.routes').then(
            (r) => r.consolidatedRoutes,
          ),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];
