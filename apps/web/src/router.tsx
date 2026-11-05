import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { AppShell } from './components/layout/AppShell';
import { AllPagesRoute } from './routes/AllPagesRoute';
import { CalendarRoute } from './routes/CalendarRoute';
import { DailyNotesRoute } from './routes/DailyNotesRoute';
import { PageRoute } from './routes/PageRoute';
import { SettingsRoute } from './routes/SettingsRoute';
import { TrashRoute } from './routes/TrashRoute';

const rootRoute = createRootRoute({ component: AppShell });

const routeTree = rootRoute.addChildren([
  createRoute({ getParentRoute: () => rootRoute, path: '/', component: DailyNotesRoute }),
  createRoute({
    getParentRoute: () => rootRoute,
    path: '/page/$title',
    component: PageRoute,
    validateSearch: (search: Record<string, unknown>): { zoom?: string } =>
      typeof search.zoom === 'string' && search.zoom ? { zoom: search.zoom } : {},
  }),
  createRoute({ getParentRoute: () => rootRoute, path: '/pages', component: AllPagesRoute }),
  createRoute({ getParentRoute: () => rootRoute, path: '/calendar', component: CalendarRoute }),
  createRoute({ getParentRoute: () => rootRoute, path: '/settings', component: SettingsRoute }),
  createRoute({ getParentRoute: () => rootRoute, path: '/trash', component: TrashRoute }),
]);

export const router = createRouter({ routeTree, defaultPreload: 'intent' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
