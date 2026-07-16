import { Routes } from '@angular/router';

export const homeRoutes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./component/home-page.component').then(
        (c) => c.HomePageComponent,
      ),
  },
];
