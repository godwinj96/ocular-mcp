import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Redis } from 'ioredis';
import { hashApiKey } from '../auth/hash-key.js';
import { config } from '../config.js';
import { startMcpServer } from './server.js';
import type { McpServerHandle } from './server.js';

// End-to-end: a real MCP Client, over real HTTP, against a real running
// Fastify + StreamableHTTPServerTransport server, backed by the real dev
// Upstash Redis / Neon Postgres (docs/rules/10-testing.md §1 — this class of
// wiring must be proven against real infra, not mocks). Uses port 0 so it
// never collides with a locally running dev server.
vi.setConfig({ testTimeout: 20_000 });

describe('mcp-server end-to-end', () => {
  const pool = new Pool({ connectionString: config.postgresUrl });
  const redis = new Redis(config.redisUrl);
  let server: McpServerHandle;
  let insertedAccountIds: string[] = [];

  beforeAll(async () => {
    server = await startMcpServer({ port: 0 });
  });

  afterEach(async () => {
    if (insertedAccountIds.length > 0) {
      await pool.query('delete from accounts where id = any($1::uuid[])', [insertedAccountIds]);
      await redis.del(...insertedAccountIds.map((id) => `quota:${id}`));
      insertedAccountIds = [];
    }
  });

  afterAll(async () => {
    await server.close();
    await pool.end();
    redis.disconnect();
  });

  async function insertActiveAccountWithKey(): Promise<{ accountId: string; rawKey: string }> {
    const oauthSubjectId = `test-user-${randomUUID()}`;
    const accountResult = await pool.query<{ id: string }>(
      `insert into accounts (oauth_subject_id, email, plan, subscription_status)
       values ($1, $2, 'starter', 'active') returning id`,
      [oauthSubjectId, `${oauthSubjectId}@example.test`],
    );
    const row = accountResult.rows[0];
    if (!row) throw new Error('insertActiveAccountWithKey: insert returned no row');
    insertedAccountIds.push(row.id);

    const rawKey = `ocular_sk_test_${randomUUID()}`;
    await pool.query('insert into static_api_keys (account_id, key_hash, key_prefix) values ($1, $2, $3)', [
      row.id,
      hashApiKey(rawKey),
      rawKey.slice(0, 8),
    ]);

    return { accountId: row.id, rawKey };
  }

  async function connectClient(authorization?: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${server.port}/mcp`), {
      requestInit: authorization ? { headers: { authorization } } : undefined,
    });
    const client = new Client({ name: 'ocular-test-client', version: '0.0.1' });
    await client.connect(transport);
    return client;
  }

  it('lists all four tools', async () => {
    const client = await connectClient();
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual(['extract_assets', 'get_quota', 'inspect_ui', 'view_page']);
    } finally {
      await client.close();
    }
  });

  it('rejects a tool call with no Authorization header as an MCP tool error', async () => {
    const client = await connectClient();
    try {
      const result = await client.callTool({ name: 'get_quota', arguments: {} });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('rejects a tool call with an unknown static key as an MCP tool error', async () => {
    const client = await connectClient('Bearer ocular_sk_totally_unknown');
    try {
      const result = await client.callTool({ name: 'get_quota', arguments: {} });
      expect(result.isError).toBe(true);
    } finally {
      await client.close();
    }
  });

  it('get_quota succeeds for a valid static key and returns remaining/monthlyQuota', async () => {
    const { rawKey } = await insertActiveAccountWithKey();
    const client = await connectClient(`Bearer ${rawKey}`);
    try {
      const result = await client.callTool({ name: 'get_quota', arguments: {} });
      expect(result.isError).toBeFalsy();
      const textBlock = (result.content as Array<{ type: string; text?: string }>).find((b) => b.type === 'text');
      const data = JSON.parse(textBlock?.text ?? '{}') as { remaining: number; monthlyQuota: number };
      expect(data.monthlyQuota).toBeGreaterThan(0);
      expect(data.remaining).toBe(data.monthlyQuota);
    } finally {
      await client.close();
    }
  });

  it('blocks view_page for a private-IP URL as SSRF_BLOCKED, before quota is touched', async () => {
    const { rawKey, accountId } = await insertActiveAccountWithKey();
    const client = await connectClient(`Bearer ${rawKey}`);
    try {
      const result = await client.callTool({
        name: 'view_page',
        arguments: { url: 'http://127.0.0.1/', detail: 'balanced', full_page: false },
      });
      expect(result.isError).toBe(true);

      // SSRF rejection happens before the quota reserve step — confirm no
      // quota key was ever created for this account.
      const quotaValue = await redis.get(`quota:${accountId}`);
      expect(quotaValue).toBeNull();
    } finally {
      await client.close();
    }
  });
});
