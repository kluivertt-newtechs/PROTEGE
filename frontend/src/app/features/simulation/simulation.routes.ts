import { Routes } from '@angular/router';

export const simulationRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/simulation.component').then((c) => c.SimulationComponent),
  },
];
