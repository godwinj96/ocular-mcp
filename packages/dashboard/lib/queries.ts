'use client';

import { useQuery } from '@tanstack/react-query';
import type { Worker } from './workers';

// The client query layer. Deliberately small.
//
// Server components already render every surface with fresh data, so a query
// layer that duplicated all of it would add a second source of truth and a
// second set of loading states for no gain. What it is FOR is the one thing
// server rendering cannot do: keep the worker lamp honest while a tab sits
// open, and warm the next page before the user clicks.

export interface StatusPayload {
  workers: Worker[];
  usage: {
    monthLocal: number;
    monthCloud: number;
    monthTotal: number;
    hasEverUsedCloud: boolean;
    recent: Array<{ day: string; local: number; cloud: number }>;
  };
  quota: { remaining: number; dailyQuota: number } | null;
}

export const statusQueryKey = ['status'] as const;

async function fetchStatus(): Promise<StatusPayload> {
  const response = await fetch('/api/status', { credentials: 'same-origin' });
  if (!response.ok) throw new Error(`status ${response.status}`);
  return (await response.json()) as StatusPayload;
}

// Refetched a little faster than the worker reports (5 min), so the lamp turns
// over within about a minute of the truth changing rather than lagging a whole
// interval behind it.
//
// `initialData` comes from the server render, so there is no loading flash and
// no second fetch on mount -- the first request this makes is a refresh, not a
// fill.
export function useStatus(initialData: StatusPayload) {
  return useQuery({
    queryKey: statusQueryKey,
    queryFn: fetchStatus,
    initialData,
    staleTime: 60_000,
    refetchInterval: 4 * 60_000,
    // The exception to the provider's global refetchOnWindowFocus: false.
    // Coming back to a tab you left open an hour ago is exactly the moment a
    // stale "connected" is most likely to be a lie.
    refetchOnWindowFocus: true,
  });
}
