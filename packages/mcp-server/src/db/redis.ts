// Shared Upstash Redis client (used by the quota checker; the BullMQ
// producer in queue/enqueue.ts uses its own dedicated connections instead —
// see that file for why). See docs/rules/12-environment-and-secrets.md §2.

import { Redis } from 'ioredis';
import { config } from '../config.js';

// Factory (not a bare module-scope singleton) so tests can point the quota
// checker at a disposable Redis connection instead of the shared dev
// instance — same pattern as verify-authkit-token.ts's createAuthKitVerifier.
export function createRedisClient(url: string): Redis {
  return new Redis(url);
}

export const redis = createRedisClient(config.redisUrl);
