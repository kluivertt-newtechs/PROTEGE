import { importProvidersFrom, provideZoneChangeDetection } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { PreloadAllModules, provideRouter, withPreloading } from '@angular/router';
import { routes } from './app/app-routing';
import { AppComponent } from './app.component';

bootstrapApplication(AppComponent, {
  providers: [
    provideZoneChangeDetection(),
    provideRouter(routes, withPreloading(PreloadAllModules)),
    importProvidersFrom(BrowserAnimationsModule),
  ],
}).catch((err) => console.error(err));
