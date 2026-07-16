import { Routes } from '@angular/router';

export const consolidatedRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/consolidated.component').then((c) => c.ConsolidatedComponent),
  },
];
