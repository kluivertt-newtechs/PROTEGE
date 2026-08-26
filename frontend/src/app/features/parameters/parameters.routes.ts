import { Routes } from '@angular/router';

export const parametersRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/parameters.component').then((c) => c.ParametersComponent),
  },
];
