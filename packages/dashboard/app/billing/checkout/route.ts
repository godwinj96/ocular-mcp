// On-demand checkout session creation — split out of app/billing/page.tsx so
// the billing page itself never calls Bachs (would mean 4 checkout-session
// creations per page view, one per plan card, almost all thrown away).
// GET (not POST) so a plain <a href> works without a form/JS handler — this
// only creates a session and redirects, no state mutation happens here
// (the audit write below records a FAILURE to mutate, not a mutation).
import { redirect } from 'next/navigation';
import { getCurrentAccount } from '../../../lib/current-account';
import { bachsClient } from '../../../lib/bachs';
import { recordAuditEvent } from '../../../lib/audit';
import type { PlanCycle, PlanTier } from '@ocular/shared';

function parseTier(value: string | null): PlanTier | null {
  return value === 'basic' || value === 'pro' ? value : null;
}

function parseCycle(value: string | null): PlanCycle | null {
  return value === 'monthly' || value === 'annual' ? value : null;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const tier = parseTier(url.searchParams.get('tier'));
  const cycle = parseCycle(url.searchParams.get('cycle'));
  if (!tier || !cycle) {
    return new Response('Missing or invalid tier/cycle query params', { status: 400 });
  }

  const account = await getCurrentAccount();
  const session = await bachsClient.createCheckoutSession(account, tier, cycle);
  if (!session) {
    // Recorded, not just redirected -- see this route's header. `system`
    // actor: the failure is Bachs/config, not something the user did.
    await recordAuditEvent(account.id, 'checkout.unavailable', { tier, cycle }, 'system');
    redirect('/billing?checkout=unavailable');
  }
  redirect(session.url);
}
