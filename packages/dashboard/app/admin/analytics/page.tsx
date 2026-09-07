// Everything from the researched metric set that didn't earn Overview's
// headline slots — diagnostic rather than at-a-glance. See lib/analytics.ts
// and DEVLOG's Session 35 admin entry for the research behind this split.
import { PageHeader } from '../../../components/ui/page-header';
import { KeyValues } from '../../../components/ui/readouts';
import {
  getCaptureSplit,
  getFailedCheckoutCount,
  getCancellationCount,
  getActivationFunnel,
} from '../../../lib/analytics';

export default async function AdminAnalyticsPage() {
  const [split, failedCheckouts, cancellations, funnel] = await Promise.all([
    getCaptureSplit(30),
    getFailedCheckoutCount(30),
    getCancellationCount(30),
    getActivationFunnel(),
  ]);

  const splitTotals = split.reduce(
    (acc, day) => ({ local: acc.local + day.local, cloud: acc.cloud + day.cloud }),
    { local: 0, cloud: 0 },
  );
  const splitTotal = splitTotals.local + splitTotals.cloud;

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Analytics"
        deck="Diagnostic detail — the numbers you'd check when something on Overview needs explaining, not at-a-glance."
      />

      <section className="mb-stack-4">
        <h2 className="mb-3 text-[16px] font-medium text-text-primary">
          Activation funnel (all time)
        </h2>
        <KeyValues
          rows={[
            { key: 'Signed up', value: funnel.signups },
            { key: 'Completed checkout', value: funnel.checkedOut },
            { key: 'First worker heartbeat', value: funnel.activated },
          ]}
        />
      </section>

      <section className="mb-stack-4">
        <h2 className="mb-3 text-[16px] font-medium text-text-primary">
          Local vs. cloud captures (30d)
        </h2>
        <KeyValues
          rows={[
            {
              key: 'Local',
              value:
                splitTotal > 0
                  ? `${splitTotals.local} (${Math.round((splitTotals.local / splitTotal) * 100)}%)`
                  : '0',
            },
            {
              key: 'Cloud',
              value:
                splitTotal > 0
                  ? `${splitTotals.cloud} (${Math.round((splitTotals.cloud / splitTotal) * 100)}%)`
                  : '0',
            },
          ]}
        />
        <p className="mt-stack-2 text-[12.5px] text-text-tertiary">
          Validates the local-led product bet against real usage rather than assuming it.
        </p>
      </section>

      <section>
        <h2 className="mb-3 text-[16px] font-medium text-text-primary">Last 30 days</h2>
        <KeyValues
          rows={[
            { key: 'Failed checkouts', value: failedCheckouts },
            // Raw count, deliberately not a rate -- see lib/analytics.ts's
            // header for why a churn PERCENTAGE would mislead at this scale.
            { key: 'Cancellations', value: cancellations },
          ]}
        />
      </section>
    </>
  );
}
