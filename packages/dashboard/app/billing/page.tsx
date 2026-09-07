import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import {
  PLAN_PRICE_USD,
  DAILY_CLOUD_QUOTA_BY_TIER,
  tierOfPlanSlug,
  cycleOfPlanSlug,
} from '@ocular/shared';
import { getCurrentAccount } from '../../lib/current-account';
import { bachs, bachsClient } from '../../lib/bachs';
import { RESUME_COOKIE, resumeConnectUrl } from '../../lib/connect-resume';
import { PageHeader } from '../../components/ui/page-header';
import { Notice } from '../../components/ui/notice';
import { KeyValues } from '../../components/ui/readouts';
import { ButtonLink } from '../../components/ui/button';
import { PlanChooser, type PlanOption } from './plan-chooser';
import { formatMonthDay } from '../../lib/format';

// Read on the SERVER and handed to the client component as plain data. The
// chooser cannot import these itself: @ocular/shared's barrel reaches
// node:crypto, which does not belong in a browser bundle.
//
// The reach lines carry no ladder vocabulary. What shipped here before was
// "rungs 0-1" and "full stealth ladder" -- the first is raw internal jargon on
// a purchase surface, and the second breaks CLAUDE.md's guardrail by implying
// every site is reachable.
const PLAN_OPTIONS: PlanOption[] = [
  {
    tier: 'basic',
    label: 'Basic',
    monthly: PLAN_PRICE_USD.basic_monthly,
    annual: PLAN_PRICE_USD.basic_annual,
    dailyWebCaptures: DAILY_CLOUD_QUOTA_BY_TIER.basic,
    reach: 'Your dev server and the open web',
  },
  {
    tier: 'pro',
    label: 'Pro',
    monthly: PLAN_PRICE_USD.pro_monthly,
    annual: PLAN_PRICE_USD.pro_annual,
    dailyWebCaptures: DAILY_CLOUD_QUOTA_BY_TIER.pro,
    reach: 'Plus sites that push back on automated visits',
  },
];

// The subscription status enum is a database value, not a sentence. The old
// page rendered it raw with `capitalize`, so a user whose card had failed read
// the word "Past_due" on their own billing page.
const STATUS_COPY: Record<string, string> = {
  active: 'Active',
  past_due: "Payment didn't go through",
  canceled: 'Cancelled',
  none: '',
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const account = await getCurrentAccount();
  const params = await searchParams;

  // First-run connect flow resuming after checkout. Bachs returns a paying
  // user here rather than to /connect, so without this hop the "one browser
  // visit" promise would break at the moment they have just paid.
  if (account.subscriptionStatus === 'active') {
    const pending = resumeConnectUrl((await cookies()).get(RESUME_COOKIE)?.value);
    if (pending) redirect(pending);
  }

  const isActive = account.subscriptionStatus === 'active' && account.bachsCustomerId;
  const portalSession = isActive
    ? await bachsClient.createPortalSession(account.bachsCustomerId!)
    : null;

  const tier = tierOfPlanSlug(account.plan);
  const cycle = cycleOfPlanSlug(account.plan);
  const resuming = Boolean((await cookies()).get(RESUME_COOKIE)?.value);

  return (
    <>
      <PageHeader eyebrow="Billing" title={isActive ? 'Plan and billing' : 'Pick a plan'} />

      <div className="space-y-stack-3">
        {/* The checkout route has always redirected here with this parameter
            when Bachs can't be reached -- and this page never read it. A user
            clicked a price, got bounced back to an identical screen, and was
            told nothing, at the exact moment of payment intent. */}
        {params.checkout === 'unavailable' && (
          <Notice
            tone="fault"
            title="Checkout didn't start"
            action={
              <ButtonLink href="/billing" variant="secondary">
                Try again
              </ButtonLink>
            }
          >
            We couldn&apos;t reach the payment provider, and nothing was charged. Try again in a
            minute — if it keeps failing, reply to your sign-in email and we&apos;ll sort it.
          </Notice>
        )}

        {account.subscriptionStatus === 'past_due' && (
          <Notice tone="caution" title="Payment didn't go through">
            Update your card and Ocular picks up where it left off. Nothing has been deleted.
          </Notice>
        )}

        {account.subscriptionStatus === 'canceled' && (
          <Notice tone="fault" title="Subscription ended">
            Ocular has stopped capturing on this account. Your keys are still here if you come back.
          </Notice>
        )}

        {/* Replaces a dashed-border box -- the one border style that appears
            nowhere else in the product -- which also told a user pushed here by
            the connect flow that "no action is needed on your end" while
            leaving them no way to finish. */}
        {!bachs && (
          <Notice tone="fault" title="Can't sign up right now">
            Something is wrong on our end and checkout is unavailable. Nothing has been charged. Try
            again shortly.
          </Notice>
        )}

        {resuming && !isActive && (
          <Notice tone="neutral" title="Finishing setup">
            Pick a plan and you&apos;ll go straight back to connecting your machine — you won&apos;t
            need to run the command again.
          </Notice>
        )}

        {isActive && tier ? (
          <section>
            <h2 className="text-[20px] font-medium tracking-[-0.015em] text-text-primary">
              {tier[0]!.toUpperCase()}
              {tier.slice(1)} · {cycle === 'annual' ? 'Annual' : 'Monthly'}
            </h2>

            <KeyValues
              className="mt-stack-2 max-w-[480px]"
              rows={[
                {
                  key: 'price',
                  value: `$${PLAN_PRICE_USD[account.plan as keyof typeof PLAN_PRICE_USD]?.toFixed(2)} ${
                    cycle === 'annual' ? 'a year' : 'a month'
                  }`,
                },
                {
                  key: 'web allowance',
                  value: `${DAILY_CLOUD_QUOTA_BY_TIER[tier]} a day`,
                },
                { key: 'your machine', value: 'unlimited' },
                {
                  key: 'renews',
                  value: account.quotaResetAt ? formatMonthDay(account.quotaResetAt) : '—',
                },
                { key: 'status', value: STATUS_COPY[account.subscriptionStatus] ?? '—' },
              ]}
            />

            {portalSession && (
              <div className="mt-stack-3 flex flex-wrap items-center gap-4">
                <ButtonLink href={portalSession.url} variant="primary">
                  Manage billing
                </ButtonLink>
              </div>
            )}
          </section>
        ) : (
          bachs && <PlanChooser plans={PLAN_OPTIONS} currentTier={tier} />
        )}
      </div>
    </>
  );
}
