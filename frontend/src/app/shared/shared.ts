// shared.ts
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import {} from '@angular/common/http';
import {
  PoModule,
  PoBreadcrumbModule,
  PoPageModule,
  PoTableModule,
} from '@po-ui/ng-components';
import {
  PoPageDynamicTableModule,
  PoPageLoginModule,
} from '@po-ui/ng-templates';

export const SHARED_MODULES = [
  RouterModule,
  FormsModule,
  ReactiveFormsModule,
  PoModule,
  PoBreadcrumbModule,
  PoPageModule,
  PoTableModule,
  PoPageDynamicTableModule,
  PoPageLoginModule,
];
