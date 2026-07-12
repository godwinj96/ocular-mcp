// Per-domain "start at last-known-good rung" memory. See
// docs/rules/05-worker-and-browser-pipeline.md §1 step 3 and
// research & planning/02-conclusions-and-recommendations.md §1.

import { Redis } from 'ioredis';
import { RUNG_NAMES } from '../ladder/rung-profiles.js';
import type { RungName } from '../ladder/rung-profiles.js';
import { config } from '../config.js';

const ROUTING_MEMORY_TTL_S = 60 * 60 * 24 * 7; // 7 days — stale routing memory should expire, not accumulate forever.

function routingKey(domain: string): string {
  return `routing:${domain}`;
}

function isRungName(value: string): value is RungName {
  return (RUNG_NAMES as readonly string[]).includes(value);
}

// Factory (not a bare module-scope singleton) so tests can point this at a
// disposable Redis connection instead of the shared dev instance — same
// pattern as mcp-server's db/redis.ts.
export function createRoutingMemory(redisUrl: string) {
  const redis = new Redis(redisUrl);

  async function getStartingRung(domain: string): Promise<RungName> {
    const stored = await redis.get(routingKey(domain));
    return stored && isRungName(stored) ? stored : 'dc-proxy';
  }

  async function recordSuccess(domain: string, rung: RungName): Promise<void> {
    await redis.set(routingKey(domain), rung, 'EX', ROUTING_MEMORY_TTL_S);
  }

  async function close(): Promise<void> {
    await redis.quit();
  }

  return { getStartingRung, recordSuccess, close };
}

const defaultRoutingMemory = createRoutingMemory(config.redisUrl);

export const getStartingRung: (domain: string) => Promise<RungName> = (domain) =>
  defaultRoutingMemory.getStartingRung(domain);

export const recordSuccess: (domain: string, rung: RungName) => Promise<void> = (domain, rung) =>
  defaultRoutingMemory.recordSuccess(domain, rung);
