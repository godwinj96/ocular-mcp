import { describe, expect, it, vi } from 'vitest';
import type { BachsWebhookEvent } from './apply-bachs-event';

// bachs.ts's product-id map is built once at module load from
// process.env — must be stubbed before the dynamic import below, same
// pattern as resolve-account.test.ts for env-var-gated modules.
vi.stubEnv('BACHS_BASIC_MONTHLY_PRICE_ID', 'prod_1');
vi.stubEnv('BACHS_BASIC_ANNUAL_PRICE_ID', 'prod_2');
vi.stubEnv('BACHS_PRO_MONTHLY_PRICE_ID', 'prod_3');
vi.stubEnv('BACHS_PRO_ANNUAL_PRICE_ID', 'prod_4');

const { accountUpdateForBachsEvent } = await import('./apply-bachs-event.js');

const BASE = { id: 'evt_1', created_at: '2026-01-01T00:00:00Z', organization_id: 'org_1' };

function checkoutCompleted(overrides: Partial<Record<string, unknown>> = {}): BachsWebhookEvent {
  return {
    ...BASE,
    type: 'checkout.completed',
    data: {
      checkout_id: 'chk_1',
      status: 'COMPLETED',
      mode: 'subscription',
      payment_status: 'succeeded',
      amount: '1.00',
      currency: 'USD',
      reference: null,
      customer: {
        customer_id: 'cus_1',
        email: 'a@b.com',
        name: null,
        phone_number: null,
        metadata: {},
        created_at: null,
        updated_at: null,
        billing_address: null,
      },
      charge: null,
      subscription: { subscription_id: 'sub_1' },
      success_url: null,
      cancel_url: null,
      metadata: { accountId: 'acct_1' },
      completed_at: '2026-01-01T00:00:00Z',
      expires_at: null,
      created_at: '2026-01-01T00:00:00Z',
      ...overrides,
    },
  } as BachsWebhookEvent;
}

function subscriptionEvent(
  type:
    | 'customer.subscription.created'
    | 'customer.subscription.updated'
    | 'customer.subscription.deleted',
  status: string,
  productId = 'prod_1',
): BachsWebhookEvent {
  return {
    ...BASE,
    type,
    data: {
      subscription_id: 'sub_1',
      customer: {
        customer_id: 'cus_1',
        email: 'a@b.com',
        name: null,
        phone_number: null,
        metadata: {},
        created_at: null,
        updated_at: null,
        billing_address: null,
      },
      product_id: productId,
      status,
      collection_method: 'charge_automatically',
      currency: 'USD',
      amount: '1.00',
      billing_cycle: { interval: 'month', frequency: 1 },
      quantity: 1,
      current_period_start: '2026-01-01T00:00:00Z',
      current_period_end: '2026-02-01T00:00:00Z',
      next_billed_at: '2026-02-01T00:00:00Z',
      trial_end: null,
      cancel_at_period_end: false,
      canceled_at: null,
      created_at: '2026-01-01T00:00:00Z',
      items: [],
      metadata: {},
    },
  } as BachsWebhookEvent;
}

function invoiceEvent(type: 'invoice.paid' | 'invoice.payment_failed'): BachsWebhookEvent {
  return {
    ...BASE,
    type,
    data: {
      invoice_id: 'inv_1',
      subscription: { subscription_id: 'sub_1' },
      customer: {
        customer_id: 'cus_1',
        email: 'a@b.com',
        name: null,
        phone_number: null,
        metadata: {},
        created_at: null,
        updated_at: null,
        billing_address: null,
      },
      charge: null,
      status: type === 'invoice.paid' ? 'paid' : 'open',
      collection_method: 'charge_automatically',
      currency: 'USD',
      subtotal: '1.00',
      total: '1.00',
      amount_paid: type === 'invoice.paid' ? '1.00' : '0.00',
      amount_remaining: type === 'invoice.paid' ? '0.00' : '1.00',
      period_start: '2026-01-01T00:00:00Z',
      period_end: '2026-02-01T00:00:00Z',
      attempt_count: 1,
      next_payment_attempt: null,
      created_at: '2026-01-01T00:00:00Z',
      metadata: {},
    },
  } as BachsWebhookEvent;
}

describe('accountUpdateForBachsEvent', () => {
  it('activates the account from a subscription-mode checkout.completed', () => {
    const update = accountUpdateForBachsEvent(checkoutCompleted());

    expect(update).toEqual({
      kind: 'activateFromCheckout',
      accountId: 'acct_1',
      bachsCustomerId: 'cus_1',
      plan: null,
    });
  });

  it('ignores a one-time-payment checkout.completed (no subscription)', () => {
    const update = accountUpdateForBachsEvent(checkoutCompleted({ subscription: null }));

    expect(update).toBeNull();
  });

  it('ignores checkout.completed missing the accountId metadata (defensive — should never happen)', () => {
    const update = accountUpdateForBachsEvent(checkoutCompleted({ metadata: {} }));

    expect(update).toBeNull();
  });

  it.each([
    ['active', 'active'],
    ['trialing', 'active'],
    ['past_due', 'past_due'],
    ['unpaid', 'past_due'],
    ['canceled', 'canceled'],
    ['paused', 'canceled'],
  ] as const)(
    'maps Bachs subscription status %s to %s on customer.subscription.updated',
    (bachsStatus, expected) => {
      const update = accountUpdateForBachsEvent(
        subscriptionEvent('customer.subscription.updated', bachsStatus),
      );

      expect(update).toEqual({
        kind: 'syncSubscriptionState',
        bachsCustomerId: 'cus_1',
        subscriptionStatus: expected,
        // 'prod_1' is stubbed to BACHS_BASIC_MONTHLY_PRICE_ID above —
        // proves the raw Bachs product id gets normalized to a plan slug.
        plan: 'basic_monthly',
        quotaResetAt: '2026-02-01T00:00:00Z',
      });
    },
  );

  it('normalizes an unrecognized product_id to null rather than storing a raw vendor id', () => {
    const update = accountUpdateForBachsEvent(
      subscriptionEvent('customer.subscription.updated', 'active', 'prod_unknown'),
    );

    expect(update).toMatchObject({ plan: null });
  });

  it('sets canceled on customer.subscription.deleted, status-only', () => {
    const update = accountUpdateForBachsEvent(
      subscriptionEvent('customer.subscription.deleted', 'canceled'),
    );

    expect(update).toEqual({
      kind: 'setSubscriptionStatus',
      bachsCustomerId: 'cus_1',
      subscriptionStatus: 'canceled',
    });
  });

  it('sets past_due on invoice.payment_failed', () => {
    const update = accountUpdateForBachsEvent(invoiceEvent('invoice.payment_failed'));

    expect(update).toEqual({
      kind: 'setSubscriptionStatus',
      bachsCustomerId: 'cus_1',
      subscriptionStatus: 'past_due',
    });
  });

  it('recovers to active on invoice.paid', () => {
    const update = accountUpdateForBachsEvent(invoiceEvent('invoice.paid'));

    expect(update).toEqual({
      kind: 'setSubscriptionStatus',
      bachsCustomerId: 'cus_1',
      subscriptionStatus: 'active',
    });
  });

  it('no-ops for event types outside the billing model', () => {
    const event = { ...BASE, type: 'refund.created', data: {} } as unknown as BachsWebhookEvent;

    expect(accountUpdateForBachsEvent(event)).toBeNull();
  });
});
