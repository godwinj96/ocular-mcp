// Deterministic cache key derivation — shared because mcp-server (reads the
// cloud cache) and worker (writes it) must independently compute byte-
// identical keys for the same (tool, args) without importing each other's
// code. Pure computation only (node:crypto's createHash has no I/O, same
// spirit as using Buffer) — does not violate shared's zero-runtime-
// dependency contract (docs/rules/03-shared-contracts.md §5).
//
// `fresh` is deliberately excluded from the key — it's a request-time
// bypass instruction, not part of the target's identity, so a `fresh: true`
// call and a `fresh: false` call for the same (tool, url, ...) address the
// same cache entry (one bypasses reading it, the other doesn't; both would
// write the same key on a fresh render).

import { createHash } from 'node:crypto';
import type { ToolName } from './job.js';

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify((value as Record<string, unknown>)[k])}`).join(',')}}`;
}

export function computeCacheKey(tool: ToolName, args: Record<string, unknown>): string {
  const cacheableArgs = Object.fromEntries(Object.entries(args).filter(([key]) => key !== 'fresh'));
  const hash = createHash('sha256')
    .update(`${tool}:${stableStringify(cacheableArgs)}`)
    .digest('hex');
  return `cache:${tool}:${hash}`;
}

// Never populate the shared/cloud cache from a URL that plausibly carries a
// per-user or single-use secret — docs/rules §10 (security audit finding):
// a query string or userinfo component means the response could be
// personalized or session-bound, and a path/query segment matching a
// secret-shaped word (token, signature, reset, invite, share, auth, key,
// session, otp, code) means it's likely a one-time or account-scoped link.
// Caching either would let one user's authenticated/single-use content leak
// to any other caller who happens to request an identical-looking URL.
// This is a blanket exclusion, not a best-effort filter — when in doubt,
// don't cache; a cache miss just costs one extra render, not a leak.
const SECRET_SHAPED_PATTERN =
  /(token|signature|reset|invite|share|auth|secret|key|session|otp|code)/i;

export function isCacheableUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }

  if (parsed.username || parsed.password) return false;
  if (parsed.search.length > 0) return false;
  if (SECRET_SHAPED_PATTERN.test(parsed.pathname)) return false;

  return true;
}
