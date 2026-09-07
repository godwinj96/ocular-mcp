'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';

// TanStack Query, tuned for a dashboard whose data barely moves.
//
// Almost everything here is server-rendered, and that stays true: the query
// layer is for the surfaces that poll or refetch (worker liveness, today's
// allowance) and for prefetching a destination before the user arrives at it.
//
// The cache is deliberately AGGRESSIVE. A subscription renews monthly, an
// allowance resets daily, a worker checks in every fifteen minutes -- none of
// it is worth a network round trip on every navigation. Long staleTime plus
// prefetch-on-intent means moving between pages costs nothing and shows no
// spinner, which is the behaviour the founder asked for.
//
// refetchOnWindowFocus is OFF. It is the right default for a trading screen and
// the wrong one for an ambient product: a user who alt-tabs back should see the
// page they left, not a flicker of re-fetching data that did not change.
const STALE_MS = 60_000;
const GC_MS = 30 * 60_000;

export function QueryProvider({ children }: { children: ReactNode }) {
  // useState, not a module-level client: on the server one client per request
  // keeps one user's data from being handed to the next.
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: STALE_MS,
            gcTime: GC_MS,
            refetchOnWindowFocus: false,
            retry: 1,
          },
        },
      }),
  );

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
