// Account resolution + first-login provisioning. Per
// infra/postgres/migrations/0001_init.sql's own comment: "One row per human,
// created on first successful AuthKit login (not on first tool call — see
// docs/rules/04-mcp-server-and-auth.md §3 step 3: a token with no matching
// row here is UNAUTHORIZED, never a default quota)." The dashboard is that
// first-login creation point — mcp-server only ever reads this table.
import { sql } from './postgres';

export interface Account {
  id: string;
  oauthSubjectId: string;
  email: string;
  plan: string | null;
  subscriptionStatus: 'none' | 'active' | 'past_due' | 'canceled';
  quotaResetAt: string | null;
}

interface AccountRow {
  id: string;
  oauth_subject_id: string;
  email: string;
  plan: string | null;
  subscription_status: 'none' | 'active' | 'past_due' | 'canceled';
  quota_reset_at: string | null;
}

function toAccount(row: AccountRow): Account {
  return {
    id: row.id,
    oauthSubjectId: row.oauth_subject_id,
    email: row.email,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    quotaResetAt: row.quota_reset_at,
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
    returning id, oauth_subject_id, email, plan, subscription_status, quota_reset_at
  `) as AccountRow[];

  const row = rows[0];
  if (!row) throw new Error('ensureAccount: insert...returning produced no row');
  return toAccount(row);
}
