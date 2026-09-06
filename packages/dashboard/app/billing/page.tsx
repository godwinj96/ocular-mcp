import Link from 'next/link';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getCurrentAccount } from '../../lib/current-account';
import { bachs, bachsClient } from '../../lib/bachs';
import { RESUME_COOKIE, resumeConnectUrl } from '../../lib/connect-resume';
import { PLAN_PRICE_USD, tierOfPlanSlug, type PlanCycle, type PlanTier } from '@ocular/shared';

const PLAN_CARDS: Array<{ tier: PlanTier; label: string; blurb: string }> = [
  { tier: 'basic', label: 'Basic', blurb: 'Unlimited local, 40 cloud renders/day, rungs 0-1.' },
  {
    tier: 'pro',
    label: 'Pro',
    blurb: 'Unlimited local, 150 cloud renders/day, full stealth ladder.',
  },
];

export default async function BillingPage() {
  const account = await getCurrentAccount();

  // First-run connect flow resuming after checkout. Bachs returns a paying
  // user here rather than to /connect, so without this hop the "one browser
  // visit" promise would break at the moment they have just paid. Only
  // resumes once the subscription is actually active, so a cancelled or
  // still-processing checkout falls through to the normal billing page.
  // See docs/design/first-run-auth-and-payment.md §4.2.
  if (account.subscriptionStatus === 'active') {
    const pending = resumeConnectUrl((await cookies()).get(RESUME_COOKIE)?.value);
    if (pending) redirect(pending);
  }

  // An active subscriber manages an existing plan (Bachs's own hosted
  // portal — invoices, payment method, cancellation); anyone else picks a
  // plan below and starts a new checkout from there.
  const isActive = account.subscriptionStatus === 'active' && account.bachsCustomerId;
  const portalSession = isActive
    ? await bachsClient.createPortalSession(account.bachsCustomerId!)
    : null;
  const currentTier = tierOfPlanSlug(account.plan);

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <Link href="/" className="text-sm text-text-secondary hover:text-text-primary">
        ← Back
      </Link>
      <h1 className="mt-4 text-3xl font-bold text-text-primary">Billing</h1>

      <div className="mt-8 rounded-xl border border-border bg-surface-elevated p-6">
        <p className="text-sm text-text-secondary">Current plan</p>
        <p className="mt-1 text-xl font-semibold text-text-primary">
          {currentTier ? PLAN_CARDS.find((p) => p.tier === currentTier)?.label : 'No active plan'}
        </p>
        <p className="mt-1 text-sm text-text-secondary capitalize">{account.subscriptionStatus}</p>

        {isActive && portalSession && (
          <a
            href={portalSession.url}
            className="mt-6 inline-block rounded-full bg-accent px-6 py-3 font-semibold text-surface-base transition hover:brightness-110"
          >
            Manage billing
          </a>
        )}
      </div>

      {!bachs && (
        <div className="mt-6 rounded-lg border border-dashed border-border bg-surface-raised p-4">
          <p className="text-sm text-text-secondary">
            Billing isn't live yet — checkout will appear here once it's connected. No action needed
            on your end.
          </p>
        </div>
      )}

      {bachs && !isActive && (
        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {PLAN_CARDS.map(({ tier, label, blurb }) => (
            <div key={tier} className="rounded-xl border border-border bg-surface-elevated p-6">
              <p className="text-lg font-semibold text-text-primary">{label}</p>
              <p className="mt-1 text-sm text-text-secondary">{blurb}</p>
              <div className="mt-4 flex flex-col gap-2">
                {(['monthly', 'annual'] as PlanCycle[]).map((cycle) => (
                  <a
                    key={cycle}
                    href={`/billing/checkout?tier=${tier}&cycle=${cycle}`}
                    className="rounded-full border border-border px-5 py-2.5 text-center font-semibold text-text-primary transition hover:border-accent hover:text-accent"
                  >
                    ${PLAN_PRICE_USD[`${tier}_${cycle}`]}
                    {cycle === 'monthly' ? '/mo' : '/yr'}
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
