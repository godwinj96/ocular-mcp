// Billing provider interface + real implementation, backed by the
// (unofficial but actively maintained, MIT, zero-dependency) `bachs-sdk`
// npm package — verified directly against its published source (not
// guessed) before wiring, same lesson as Session 9's WorkOS AuthKit check.
//
// createPortalSession maps to Bachs's real hosted customer portal
// (`customerSessions.create` -> POST /customers/{id}/portal-sessions).
// Earlier research (see DEVLOG Session 2) concluded Bachs had no hosted
// portal — that's since changed on Bachs's end; re-verified live via the
// SDK's own type definitions, not re-assumed.
import { Bachs } from 'bachs-sdk';
import type { Account } from './accounts';

export interface BachsClient {
  /** Starts a new subscription checkout for this account. Reuses the account's
   *  existing Bachs customer if it has one (e.g. resubscribing after cancellation)
   *  instead of creating a duplicate customer. */
  createCheckoutSession(account: Account): Promise<{ url: string } | null>;
  /** Bachs's hosted billing portal (view invoices, update payment method, cancel). */
  createPortalSession(bachsCustomerId: string): Promise<{ url: string } | null>;
}

class NotConfiguredBachsClient implements BachsClient {
  async createCheckoutSession(): Promise<{ url: string } | null> {
    return null;
  }
  async createPortalSession(): Promise<{ url: string } | null> {
    return null;
  }
}

class RealBachsClient implements BachsClient {
  constructor(
    private readonly bachs: Bachs,
    private readonly productId: string,
    private readonly appUrl: string,
  ) {}

  async createCheckoutSession(account: Account): Promise<{ url: string } | null> {
    try {
      const session = await this.bachs.checkoutSessions.create({
        customer: account.bachsCustomerId
          ? { customer_id: account.bachsCustomerId }
          : // No separate "name" field captured at signup (AuthKit only gives us
            // email) — Bachs requires one for inline customer creation, so email
            // doubles as the display name here. Fine for a $1/mo indie product.
            { email: account.email, name: account.email },
        product_cart: [{ product_id: this.productId, quantity: 1 }],
        success_url: `${this.appUrl}/billing?checkout=success`,
        cancel_url: `${this.appUrl}/billing?checkout=cancelled`,
        // Read back in the checkout.completed webhook (event.data.metadata) to
        // correlate the session with an Ocular account — see apply-bachs-event.ts.
        metadata: { accountId: account.id },
      });
      return { url: session.checkout_url };
    } catch (error) {
      console.error('Bachs createCheckoutSession failed', error);
      return null;
    }
  }

  async createPortalSession(bachsCustomerId: string): Promise<{ url: string } | null> {
    try {
      const session = await this.bachs.customerSessions.create({
        customer_id: bachsCustomerId,
        return_url: `${this.appUrl}/billing`,
      });
      return { url: session.url };
    } catch (error) {
      console.error('Bachs createPortalSession failed', error);
      return null;
    }
  }
}

// Shared Bachs client instance for the webhook route to reuse for signature
// verification (bachs.webhooks.constructEvent) — constructing it once here
// keeps the "is Bachs configured" check in exactly one place.
export const bachs = process.env.BACHS_API_KEY
  ? new Bachs({ apiKey: process.env.BACHS_API_KEY })
  : null;

const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3001';

export const bachsClient: BachsClient =
  bachs && process.env.BACHS_PRODUCT_ID
    ? new RealBachsClient(bachs, process.env.BACHS_PRODUCT_ID, appUrl)
    : new NotConfiguredBachsClient();
