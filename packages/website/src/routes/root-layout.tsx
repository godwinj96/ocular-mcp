import { Outlet } from '@tanstack/react-router';
import { DotField } from '../components/dot-field.js';
import { ScrollProgress } from '../components/scroll-progress.js';
import { Nav } from '../components/nav.js';

// Shared shell for every route — the ambient WebGL background, scroll
// progress bar, and floating nav pill are brand chrome, not homepage-
// specific content, so they live at the router root rather than being
// duplicated per page.
export function RootLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <DotField />
      <ScrollProgress />
      <Nav />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
