// Thin MCP client wrapper for forwarding cloud-routed tool calls to the
// deployed mcp-server, and for the subscription-validity check (see
// ../subscription/validate.ts). Same Client/StreamableHTTPClientTransport
// pattern already proven in packages/mcp-server/src/mcp/server.test.ts's
// end-to-end suite — this is that pattern used as a real runtime client,
// not just a test harness.
//
// Auth: the cloud mcp-server's Bearer auth accepts a static API key
// (docs/rules/11-billing-and-quota.md §4) — see config.ts's note on the
// Phase 8 install-time credential flow this currently stands in for.

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import { TokenProvider } from '../auth/access-token.js';
import type { BearerResult } from '../auth/bearer.js';
import { createBearerResolver } from '../auth/bearer.js';
import { defaultBaseDir } from '../auth/credential-store.js';
import { config } from '../config.js';

export interface CloudClient {
  callTool(name: string, args: Record<string, unknown>): Promise<CallToolResult>;
  close(): Promise<void>;
}

/**
 * Thrown when there is no usable credential at all — neither stored OAuth
 * credentials nor a legacy static key.
 *
 * The name is kept (rather than renamed to something like NoCredentialError)
 * because callers and the indexed execution flows reference it, and because
 * `instanceof NoApiKeyError` in subscription/validate.ts is load-bearing: it
 * is what distinguishes "definitively not authenticated" from "offline". The
 * MESSAGE is generalised since a key is no longer the only credential.
 */
export class NoApiKeyError extends Error {
  constructor(detail = 'no stored credentials and no OCULAR_API_KEY') {
    super(`Not signed in — ${detail}. Run the login flow to connect this machine.`);
    this.name = 'NoApiKeyError';
  }
}

/** Thrown when the credential could not be resolved because we are offline. */
export class CredentialUnavailableError extends Error {
  constructor(detail: string) {
    super(`Could not verify your sign-in right now: ${detail}`);
    this.name = 'CredentialUnavailableError';
  }
}

/**
 * Resolves the bearer token. Defaults to the real store + legacy key, but is
 * injectable so tests never touch the home directory.
 */
function defaultResolver(): () => Promise<BearerResult> {
  return createBearerResolver({
    tokenProvider: new TokenProvider({
      store: { baseDir: defaultBaseDir(), platform: process.platform },
      tokenClient: { clientId: config.authClientId },
    }),
    staticApiKey: config.apiKey,
  });
}

export async function connectCloudClient(
  resolveBearer: () => Promise<BearerResult> = defaultResolver(),
): Promise<CloudClient> {
  const bearer = await resolveBearer();

  if (bearer.kind === 'network_error') {
    // NOT a NoApiKeyError: validate.ts maps that to a definitive "inactive",
    // which would read a dropped connection as a cancelled subscription.
    throw new CredentialUnavailableError(bearer.detail);
  }
  if (bearer.kind !== 'ok') {
    throw new NoApiKeyError(bearer.detail);
  }

  const transport = new StreamableHTTPClientTransport(new URL(config.cloudMcpUrl), {
    requestInit: { headers: { authorization: `Bearer ${bearer.token}` } },
  });
  const client = new Client({ name: 'ocular-local-worker', version: '0.1.0' });
  await client.connect(transport);

  return {
    callTool: (name, args) => client.callTool({ name, arguments: args }) as Promise<CallToolResult>,
    close: () => client.close(),
  };
}
