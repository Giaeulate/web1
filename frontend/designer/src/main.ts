import 'zone.js';
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { provideRouter, withHashLocation } from '@angular/router';
import { routes } from './app/app.routes';
import { provideHttpClient, withXsrfConfiguration } from '@angular/common/http';
import { InjectionToken } from '@angular/core';

export interface DjangoConfig {
  title: string;
  extra: any;
  seatmap: { id?: number|string; pk?: string; name?: string; venue?: any };
  urls: { change: string; changelist: string };
  csrfCookie: string;
  apiBase: string;
}

export const DJANGO_CONFIG = new InjectionToken<DjangoConfig>('DJANGO_CONFIG');

function readDjangoConfig(): DjangoConfig {
  const el = document.getElementById('dj-config') as HTMLScriptElement | null;
  if (!el?.textContent) {
    console.warn('dj-config no encontrado, usando defaults');
    return { title: 'Designer', extra: {}, seatmap: {}, urls: { change: '#', changelist: '#' }, csrfCookie: 'csrftoken', apiBase: '/' };
  }
  return JSON.parse(el.textContent) as DjangoConfig;
}

bootstrapApplication(App, {
  providers: [
    { provide: DJANGO_CONFIG, useFactory: readDjangoConfig },
    provideRouter(routes, withHashLocation()),
    provideHttpClient(withXsrfConfiguration({ cookieName: 'csrftoken', headerName: 'X-CSRFToken' })),
  ],
}).catch(console.error);
