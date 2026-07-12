import Link from 'next/link';
import { getCurrentAccount } from '../../lib/current-account';
import { getQuotaStatus } from '../../lib/quota-reader';

export default async function QuotaPage() {
  const account = await getCurrentAccount();
  const { remaining, monthlyQuota } = await getQuotaStatus(account.id);
  const used = monthlyQuota - remaining;
  const usedPct = Math.min(100, Math.max(0, (used / monthlyQuota) * 100));

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-text-secondary hover:text-text-primary">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-text-primary">Quota</h1>

      <div className="mt-8 rounded-xl border border-border bg-surface-elevated p-6">
        <p className="font-mono text-4xl font-bold text-text-primary">
          {remaining} <span className="text-lg font-normal text-text-secondary">/ {monthlyQuota} left</span>
        </p>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-surface-raised">
          <div className="h-full rounded-full bg-accent" style={{ width: `${usedPct}%` }} />
        </div>
        <p className="mt-4 text-sm text-text-secondary">
          {account.quotaResetAt
            ? `Resets ${new Date(account.quotaResetAt).toLocaleDateString()}`
            : 'Resets on your next billing cycle.'}
        </p>
      </div>
    </main>
  );
}
