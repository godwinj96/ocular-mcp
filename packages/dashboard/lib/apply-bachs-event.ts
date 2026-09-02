// Pure BachsWebhookEvent -> account-update mapping, kept separate from the
// route handler (app/webhooks/bachs/route.ts) so it's testable without a
// live Postgres or a signed HTTP request — same "derive, then apply" split
// as @ocular/shared's chargeForEnvelope / worker's settle-quota.ts.
import type { Bachs } from 'bachs-sdk';
import { planSlugForProductId } from './bachs';
import type { SubscriptionStatus } from './accounts';

// bachs-sdk's own BachsWebhookEvent type (defined in its src/types/webhooks.ts)
// isn't actually exported from the package root — only the WebhooksResource
// *class* is (verified against the installed package's dist/index.d.ts, not
// guessed). Derived here from constructEvent's real return type instead of
// fighting the package's export surface or reaching into its unexported
// deep-import path (which its package.json "exports" map blocks anyway).
export type BachsWebhookEvent = Awaited<ReturnType<Bachs['webhooks']['constructEvent']>>;

export type AccountUpdate =
  | {
      kind: 'activateFromCheckout';
      accountId: string;
      bachsCustomerId: string;
      plan: string | null;
    }
  | {
      kind: 'syncSubscriptionState';
      bachsCustomerId: string;
      subscriptionStatus: SubscriptionStatus;
      plan: string | null;
      quotaResetAt: string | null;
    }
  | {
      kind: 'setSubscriptionStatus';
      bachsCustomerId: string;
      subscriptionStatus: SubscriptionStatus;
    };

// Bachs subscription statuses ("trialing"/"active"/"past_due"/"unpaid"/
// "canceled"/"paused") don't map 1:1 onto Ocular's narrower enum (see
// infra/postgres/migrations/0001_init.sql) — trialing counts as active for
// access purposes; unpaid is functionally the same as past_due; paused has
// no Ocular equivalent so it's treated as canceled (no service either way).
function toSubscriptionStatus(bachsStatus: string): SubscriptionStatus {
  if (bachsStatus === 'active' || bachsStatus === 'trialing') return 'active';
  if (bachsStatus === 'past_due' || bachsStatus === 'unpaid') return 'past_due';
  return 'canceled';
}

export function accountUpdateForBachsEvent(event: BachsWebhookEvent): AccountUpdate | null {
  switch (event.type) {
    case 'checkout.completed': {
      // A checkout can be one-time-payment mode too — only subscription
      // checkouts (the only mode Ocular's $1/mo plan ever uses) should touch
      // account state.
      if (!event.data.subscription) return null;
      const accountId = event.data.metadata?.accountId;
      const bachsCustomerId = event.data.customer?.customer_id;
      if (typeof accountId !== 'string' || !bachsCustomerId) return null;
      // checkout.completed's event data has no product/plan field (that's a
      // BaseCheckoutSession-only field, not part of the webhook payload) —
      // plan arrives moments later via customer.subscription.created, which
      // syncSubscriptionState below fills in via COALESCE-preserving update.
      return { kind: 'activateFromCheckout', accountId, bachsCustomerId, plan: null };
    }

    case 'customer.subscription.created':
    case 'customer.subscription.updated':
      // event.data.product_id is Bachs's product ID, not an Ocular plan slug
      // — normalized here so accounts.plan always holds one of plans.ts's
      // PLAN_SLUGS values, never a raw vendor ID. An unrecognized product ID
      // (stale env config, a product not in the four-tier scheme) maps to
      // null rather than silently storing garbage — COALESCE in
      // syncSubscriptionState then leaves the account's existing plan alone.
      return {
        kind: 'syncSubscriptionState',
        bachsCustomerId: event.data.customer.customer_id,
        subscriptionStatus: toSubscriptionStatus(event.data.status),
        plan: planSlugForProductId(event.data.product_id),
        quotaResetAt: event.data.current_period_end,
      };

    case 'customer.subscription.deleted':
      return {
        kind: 'setSubscriptionStatus',
        bachsCustomerId: event.data.customer.customer_id,
        subscriptionStatus: 'canceled',
      };

    case 'invoice.payment_failed':
      return {
        kind: 'setSubscriptionStatus',
        bachsCustomerId: event.data.customer.customer_id,
        subscriptionStatus: 'past_due',
      };

    case 'invoice.paid':
      // Recovers an account from past_due back to active (Flow 9's
      // lapsed-vs-never-subscribed distinction stays intact either way,
      // since this only ever fires for an account that has subscribed).
      return {
        kind: 'setSubscriptionStatus',
        bachsCustomerId: event.data.customer.customer_id,
        subscriptionStatus: 'active',
      };

    default:
      // Every other event type (payments, refunds, payouts, transfers,
      // disputes, connected-account/media/etc. events) is outside Ocular's
      // billing model — no-op, not an error, so Bachs sees a clean 200.
      return null;
  }
}
