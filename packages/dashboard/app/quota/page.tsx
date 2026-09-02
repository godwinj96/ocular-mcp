import Link from 'next/link';
import { getCurrentAccount } from '../../lib/current-account';
import { getQuotaStatus } from '../../lib/quota-reader';

export default async function QuotaPage() {
  const account = await getCurrentAccount();
  const { remaining, dailyQuota } = await getQuotaStatus(account.id, account.plan);
  const used = dailyQuota - remaining;
  const usedPct = Math.min(100, Math.max(0, (used / dailyQuota) * 100));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-text-secondary hover:text-text-primary">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-text-primary">Cloud quota</h1>
      <p className="mt-1 text-sm text-text-secondary">
        This is your cloud-render quota only — captures against localhost or your own dev server run
        through the local worker and are never limited by this number.
      </p>

      <div className="mt-8 rounded-xl border border-border bg-surface-elevated p-6">
        <p className="font-mono text-4xl font-bold text-text-primary">
          {remaining}{' '}
          <span className="text-lg font-normal text-text-secondary">/ {dailyQuota} left today</span>
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-accent" style={{ width: `${usedPct}%` }} />
        </div>
        <p className="mt-4 text-sm text-text-secondary">Resets daily.</p>
      </div>
    </main>
  );
}
