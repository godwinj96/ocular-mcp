import { randomUUID } from 'node:crypto';
import { Pool } from 'pg';
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { Redis } from 'ioredis';
import { computeCacheKey } from '@ocular/shared';
import type { ResultEnvelope } from '@ocular/shared';
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
    await pool.query(
      'insert into static_api_keys (account_id, key_hash, key_prefix) values ($1, $2, $3)',
      [row.id, hashApiKey(rawKey), rawKey.slice(0, 8)],
    );

    return { accountId: row.id, rawKey };
  }

  async function connectClient(authorization?: string): Promise<Client> {
    const transport = new StreamableHTTPClientTransport(
      new URL(`http://127.0.0.1:${server.port}/mcp`),
      {
        requestInit: authorization ? { headers: { authorization } } : undefined,
      },
    );
    const client = new Client({ name: 'ocular-test-client', version: '0.0.1' });
    await client.connect(transport);
    return client;
  }

  it('lists all five tools', async () => {
    // Authenticated now: the endpoint answers 401 to an anonymous request, so
    // even the initialize handshake needs credentials. That is the MCP
    // authorization flow working as specified, not a tightening of scope.
    const { rawKey } = await insertActiveAccountWithKey();
    const client = await connectClient(`Bearer ${rawKey}`);
    try {
      const { tools } = await client.listTools();
      expect(tools.map((t) => t.name).sort()).toEqual([
        'extract_assets',
        'get_quota',
        'inspect_ui',
        'motion_capture',
        'view_page',
      ]);
    } finally {
      await client.close();
    }
  });

  it('answers an unauthenticated request with 401 and points at the metadata', async () => {
    // The entry point of the whole OAuth discovery chain. Previously an
    // anonymous call got a JSON-RPC error inside a 200, which a remote client
    // reads as "the tool failed" rather than "authenticate and retry" — so
    // there was no way in for a client that did not already hold a token.
    const res = await fetch(`http://127.0.0.1:${server.port}/mcp`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }),
    });

    expect(res.status).toBe(401);
    const challenge = res.headers.get('www-authenticate');
    expect(challenge).toMatch(/^Bearer /);
    // The pointer is the load-bearing part: without resource_metadata the
    // client has no way to learn which authorization server guards this.
    expect(challenge).toContain('resource_metadata=');
    expect(challenge).toContain('/.well-known/oauth-protected-resource');
  });

  it('serves RFC 9728 protected-resource metadata on both discovery paths', async () => {
    // Both paths because RFC 9728 §3.1 inserts the resource's path component
    // into the well-known URI: a client treating the resource as
    // https://host/mcp looks under /mcp, one treating it as the origin does
    // not. Serving both removes a "works in one client, not another" bug.
    for (const path of [
      '/.well-known/oauth-protected-resource',
      '/.well-known/oauth-protected-resource/mcp',
    ]) {
      const res = await fetch(`http://127.0.0.1:${server.port}${path}`);
      expect(res.status).toBe(200);

      const body = (await res.json()) as {
        resource: string;
        authorization_servers: string[];
        bearer_methods_supported: string[];
      };

      // resource must be the same value tokens are audience-checked against,
      // or clients request a token this server will reject.
      expect(body.resource).toBe(config.authkitResourceIdentifier);
      expect(body.authorization_servers).toEqual([config.authkitIssuerUrl]);
      expect(body.bearer_methods_supported).toEqual(['header']);
    }
  });

  it('rejects a tool call with no Authorization header as an MCP tool error', async () => {
    // Still exercised at the tool layer via a header that is present but
    // empty — the pipeline's own credential check is unchanged, and only the
    // absent-header case was lifted to an HTTP 401 above.
    const client = await connectClient('Bearer ');
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

  it('get_quota succeeds for a valid static key and returns remaining/dailyQuota, explicitly scoped to the cloud path', async () => {
    const { rawKey } = await insertActiveAccountWithKey();
    const client = await connectClient(`Bearer ${rawKey}`);
    try {
      const result = await client.callTool({ name: 'get_quota', arguments: {} });
      expect(result.isError).toBeFalsy();
      const textBlock = (result.content as Array<{ type: string; text?: string }>).find(
        (b) => b.type === 'text',
      );
      const data = JSON.parse(textBlock?.text ?? '{}') as {
        remaining: number;
        dailyQuota: number;
        path: string;
      };
      expect(data.dailyQuota).toBeGreaterThan(0);
      expect(data.remaining).toBe(data.dailyQuota);
      expect(data.path).toBe('cloud');
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

  it('a cache hit returns the cached result WITHOUT ever touching quota — the free-cache-hit contract', async () => {
    const { rawKey, accountId } = await insertActiveAccountWithKey();
    const url = `https://example.com/${randomUUID()}`;
    const args = { url, detail: 'balanced', full_page: false };
    const cacheKey = computeCacheKey('view_page', args);

    const seededB64 = Buffer.from('seeded-cache-hit-marker').toString('base64');
    const seeded: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'seed', rungReached: 0, durationMs: 1 },
      image: { b64: seededB64, mime: 'image/webp', w: 1, h: 1, bytes: 1 },
    };
    await redis.set(cacheKey, JSON.stringify(seeded), 'EX', 60);

    const client = await connectClient(`Bearer ${rawKey}`);
    try {
      const result = await client.callTool({ name: 'view_page', arguments: args });
      expect(result.isError).toBeFalsy();
      const imageBlock = (result.content as Array<{ type: string; data?: string }>).find(
        (b) => b.type === 'image',
      );
      expect(imageBlock?.data).toBe(seededB64);

      // The whole point: a hit must never reserve or decrement quota.
      const quotaValue = await redis.get(`quota:${accountId}`);
      expect(quotaValue).toBeNull();
    } finally {
      await client.close();
      await redis.del(cacheKey);
    }
  });

  it('fresh:true bypasses the cache read and never returns the seeded cache content', async () => {
    const { rawKey } = await insertActiveAccountWithKey();
    const url = `https://example.com/${randomUUID()}`;
    const args = { url, detail: 'balanced', full_page: false };
    const cacheKey = computeCacheKey('view_page', args);
    const seededMarkerB64 = Buffer.from('should-not-be-returned').toString('base64');

    const seeded: ResultEnvelope = {
      ok: true,
      meta: { requestId: 'seed', rungReached: 0, durationMs: 1 },
      image: { b64: seededMarkerB64, mime: 'image/webp', w: 1, h: 1, bytes: 1 },
    };
    await redis.set(cacheKey, JSON.stringify(seeded), 'EX', 60);

    const client = await connectClient(`Bearer ${rawKey}`);
    try {
      // fresh:true bypasses the cache read, so the real pipeline runs
      // (enqueue + await). This suite's own RENDER_QUEUE_NAME is shared
      // with queue/enqueue.test.ts's real BullMQ Worker test double, so
      // whether this job times out (no consumer active right now) or
      // gets picked up by that unrelated worker and resolves some other
      // way is not something this test can control when run alongside
      // the rest of the suite — deliberately not asserted on. The one
      // thing that must always hold regardless of timing is the actual
      // point of `fresh`: the seeded cache marker is never returned.
      const result = await client.callTool({
        name: 'view_page',
        arguments: { ...args, fresh: true },
      });
      const imageBlock = (result.content as Array<{ type: string; data?: string }>).find(
        (b) => b.type === 'image',
      );
      expect(imageBlock?.data).not.toBe(seededMarkerB64);
    } finally {
      await client.close();
      await redis.del(cacheKey);
    }
  }, 25_000); // may need to wait out SERVER_AWAIT_MS (12s) if nothing else consumes the job.
});
