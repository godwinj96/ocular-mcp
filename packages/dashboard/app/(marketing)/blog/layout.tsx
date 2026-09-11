import type { ReactNode } from 'react';

import '../prose.css';

// Exists for one reason: to import prose.css here rather than in the marketing
// layout, so the article stylesheet ships on blog routes and not on the
// homepage. It adds no markup and no auth -- the (marketing) layout above
// already supplies Nav and the shell, and anything that read request state
// here would opt every post out of static rendering, which is the whole point
// of the migration.
export default function BlogLayout({ children }: { children: ReactNode }) {
  return children;
}
