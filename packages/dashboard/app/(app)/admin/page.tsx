// Admin Overview — the landing page. Headline metrics plus what needs a
// human's attention right now, stats before actions (Refactoring UI's
// hierarchy stack: size/position before anything else — the eye establishes
// "what's true" before "what to do"). The metric SET here is the product of
// real research, not memory — see DEVLOG's Session 35 admin entry for
// sources and what was deliberately cut (conversion-by-plan: one plan tier
// exists; churn rate: noise below dozens of subscribers, so a raw
// cancellation count lives on /admin/analytics instead).
import { sql } from '../../../lib/postgres';
import { PageHeader } from '../../../components/ui/page-header';
import { Stat, StatRow } from '../../../components/ui/readouts';
import { Notice } from '../../../components/ui/notice';
import { EmptyState } from '../../../components/ui/empty-state';
import {
  getSignupCounts,
  getActivationRate,
  getCaptureActivity,
  getFleetHealth,
  getMrr,
} from '../../../lib/analytics';

interface AttentionRow {
  id: string;
  email: string;
}

async function getAccountsNeedingAttention(): Promise<AttentionRow[]> {
  // Payment failing on an otherwise-active account is the one signal
  // derivable from today's schema that's unambiguously "a human should look
  // at this" without inventing new instrumentation.
  const rows = (await sql`
    select id, email from accounts where subscription_status = 'past_due' order by updated_at desc limit 10
  `) as AttentionRow[];
  return rows;
}

export default async function AdminOverviewPage() {
  const [signups, activation, captures, fleet, mrr, attention] = await Promise.all([
    getSignupCounts(),
    getActivationRate(),
    getCaptureActivity(),
    getFleetHealth(),
    getMrr(),
    getAccountsNeedingAttention(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Overview"
        deck="Everything that matters at a glance — see docs/rules for why this set and not a longer one."
      />

      <StatRow>
        <Stat label="Signups (7d)" value={signups.last7d} detail={`${signups.last30d} in 30d`} />
        <Stat
          label="Activation"
          value={`${Math.round(activation.rate * 100)}%`}
          detail={`${activation.activatedAccounts} of ${activation.paidAccounts} paid`}
        />
        <Stat label="Captures" value={captures.dau} detail={`${captures.wau} in the last 7 days`} />
        <Stat
          label="Fleet"
          value={fleet.connected}
          detail={`${fleet.offline} offline · ${fleet.quiet} quiet`}
          tone={fleet.offline > 0 ? 'caution' : 'default'}
        />
        <Stat label="MRR" value={`$${mrr.toFixed(2)}`} detail="monthly-equivalent, trend only" />
      </StatRow>

      <div className="mt-stack-4 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-text-quaternary">
            Needs attention
          </p>
          {attention.length === 0 ? (
            <EmptyState
              title="Nothing needs attention"
              description="No accounts are flagged right now."
            />
          ) : (
            <div className="flex flex-col gap-3">
              {attention.map((row) => (
                <Notice
                  key={row.id}
                  tone="caution"
                  title="PAYMENT FAILING"
                  action={
                    <a
                      href={`/admin/users?account=${row.id}`}
                      className="font-mono text-[12px] text-accent hover:text-accent-hover"
                    >
                      View account →
                    </a>
                  }
                >
                  {row.email}
                </Notice>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-3 font-mono text-[11px] uppercase tracking-[0.16em] text-text-quaternary">
            Quick actions
          </p>
          <div className="divide-y divide-rule-divider">
            <QuickAction
              href="/admin/users"
              title="Look up an account"
              description="Search, filter, and manage subscriptions."
            />
            <QuickAction
              href="/admin/waitlist"
              title="Waitlist mode"
              description="Toggle checkout vs. waitlist on the public site."
            />
            <QuickAction
              href="/admin/audit"
              title="Audit log"
              description="Every account-changing event, across all accounts."
            />
          </div>
        </div>
      </div>
    </>
  );
}

function QuickAction({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <a href={href} className="group block py-3 first:pt-0">
      <p className="text-[14px] font-medium text-text-primary transition-colors duration-fast ease-base group-hover:text-accent">
        {title}
      </p>
      <p className="mt-0.5 text-[12.5px] text-text-tertiary">{description}</p>
    </a>
  );
}
