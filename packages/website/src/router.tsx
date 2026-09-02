import { createRootRoute, createRoute, createRouter } from '@tanstack/react-router';
import { RootLayout } from './routes/root-layout.js';
import { HomePage } from './routes/home-page.js';
import { SetupPage } from './routes/setup-page.js';

// Code-based routes (not file-based generation) — deliberately, for a
// two-route marketing site the extra Vite plugin + route-tree codegen step
// isn't worth it. Revisit if the route count grows enough to justify it.
const rootRoute = createRootRoute({ component: RootLayout });

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const setupRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/setup',
  component: SetupPage,
});

const routeTree = rootRoute.addChildren([indexRoute, setupRoute]);

export const router = createRouter({ routeTree });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}
