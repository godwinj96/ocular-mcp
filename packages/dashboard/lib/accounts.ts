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
  /**
   * Set by an admin ban (infra/postgres/migrations/0003). SCOPE, decided
   * explicitly rather than guessed: this blocks the account's mcp-server auth
   * paths (both AuthKit JWT and static key — see accounts-repository.ts in
   * mcp-server) and revokes its static keys. It does NOT touch the Bachs
   * subscription (billing keeps running; an admin cancels that separately if
   * warranted) and does NOT block the dashboard session itself — a banned
   * user can still sign in and see their own account state, just can't
   * capture anything.
   */
  bannedAt: string | null;
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
  banned_at: string | null;
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
    bannedAt: row.banned_at,
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
    returning id, oauth_subject_id, email, bachs_customer_id, plan, subscription_status, quota_reset_at, role, banned_at
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

// --- Admin mutations. Every one of these is called ONLY from
// app/admin/actions.ts, which re-checks role === 'admin' server-side before
// calling any of them (see that file's header) — these functions themselves
// do not check authorization, the same trust boundary lib/keys.ts already
// draws (an account-scoped WHERE clause there, an explicit role check here).

/**
 * Ban: gates both mcp-server auth paths (banned_at is null is now part of
 * accounts-repository.ts's findByOauthSubject/findByApiKeyHash queries) and
 * revokes every active static key so static_api_keys stops asserting keys
 * are live when they functionally aren't — decided explicitly, not left to
 * an implementer's guess (see Account.bannedAt's own comment for the two
 * decisions this reflects: billing is untouched, keys ARE revoked).
 */
export async function banAccount(accountId: string): Promise<void> {
  await sql`update accounts set banned_at = now(), updated_at = now() where id = ${accountId} and banned_at is null`;
  await sql`update static_api_keys set revoked_at = now() where account_id = ${accountId} and revoked_at is null`;
}

export async function unbanAccount(accountId: string): Promise<void> {
  await sql`update accounts set banned_at = null, updated_at = now() where id = ${accountId}`;
}

/** Admin-driven plan change — distinct from syncSubscriptionState (webhook-driven) so the audit trail can tell them apart. Does not touch Bachs; this sets what the dashboard/mcp-server sees, an admin overriding it separately from a real subscription is a support action, not a billing one. */
export async function changeAccountPlanByAdmin(accountId: string, plan: string): Promise<void> {
  await sql`update accounts set plan = ${plan}, updated_at = now() where id = ${accountId}`;
}

export async function changeAccountRole(accountId: string, role: AccountRole): Promise<void> {
  await sql`update accounts set role = ${role}, updated_at = now() where id = ${accountId}`;
}

export interface AdminAccountRow {
  id: string;
  email: string;
  plan: string | null;
  subscriptionStatus: SubscriptionStatus;
  role: AccountRole;
  bannedAt: string | null;
  createdAt: string;
  workerCount: number;
  lastSeenAt: string | null;
  heartbeatAt: string | null;
}

export interface AdminAccountFilters {
  /** Substring match against email. */
  email?: string;
  subscriptionStatus?: SubscriptionStatus;
  role?: AccountRole;
  /** true = banned only, false = not banned only, undefined = both. */
  banned?: boolean;
}

// Cursor-paginated on (created_at, id), same reasoning as
// listAuditEventsAcrossAccounts in lib/audit.ts: an offset would skip or
// repeat rows as new accounts are created between page loads.
export async function listAccounts(
  filters: AdminAccountFilters,
  limit = 25,
  before?: { createdAt: string; id: string },
): Promise<AdminAccountRow[]> {
  const rows = (await sql`
    select
      a.id, a.email, a.plan, a.subscription_status, a.role, a.banned_at, a.created_at,
      count(w.id)::int          as worker_count,
      max(w.last_seen_at)       as last_seen_at,
      max(w.heartbeat_at)       as heartbeat_at
    from accounts a
    left join workers w on w.account_id = a.id
    where (${filters.email ?? null}::text is null or a.email ilike ${filters.email ? '%' + filters.email + '%' : null})
      and (${filters.subscriptionStatus ?? null}::subscription_status is null or a.subscription_status = ${filters.subscriptionStatus ?? null})
      and (${filters.role ?? null}::account_role is null or a.role = ${filters.role ?? null})
      and (
        ${filters.banned ?? null}::boolean is null
        or (${filters.banned ?? null}::boolean is true and a.banned_at is not null)
        or (${filters.banned ?? null}::boolean is false and a.banned_at is null)
      )
      and (
        ${before?.createdAt ?? null}::timestamptz is null
        or (a.created_at, a.id) < (${before?.createdAt ?? null}::timestamptz, ${before?.id ?? null}::uuid)
      )
    group by a.id
    order by a.created_at desc, a.id desc
    limit ${limit}
  `) as {
    id: string;
    email: string;
    plan: string | null;
    subscription_status: SubscriptionStatus;
    role: AccountRole;
    banned_at: string | null;
    created_at: string;
    worker_count: number;
    last_seen_at: string | null;
    heartbeat_at: string | null;
  }[];

  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    role: row.role,
    bannedAt: row.banned_at,
    createdAt: row.created_at,
    workerCount: row.worker_count,
    lastSeenAt: row.last_seen_at,
    heartbeatAt: row.heartbeat_at,
  }));
}
