// Usage. Renamed from /quota, and the rename is the point: "quota" is a
// rationing word for a resource that mostly isn't rationed. Local capture is
// unlimited and always will be, so leading with a cap describes the small half
// of the product.
//
// The old page rendered "{remaining} / {dailyQuota} left today" as its hero.
// For a user whose entire workload is localhost -- the primary user, per
// CLAUDE.md -- that read "40 / 40 left today" every day forever, which says
// either "you're paying for something you never use" or "your work is capped".
// Both are wrong, and the first is the churn mechanism at renewal.
import { DAILY_CLOUD_QUOTA_BY_TIER, tierOfPlanSlug } from '@ocular/shared';
import { getCurrentAccount } from '../../../lib/current-account';
import { getQuotaStatus } from '../../../lib/quota-reader';
import { getUsage } from '../../../lib/usage';
import { PageHeader } from '../../../components/ui/page-header';
import { Stat, StatRow } from '../../../components/ui/readouts';
import { Rail, railTone } from '../../../components/ui/rail';
import { EmptyState } from '../../../components/ui/empty-state';
import { Table, Th, Td, Tr } from '../../../components/ui/table';
import { ButtonLink } from '../../../components/ui/button';

const UPSELL_AT = 0.8;

export default async function UsagePage() {
  const account = await getCurrentAccount();
  const tier = tierOfPlanSlug(account.plan) ?? 'basic';
  const dailyQuota = DAILY_CLOUD_QUOTA_BY_TIER[tier];

  const [usage, quota] = await Promise.all([
    getUsage(account.id),
    getQuotaStatus(account.id, account.plan),
  ]);

  const spentToday = dailyQuota - quota.remaining;
  const tone = railTone(spentToday, dailyQuota);

  return (
    <>
      <PageHeader
        eyebrow="Usage"
        title="Captures"
        deck="Captures on your own machine aren't limited. The allowance below only applies to pages out on the web."
      />

      {usage.monthTotal === 0 && !usage.hasEverUsedCloud ? (
        // No CTA. There is no action available on this page, and inventing one
        // would give the user a button that cannot help them.
        <EmptyState
          title="Nothing captured yet"
          description="Once your agent starts looking at things, the count shows up here — split between your own machine and the open web."
        />
      ) : (
        <div className="space-y-stack-4">
          <StatRow>
            <Stat
              label="This month"
              value={usage.monthTotal.toLocaleString()}
              detail="captures, all paths"
            />
            <Stat
              label="Your machine"
              value={usage.monthLocal.toLocaleString()}
              detail="never metered"
            />
            <Stat
              label="The web"
              value={usage.monthCloud.toLocaleString()}
              detail="counts against the daily allowance"
            />
          </StatRow>

          {usage.hasEverUsedCloud && (
            <section>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-quaternary">
                Today&apos;s web allowance
              </p>
              <p
                className={`mt-stack-1 font-mono text-[40px] font-medium leading-none tracking-[-0.02em] tabular ${
                  tone === 'fault'
                    ? 'text-fault'
                    : tone === 'caution'
                      ? 'text-caution'
                      : 'text-text-primary'
                }`}
              >
                {quota.remaining}
              </p>
              <p className="mt-stack-1 text-[15px] text-text-secondary">
                left of {dailyQuota} today
              </p>
              <div className="mt-stack-2">
                <Rail spent={spentToday} total={dailyQuota} />
              </div>
              <p className="mt-stack-2 font-mono text-[11.5px] text-text-tertiary">
                {quota.remaining === 0
                  ? 'Resets 00:00 UTC — capture on your own machine is unaffected.'
                  : 'Resets 00:00 UTC.'}
              </p>
            </section>
          )}

          {usage.recent.length > 0 && (
            <section>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-quaternary">
                Last {usage.recent.length} days
              </p>
              <div className="mt-stack-2">
                <Table>
                  <thead>
                    <tr>
                      <Th>Date</Th>
                      <Th numeric>Your machine</Th>
                      <Th numeric>Web</Th>
                      <Th numeric>Total</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {usage.recent.map((day) => (
                      <Tr key={day.day}>
                        <Td mono>{day.day}</Td>
                        <Td numeric>{day.local}</Td>
                        <Td numeric>{day.cloud}</Td>
                        <Td numeric>{day.local + day.cloud}</Td>
                      </Tr>
                    ))}
                  </tbody>
                </Table>
              </div>
            </section>
          )}

          {/* Shown only near the ceiling. Below that it is an upsell on a status
              page, which is what makes a dashboard feel like it is selling to
              you rather than telling you things. */}
          {tier === 'basic' && spentToday / dailyQuota >= UPSELL_AT && (
            <p className="text-[15px] text-text-tertiary">
              Basic covers {dailyQuota} web captures a day.{' '}
              <ButtonLink href="/billing" variant="quiet">
                Compare plans
              </ButtonLink>
            </p>
          )}
        </div>
      )}
    </>
  );
}
