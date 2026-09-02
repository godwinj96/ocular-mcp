import { Outlet } from '@tanstack/react-router';
import { Nav } from '../components/nav.js';

// The ambient WebGL dot-field and the scroll-progress bar are both gone.
//
// The Instrument concept names the first explicitly ("Dot-field → static
// lattice or removed"), and its own behavioural note is the reason: this
// audience penalises a marketing page heavier than the product it sells, so
// shipping a WebGL background on a page selling a lightweight tool is a
// direct contradiction. The progress bar was non-informative decoration on a
// six-section page.
export function RootLayout() {
  return (
    <div className="min-h-screen overflow-x-hidden">
      <Nav />
      <main>
        <Outlet />
      </main>
    </div>
  );
}
