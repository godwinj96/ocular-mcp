'use client';

import { WorkerBlock } from './worker-block';
import { useStatus, type StatusPayload } from '../lib/queries';

// Keeps the worker lamp honest while a tab sits open.
//
// This is the ONLY part of the dashboard that refetches. Everything else is
// server-rendered and stays that way, because everything else describes state
// that changes on the order of a month: a plan, a key, a subscription. The
// worker is different -- it is the answer to "is it running", and a page
// asserting "connected" an hour after it last checked is asserting something
// it no longer knows.
//
// Seeded with the server render's own data, so there is no loading state, no
// spinner, and no flash: the first request this makes is a refresh of
// something already on screen, not a fill of something missing.
export function WorkerBlockLive({
  initialStatus,
  isSubscribed,
}: {
  initialStatus: StatusPayload;
  isSubscribed: boolean;
}) {
  const { data } = useStatus(initialStatus);

  return <WorkerBlock workers={data.workers} isSubscribed={isSubscribed} />;
}
