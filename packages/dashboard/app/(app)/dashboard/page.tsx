// The authenticated root. It answers three questions and stops: is it working,
// am I paying, how much have I used.
//
// WHAT THIS REPLACES. Four link cards in a grid -- the founder's "3 cards
// floating in darkness". Those cards were never a dashboard; they were a
// navigation menu wearing one, and they existed only because app/layout.tsx had
// no chrome, so the root had to carry the routing itself. With a bar in place
// the cards have no job, and the root is free to be readouts on the ground.
//
// There is deliberately NO page header here. The bar already says where you
// are, and the worker block IS the title -- a 30px "Connected — rowan-mbp" says
// more than an <h1> reading "Status" ever could.
//
// No activity feed, no graphs, no onboarding checklist that survives its own
// completion. Every one of those is a manufactured reason to come back, and a
// user who visits this page often is a user the product has failed.
import { PLAN_PRICE_USD, DAILY_CLOUD_QUOTA_BY_TIER, tierOfPlanSlug } from '@ocular/shared';
import { getCurrentAccount } from '../../../lib/current-account';
import { listWorkers } from '../../../lib/workers';
import { getUsage } from '../../../lib/usage';
import { getQuotaStatus } from '../../../lib/quota-reader';
import { WorkerBlockLive } from '../../../components/worker-block-live';
import { Rail, railTone } from '../../../components/ui/rail';
import { Stat } from '../../../components/ui/readouts';
import { Notice } from '../../../components/ui/notice';
import { ButtonLink } from '../../../components/ui/button';
import { formatDay, formatMonthDay } from '../../../lib/format';

export default async function StatusPage() {
  const account = await getCurrentAccount();

  const [workers, usage] = await Promise.all([listWorkers(account.id), getUsage(account.id)]);

  const isSubscribed = account.subscriptionStatus === 'active';
  const tier = tierOfPlanSlug(account.plan) ?? 'basic';
  const dailyQuota = DAILY_CLOUD_QUOTA_BY_TIER[tier];
  const quota = usage.hasEverUsedCloud ? await getQuotaStatus(account.id, account.plan) : null;
  const spentToday = quota ? dailyQuota - quota.remaining : 0;

  return (
    <div className="space-y-stack-4">
      {account.subscriptionStatus === 'past_due' && (
        <Notice
          tone="caution"
          title="Payment didn't go through"
          action={
            <ButtonLink href="/billing" variant="secondary">
              Update billing
            </ButtonLink>
          }
        >
          Captures on your own machine keep working for a short grace period. After that Ocular
          stops until billing is current.
        </Notice>
      )}

      {account.subscriptionStatus === 'canceled' && (
        <Notice
          tone="fault"
          title="Subscription ended"
          action={
            <ButtonLink href="/billing" variant="primary">
              Start again
            </ButtonLink>
          }
        >
          Ocular has stopped capturing on this account. Your keys and settings are still here.
        </Notice>
      )}

      {/* The only live block on the page. Seeded from this render, then it
          keeps itself honest -- see components/worker-block-live.tsx. */}
      <WorkerBlockLive
        initialStatus={{
          workers,
          usage,
          quota: quota ? { remaining: quota.remaining, dailyQuota } : null,
        }}
        isSubscribed={isSubscribed}
      />

      {/* Blocks below are absent, not empty, until there is something true to
          put in them. A row of zeros on a first run is noise, and this is the
          first screen nearly every user sees. */}
      {usage.monthTotal > 0 && (
        <section>
          <Stat
            label="Captures"
            value={usage.monthTotal.toLocaleString()}
            detail={`this month · ${usage.monthLocal.toLocaleString()} on your machine, ${usage.monthCloud.toLocaleString()} on the web`}
          />
        </section>
      )}

      <section className="flex flex-wrap items-baseline gap-x-4 gap-y-2">
        <p className="text-[15px] text-text-primary">
          {isSubscribed ? planLabel(account.plan) : 'No plan yet'}
        </p>
        {isSubscribed && (
          <p className="text-[15px] text-text-secondary">
            ${PLAN_PRICE_USD[planKey(account.plan)]?.toFixed(2) ?? '2.50'}
            {account.plan?.includes('annual') ? '/yr' : '/mo'}
            {account.quotaResetAt ? ` · renews ${formatMonthDay(account.quotaResetAt)}` : ''}
          </p>
        )}
        <ButtonLink href="/billing" variant="quiet">
          {isSubscribed ? 'Manage billing' : 'Pick a plan'}
        </ButtonLink>
      </section>

      {/* Rendered only once a web capture has ever happened. Showing "40 / 40
          left" to someone who has never made one teaches exactly the wrong
          model: that their localhost work is metered. It isn't, and never
          will be. */}
      {quota && (
        <section>
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-quaternary">
            Web allowance
          </p>
          <div className="mt-stack-2">
            <Rail spent={spentToday} total={dailyQuota} />
          </div>
          <p className="mt-stack-2 font-mono text-[13px] tabular">
            <span
              className={
                railTone(spentToday, dailyQuota) === 'fault'
                  ? 'text-fault'
                  : railTone(spentToday, dailyQuota) === 'caution'
                    ? 'text-caution'
                    : 'text-text-primary'
              }
            >
              {quota.remaining} of {dailyQuota}
            </span>{' '}
            <span className="text-text-tertiary">left today · resets 00:00 UTC</span>
          </p>
          <p className="mt-stack-2 text-[15px] text-text-secondary">
            Your own dev server isn&apos;t metered.
          </p>
        </section>
      )}

      {usage.recent.length > 0 && (
        <p className="font-mono text-[11.5px] text-text-tertiary">
          Last capture {formatDay(usage.recent[0]!.day)}
        </p>
      )}
    </div>
  );
}

function planKey(plan: string | null): keyof typeof PLAN_PRICE_USD {
  return (plan as keyof typeof PLAN_PRICE_USD) ?? 'basic_monthly';
}

function planLabel(plan: string | null): string {
  if (!plan) return 'No plan yet';
  const tier = tierOfPlanSlug(plan) ?? 'basic';
  const cycle = plan.includes('annual') ? 'Annual' : 'Monthly';
  return `${tier[0]!.toUpperCase()}${tier.slice(1)} · ${cycle}`;
}
