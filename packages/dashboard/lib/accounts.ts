// Account resolution + first-login provisioning. Per
// infra/postgres/migrations/0001_init.sql's own comment: "One row per human,
// created on first successful AuthKit login (not on first tool call — see
// docs/rules/04-mcp-server-and-auth.md §3 step 3: a token with no matching
// row here is UNAUTHORIZED, never a default quota)." The dashboard is that
// first-login creation point — mcp-server only ever reads this table.
import { sql } from './postgres';

export type SubscriptionStatus = 'none' | 'active' | 'past_due' | 'canceled';

// Two values, and the second is for SUPPORT, not for teams: an admin can look
// up an account and read its subscription state to help someone who is stuck.
// There is no organization object and no member management -- Ocular is one
// developer per account.
export type AccountRole = 'user' | 'admin';

export interface Account {
  id: string;
  oauthSubjectId: string;
  email: string;
  bachsCustomerId: string | null;
  plan: string | null;
  subscriptionStatus: SubscriptionStatus;
  quotaResetAt: string | null;
  role: AccountRole;
}

interface AccountRow {
  id: string;
  oauth_subject_id: string;
  email: string;
  bachs_customer_id: string | null;
  plan: string | null;
  subscription_status: SubscriptionStatus;
  quota_reset_at: string | null;
  role: AccountRole;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    oauthSubjectId: row.oauth_subject_id,
    email: row.email,
    bachsCustomerId: row.bachs_customer_id,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    quotaResetAt: row.quota_reset_at,
    role: row.role,
  };
}

// Idempotent — safe to call on every authenticated page load. Only inserts
// on first login; subsequent calls are a no-op except keeping email fresh
// (AuthKit is the source of truth for email, not something the dashboard
// itself lets a user change).
export async function ensureAccount(oauthSubjectId: string, email: string): Promise<Account> {
  const rows = (await sql`
    insert into accounts (oauth_subject_id, email)
    values (${oauthSubjectId}, ${email})
    on conflict (oauth_subject_id)
    do update set email = excluded.email, updated_at = now()
    returning id, oauth_subject_id, email, bachs_customer_id, plan, subscription_status, quota_reset_at, role
  `) as AccountRow[];

  const row = rows[0];
  if (!row) throw new Error('ensureAccount: insert...returning produced no row');
  return toAccount(row);
}

// The three account mutations a Bachs webhook can trigger — see
// lib/apply-bachs-event.ts for the pure event->update mapping and
// app/webhooks/bachs/route.ts for where these are actually called. Kept as
// three static, fully-parameterized queries (not one generic "patch"
// builder) since each corresponds to exactly one event shape — no dynamic
// SQL construction needed.

/** checkout.completed (subscription mode): first time we learn the account's Bachs customer id. */
export async function activateAccountFromCheckout(
  accountId: string,
  bachsCustomerId: string,
  plan: string | null,
): Promise<void> {
  await sql`
    update accounts
    set bachs_customer_id = ${bachsCustomerId},
        plan = coalesce(${plan}, plan),
        subscription_status = 'active',
        updated_at = now()
    where id = ${accountId}
  `;
}

/** customer.subscription.created/updated: full state sync from Bachs's own record. */
export async function syncSubscriptionState(
  bachsCustomerId: string,
  subscriptionStatus: SubscriptionStatus,
  plan: string | null,
  quotaResetAt: string | null,
): Promise<void> {
  await sql`
    update accounts
    set subscription_status = ${subscriptionStatus},
        plan = coalesce(${plan}, plan),
        quota_reset_at = coalesce(${quotaResetAt}, quota_reset_at),
        updated_at = now()
    where bachs_customer_id = ${bachsCustomerId}
  `;
}

/** customer.subscription.deleted / invoice.paid / invoice.payment_failed: status-only transitions. */
export async function setSubscriptionStatus(
  bachsCustomerId: string,
  subscriptionStatus: SubscriptionStatus,
): Promise<void> {
  await sql`
    update accounts
    set subscription_status = ${subscriptionStatus},
        updated_at = now()
    where bachs_customer_id = ${bachsCustomerId}
  `;
}
