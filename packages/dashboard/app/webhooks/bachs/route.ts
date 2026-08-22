// Bachs webhook receiver — the only inbound sync path from Bachs to Postgres
// (docs/rules/11-billing-and-quota.md §3: mcp-server never calls Bachs
// synchronously, dashboard owns this relationship end to end). Verifies
// X-Bachs-Signature/X-Bachs-Timestamp via bachs-sdk's own constructEvent
// (HMAC-SHA256 over `${timestamp}.${rawBody}`, constant-time compare) before
// trusting anything in the payload.
import { BachsSignatureVerificationError } from 'bachs-sdk';
import {
  activateAccountFromCheckout,
  setSubscriptionStatus,
  syncSubscriptionState,
} from '../../../lib/accounts';
import { accountUpdateForBachsEvent } from '../../../lib/apply-bachs-event';
import { bachs } from '../../../lib/bachs';

export async function POST(request: Request): Promise<Response> {
  if (!bachs || !process.env.BACHS_WEBHOOK_SECRET) {
    // Bachs isn't configured yet (see DEVLOG M5) — nothing should be calling
    // this endpoint. 503 rather than 200 so a misconfigured webhook endpoint
    // is visible in Bachs's own delivery-failure dashboard, not silently green.
    return new Response('Bachs is not configured', { status: 503 });
  }

  // Must read the RAW body before any JSON parsing — signature verification
  // is over the exact bytes Bachs sent, same requirement mcp-server's own
  // MCP transport has for a different reason (see mcp/server.ts's comment).
  const rawBody = await request.text();

  let event;
  try {
    event = await bachs.webhooks.constructEvent({
      payload: rawBody,
      secret: process.env.BACHS_WEBHOOK_SECRET,
      headers: request.headers,
    });
  } catch (error) {
    if (error instanceof BachsSignatureVerificationError) {
      return new Response('Invalid signature', { status: 400 });
    }
    throw error;
  }

  const update = accountUpdateForBachsEvent(event);
  if (!update) {
    // Either an event type outside Ocular's billing model, or a checkout.completed
    // we can't correlate to an account — both are legitimate no-ops, not errors.
    return new Response(null, { status: 200 });
  }

  switch (update.kind) {
    case 'activateFromCheckout':
      await activateAccountFromCheckout(update.accountId, update.bachsCustomerId, update.plan);
      break;
    case 'syncSubscriptionState':
      await syncSubscriptionState(
        update.bachsCustomerId,
        update.subscriptionStatus,
        update.plan,
        update.quotaResetAt,
      );
      break;
    case 'setSubscriptionStatus':
      await setSubscriptionStatus(update.bachsCustomerId, update.subscriptionStatus);
      break;
  }

  return new Response(null, { status: 200 });
}
