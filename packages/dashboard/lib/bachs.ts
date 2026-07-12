// Billing provider interface. The Bachs sandbox account isn't confirmed set
// up yet (see DEVLOG.md), so NotConfiguredBachsClient ships today — wiring
// real Bachs checkout/portal later is a one-file swap of `bachsClient`
// below, not a redesign of billing/page.tsx.
export interface BachsClient {
  createCheckoutSession(accountId: string, plan: string): Promise<{ url: string } | null>;
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

export const bachsClient: BachsClient = new NotConfiguredBachsClient();
