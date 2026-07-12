import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, describe, expect, it, vi } from 'vitest';
import { config } from '../config.js';
import { createAccountsRepository } from './accounts-repository.js';

// Neon's pooled endpoint (us-east-1, per DEVLOG's noted region mismatch vs.
// this dev machine) has enough round-trip latency that the default 5s
// per-test timeout is too tight — bump it for this file only.
vi.setConfig({ testTimeout: 15_000 });

// Runs against the real Neon dev database (config.postgresUrl) — per
// docs/rules/10-testing.md §1, account resolution is exactly the kind of
// logic that must be proven against real Postgres, not a mock. Every test
// inserts its own account row(s) with a unique oauth_subject_id and cleans
// up in afterEach so runs don't collide or leak into the shared dev DB.
describe('accountsRepository', () => {
  const pool = new Pool({ connectionString: config.postgresUrl });
  const repo = createAccountsRepository(pool);
  let insertedAccountIds: string[] = [];

  afterEach(async () => {
    if (insertedAccountIds.length > 0) {
      await pool.query('delete from accounts where id = any($1::uuid[])', [insertedAccountIds]);
      insertedAccountIds = [];
    }
  });

  afterAll(async () => {
    await pool.end();
  });

  async function insertAccount(overrides: {
    plan?: string | null;
    subscriptionStatus?: 'none' | 'active' | 'past_due' | 'canceled';
    quotaResetAt?: Date | null;
  } = {}): Promise<{ id: string; oauthSubjectId: string }> {
    const oauthSubjectId = `test-user-${randomUUID()}`;
    // `??` would collapse an explicit `plan: null` back to the 'starter'
    // default (null is nullish) — check presence instead so tests can assert
    // the "never subscribed" (plan is null) case.
    const plan = 'plan' in overrides ? overrides.plan : 'starter';
    const result = await pool.query<{ id: string }>(
      `insert into accounts (oauth_subject_id, email, plan, subscription_status, quota_reset_at)
       values ($1, $2, $3, $4, $5)
       returning id`,
      [
        oauthSubjectId,
        `${oauthSubjectId}@example.test`,
        plan,
        overrides.subscriptionStatus ?? 'active',
        overrides.quotaResetAt ?? null,
      ],
    );
    const row = result.rows[0];
    if (!row) throw new Error('insertAccount: insert returned no row');
    insertedAccountIds.push(row.id);
    return { id: row.id, oauthSubjectId };
  }

  it('findByOauthSubject returns null for an unknown subject', async () => {
    const result = await repo.findByOauthSubject(`unknown-${randomUUID()}`);
    expect(result).toBeNull();
  });

  it('findByOauthSubject resolves an active account by oauth_subject_id', async () => {
    const { id, oauthSubjectId } = await insertAccount({ plan: 'starter', subscriptionStatus: 'active' });

    const result = await repo.findByOauthSubject(oauthSubjectId);

    expect(result).toEqual({ id, plan: 'starter', subscriptionStatus: 'active', quotaResetAt: null });
  });

  it('findByOauthSubject still resolves a non-active account (caller decides UNAUTHORIZED)', async () => {
    const { oauthSubjectId } = await insertAccount({ plan: null, subscriptionStatus: 'none' });

    const result = await repo.findByOauthSubject(oauthSubjectId);

    expect(result?.subscriptionStatus).toBe('none');
    expect(result?.plan).toBeNull();
  });

  it('findByApiKeyHash returns null when no key row matches', async () => {
    const result = await repo.findByApiKeyHash(`nonexistent-hash-${randomUUID()}`);
    expect(result).toBeNull();
  });

  it('findByApiKeyHash resolves the owning account for an active key', async () => {
    const { id } = await insertAccount({ plan: 'starter', subscriptionStatus: 'active' });
    const keyHash = `hash-${randomUUID()}`;
    await pool.query(
      `insert into static_api_keys (account_id, key_hash, key_prefix) values ($1, $2, $3)`,
      [id, keyHash, keyHash.slice(0, 8)],
    );

    const result = await repo.findByApiKeyHash(keyHash);

    expect(result?.id).toBe(id);
  });

  it('findByApiKeyHash ignores a revoked key', async () => {
    const { id } = await insertAccount();
    const keyHash = `hash-${randomUUID()}`;
    await pool.query(
      `insert into static_api_keys (account_id, key_hash, key_prefix, revoked_at) values ($1, $2, $3, now())`,
      [id, keyHash, keyHash.slice(0, 8)],
    );

    const result = await repo.findByApiKeyHash(keyHash);

    expect(result).toBeNull();
  });

  it('touchApiKeyLastUsed updates last_used_at for the matching key', async () => {
    const { id } = await insertAccount();
    const keyHash = `hash-${randomUUID()}`;
    await pool.query(
      `insert into static_api_keys (account_id, key_hash, key_prefix) values ($1, $2, $3)`,
      [id, keyHash, keyHash.slice(0, 8)],
    );

    await repo.touchApiKeyLastUsed(keyHash);

    const result = await pool.query<{ last_used_at: Date | null }>(
      'select last_used_at from static_api_keys where key_hash = $1',
      [keyHash],
    );
    expect(result.rows[0]?.last_used_at).not.toBeNull();
  });
});
