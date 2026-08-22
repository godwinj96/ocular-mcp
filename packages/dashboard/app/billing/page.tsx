import Link from 'next/link';
import { getCurrentAccount } from '../../lib/current-account';
import { bachsClient } from '../../lib/bachs';

export default async function BillingPage() {
  const account = await getCurrentAccount();

  // An active subscriber manages an existing plan (Bachs's own hosted
  // portal — invoices, payment method, cancellation); anyone else starts a
  // new checkout. Never re-checkout an already-active subscriber.
  const isActive = account.subscriptionStatus === 'active' && account.bachsCustomerId;
  const session = isActive
    ? await bachsClient.createPortalSession(account.bachsCustomerId!)
    : await bachsClient.createCheckoutSession(account);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-text-secondary hover:text-text-primary">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-text-primary">Billing</h1>

      <div className="mt-8 rounded-xl border border-border bg-surface-elevated p-6">
        <p className="text-sm text-text-secondary">Plan</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">
          {account.plan ?? 'No active plan'}
        </p>
        <p className="mt-1 text-sm text-text-secondary capitalize">{account.subscriptionStatus}</p>

        {session ? (
          <a
            href={session.url}
            className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-surface-base transition hover:brightness-110"
          >
            {isActive ? 'Manage billing' : 'Subscribe'}
          </a>
        ) : (
          <div className="mt-6 rounded-lg border border-dashed border-border bg-surface-raised p-4">
            <p className="text-sm text-text-secondary">
              Billing isn't live yet — checkout will appear here once it's connected. No action
              needed on your end.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}
