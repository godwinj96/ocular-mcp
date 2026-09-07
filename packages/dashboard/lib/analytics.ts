// Admin Overview/Analytics metric queries. The metric SET here is the
// product of real research (see DEVLOG's Session 35 admin entry for sources
// and the reasoning behind every cut), not something invented from memory —
// the founder asked for that explicitly, and a wrong metric set here is
// worse than a missing one: it teaches an admin to watch the wrong number.
//
// WHAT WAS DELIBERATELY CUT, and why it stays cut even though it's an
// obvious thing to ask for:
//   - Conversion by plan/cycle: one plan tier exists today. "By plan"
//     segmentation is meaningless until a second one ships.
//   - Churn RATE (%): noise below dozens of subscribers -- one cancellation
//     on a handful of accounts swings a rate by double digits and misleads
//     more than it informs. Raw cancellation COUNT is tracked instead
//     (cancellationCount below), which is honest at any N.
import { sql } from './postgres';
import { PLAN_PRICE_USD, cycleOfPlanSlug, type PlanSlug } from '@ocular/shared';
import { workerState } from './workers';

export interface SignupCounts {
  last7d: number;
  last30d: number;
}

export async function getSignupCounts(): Promise<SignupCounts> {
  const rows = (await sql`
    select
      count(*) filter (where created_at >= now() - interval '7 days')::int  as last7d,
      count(*) filter (where created_at >= now() - interval '30 days')::int as last30d
    from accounts
  `) as { last7d: number; last30d: number }[];
  return rows[0] ?? { last7d: 0, last30d: 0 };
}

// Activation, as researched: paid -> first worker heartbeat. "Paid" is
// subscription_status in ('active','past_due') -- someone who completed
// checkout at least once, not necessarily still current. A "never
// subscribed" account was never eligible to activate, so it's excluded from
// the denominator rather than counted as a failure to activate.
export interface ActivationRate {
  paidAccounts: number;
  activatedAccounts: number;
  rate: number;
}

export async function getActivationRate(): Promise<ActivationRate> {
  const rows = (await sql`
    select
      count(*)::int as paid_accounts,
      count(*) filter (where exists (select 1 from workers w where w.account_id = a.id))::int as activated_accounts
    from accounts a
    where a.subscription_status in ('active', 'past_due')
  `) as { paid_accounts: number; activated_accounts: number }[];
  const row = rows[0] ?? { paid_accounts: 0, activated_accounts: 0 };
  return {
    paidAccounts: row.paid_accounts,
    activatedAccounts: row.activated_accounts,
    rate: row.paid_accounts > 0 ? row.activated_accounts / row.paid_accounts : 0,
  };
}

export interface CaptureActivity {
  dau: number;
  wau: number;
}

// Active USERS doing captures, not dashboard visits -- the research's
// sharpest correction to a naive "active user" definition. An account counts
// for a day if its capture_counters row for that day has any count > 0.
export async function getCaptureActivity(): Promise<CaptureActivity> {
  const rows = (await sql`
    select
      count(distinct account_id) filter (where day = (now() at time zone 'utc')::date and (local_count + cloud_count) > 0)::int as dau,
      count(distinct account_id) filter (where day >= (now() at time zone 'utc')::date - 6 and (local_count + cloud_count) > 0)::int as wau
    from capture_counters
  `) as { dau: number; wau: number }[];
  return rows[0] ?? { dau: 0, wau: 0 };
}

export interface FleetHealth {
  connected: number;
  offline: number;
  quiet: number;
}

// Fleet-wide version of the per-account "is it running?" question — same
// workerState() classifier lib/workers.ts already uses for one account,
// applied across every worker that has ever reported.
export async function getFleetHealth(): Promise<FleetHealth> {
  const rows = (await sql`
    select last_seen_at, heartbeat_at from workers
  `) as { last_seen_at: string; heartbeat_at: string | null }[];

  const health: FleetHealth = { connected: 0, offline: 0, quiet: 0 };
  for (const row of rows) {
    const state = workerState({ lastSeenAt: row.last_seen_at, heartbeatAt: row.heartbeat_at });
    if (state === 'connected') health.connected++;
    else if (state === 'offline') health.offline++;
    else health.quiet++;
  }
  return health;
}

// Monthly-equivalent revenue across every active/past_due account — a
// trend to watch move, not a precision instrument. Annual plans divide by
// 12; the plan column can hold a slug PLAN_PRICE_USD doesn't recognize
// (stale data, a slug renamed since) and those are skipped rather than
// thrown on, since one bad row shouldn't take the whole dashboard down.
export async function getMrr(): Promise<number> {
  const rows = (await sql`
    select plan from accounts where subscription_status in ('active', 'past_due') and plan is not null
  `) as { plan: string }[];

  let mrr = 0;
  for (const row of rows) {
    const slug = row.plan as PlanSlug;
    const price = PLAN_PRICE_USD[slug];
    if (price === undefined) continue;
    mrr += cycleOfPlanSlug(slug) === 'annual' ? price / 12 : price;
  }
  return mrr;
}

/** Raw count, deliberately not a rate — see this file's header. */
export async function getCancellationCount(sinceDays = 30): Promise<number> {
  const rows = (await sql`
    select count(*)::int as count
    from audit_events
    where kind = 'subscription.status_changed'
      and detail->>'status' = 'canceled'
      and created_at >= now() - (${sinceDays} || ' days')::interval
  `) as { count: number }[];
  return rows[0]?.count ?? 0;
}

export async function getFailedCheckoutCount(sinceDays = 30): Promise<number> {
  const rows = (await sql`
    select count(*)::int as count
    from audit_events
    where kind = 'checkout.unavailable'
      and created_at >= now() - (${sinceDays} || ' days')::interval
  `) as { count: number }[];
  return rows[0]?.count ?? 0;
}

export interface CaptureSplitDay {
  day: string;
  local: number;
  cloud: number;
}

// Validates the CLAUDE.md-locked "local-led, cloud as amplifier" bet against
// real usage rather than assuming it.
export async function getCaptureSplit(days = 30): Promise<CaptureSplitDay[]> {
  const rows = (await sql`
    select day, sum(local_count)::int as local, sum(cloud_count)::int as cloud
    from capture_counters
    where day >= (now() at time zone 'utc')::date - ${days - 1}
    group by day
    order by day asc
  `) as { day: string; local: number; cloud: number }[];
  return rows;
}

export interface ActivationFunnel {
  signups: number;
  checkedOut: number;
  activated: number;
}

// Signup -> checkout completed -> first heartbeat. The single most useful
// addition past the founder's own candidate list, per the research: turns
// activation from one number into a diagnosable funnel with two drop-off
// points instead of one opaque rate.
export async function getActivationFunnel(): Promise<ActivationFunnel> {
  const rows = (await sql`
    select
      count(*)::int as signups,
      count(*) filter (where bachs_customer_id is not null)::int as checked_out,
      count(*) filter (where exists (select 1 from workers w where w.account_id = a.id))::int as activated
    from accounts a
  `) as { signups: number; checked_out: number; activated: number }[];
  const row = rows[0] ?? { signups: 0, checked_out: 0, activated: 0 };
  return { signups: row.signups, checkedOut: row.checked_out, activated: row.activated };
}
