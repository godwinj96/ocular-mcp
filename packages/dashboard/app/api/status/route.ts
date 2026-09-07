import { NextResponse } from 'next/server';
import { DAILY_CLOUD_QUOTA_BY_TIER, tierOfPlanSlug } from '@ocular/shared';
import { getCurrentAccount } from '../../../lib/current-account';
import { listWorkers } from '../../../lib/workers';
import { getUsage } from '../../../lib/usage';
import { getQuotaStatus } from '../../../lib/quota-reader';

// The one endpoint the client query layer reads.
//
// Everything on this dashboard is server-rendered, and that is right for a
// surface people visit rarely. The exception is the worker lamp: it is the
// answer to "is it running", and a page that says "connected" for as long as
// the tab stays open is asserting something it stopped knowing minutes ago.
// This lets that one block re-check itself without a reload.
//
// Same shape the server component renders from, so the client cache and the
// initial HTML cannot disagree about what a worker is.
export async function GET() {
  const account = await getCurrentAccount();
  const tier = tierOfPlanSlug(account.plan) ?? 'basic';
  const dailyQuota = DAILY_CLOUD_QUOTA_BY_TIER[tier];

  const [workers, usage] = await Promise.all([listWorkers(account.id), getUsage(account.id)]);
  const quota = usage.hasEverUsedCloud ? await getQuotaStatus(account.id, account.plan) : null;

  return NextResponse.json(
    {
      workers,
      usage,
      quota: quota ? { remaining: quota.remaining, dailyQuota } : null,
    },
    // Never cached at the edge: this is per-account data whose whole purpose is
    // being current, and a shared cache in front of it would be both wrong and
    // a cross-account leak.
    { headers: { 'cache-control': 'no-store, private' } },
  );
}
