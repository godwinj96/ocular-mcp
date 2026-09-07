// Postgres-backed account/plan lookups shared by both auth paths (AuthKit
// JWT + static API key). See docs/rules/04-mcp-server-and-auth.md §2-3 and
// docs/rules/11-billing-and-quota.md §3 — a missing account row, a null
// plan, or a non-active subscription is UNAUTHORIZED, never a default quota.
// Schema: infra/postgres/migrations/0001_init.sql.

import type { Pool } from 'pg';
import { pool } from './pool.js';

export interface AccountRecord {
  id: string;
  plan: string | null;
  subscriptionStatus: 'none' | 'active' | 'past_due' | 'canceled';
  quotaResetAt: Date | null;
}

interface AccountRow {
  id: string;
  plan: string | null;
  subscription_status: AccountRecord['subscriptionStatus'];
  quota_reset_at: Date | null;
}

function toAccountRecord(row: AccountRow): AccountRecord {
  return {
    id: row.id,
    plan: row.plan,
    subscriptionStatus: row.subscription_status,
    quotaResetAt: row.quota_reset_at,
  };
}

// Factory (not a bare module-scope singleton) so tests can point queries at a
// disposable pool instead of the shared dev database.
export function createAccountsRepository(dbPool: Pool) {
  return {
    async findById(accountId: string): Promise<AccountRecord | null> {
      const result = await dbPool.query<AccountRow>(
        'select id, plan, subscription_status, quota_reset_at from accounts where id = $1',
        [accountId],
      );
      const row = result.rows[0];
      return row ? toAccountRecord(row) : null;
    },

    async findByOauthSubject(oauthSubjectId: string): Promise<AccountRecord | null> {
      // banned_at is null: an admin ban (infra/postgres/migrations/0003)
      // blocks this path outright — see accounts.ts's banAccount() in the
      // dashboard, the only writer of this column. A banned account simply
      // doesn't resolve, same as an unknown one; callers already treat a
      // null return as UNAUTHORIZED, so no separate "banned" error path is
      // needed here.
      const result = await dbPool.query<AccountRow>(
        'select id, plan, subscription_status, quota_reset_at from accounts where oauth_subject_id = $1 and banned_at is null',
        [oauthSubjectId],
      );
      const row = result.rows[0];
      return row ? toAccountRecord(row) : null;
    },

    async findByApiKeyHash(keyHash: string): Promise<AccountRecord | null> {
      // Two independent gates, both required: the key's own revoked_at
      // (unchanged — a user's own revoke, or banAccount() revoking every key
      // on ban) AND the account's banned_at (belt-and-suspenders — banning
      // revokes existing keys, but this also blocks a key issued or
      // un-revoked after the ban somehow existed, which shouldn't happen but
      // costs nothing to also guard against here).
      const result = await dbPool.query<AccountRow>(
        `select a.id, a.plan, a.subscription_status, a.quota_reset_at
         from static_api_keys k
         join accounts a on a.id = k.account_id
         where k.key_hash = $1 and k.revoked_at is null and a.banned_at is null`,
        [keyHash],
      );
      const row = result.rows[0];
      return row ? toAccountRecord(row) : null;
    },

    // Best-effort — a failed update here must never block auth. Callers
    // should catch, not await-and-throw.
    async touchApiKeyLastUsed(keyHash: string): Promise<void> {
      await dbPool.query('update static_api_keys set last_used_at = now() where key_hash = $1', [
        keyHash,
      ]);
    },
  };
}

export type AccountsRepository = ReturnType<typeof createAccountsRepository>;

export const accountsRepository = createAccountsRepository(pool);
