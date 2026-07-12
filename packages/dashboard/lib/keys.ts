// Static API key CRUD against the static_api_keys table (schema:
// infra/postgres/migrations/0001_init.sql). Same table mcp-server's
// verify-static-key.ts reads at request time — hashApiKey here must
// stay byte-for-byte identical to that file's algorithm (see hash-key.ts's
// own comment).
import { sql } from './postgres';
import { generateApiKey, hashApiKey } from './hash-key';

export interface ApiKeySummary {
  id: string;
  keyPrefix: string;
  label: string | null;
  createdAt: string;
  revokedAt: string | null;
  lastUsedAt: string | null;
}

interface ApiKeyRow {
  id: string;
  key_prefix: string;
  label: string | null;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

function toSummary(row: ApiKeyRow): ApiKeySummary {
  return {
    id: row.id,
    keyPrefix: row.key_prefix,
    label: row.label,
    createdAt: row.created_at,
    revokedAt: row.revoked_at,
    lastUsedAt: row.last_used_at,
  };
}

export async function listApiKeys(accountId: string): Promise<ApiKeySummary[]> {
  const rows = (await sql`
    select id, key_prefix, label, created_at, revoked_at, last_used_at
    from static_api_keys
    where account_id = ${accountId}
    order by created_at desc
  `) as ApiKeyRow[];
  return rows.map(toSummary);
}

// Returns the raw key exactly once — the caller is responsible for
// displaying it to the user and never persisting it anywhere.
export async function createApiKey(accountId: string, label: string | null): Promise<{ rawKey: string }> {
  const rawKey = generateApiKey();
  const keyHash = hashApiKey(rawKey);
  const keyPrefix = rawKey.slice(0, 12);

  await sql`
    insert into static_api_keys (account_id, key_hash, key_prefix, label)
    values (${accountId}, ${keyHash}, ${keyPrefix}, ${label})
  `;

  return { rawKey };
}

export async function revokeApiKey(accountId: string, keyId: string): Promise<void> {
  // account_id in the WHERE clause, not just id — a user can only revoke
  // their own keys, never another account's by guessing a UUID.
  await sql`
    update static_api_keys
    set revoked_at = now()
    where id = ${keyId} and account_id = ${accountId} and revoked_at is null
  `;
}
