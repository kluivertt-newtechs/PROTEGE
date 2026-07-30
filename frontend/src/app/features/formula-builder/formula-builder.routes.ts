import { Routes } from '@angular/router';

export const formulaBuilderRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/formula-builder.component').then(
        (c) => c.FormulaBuilderComponent,
      ),
  },
];
