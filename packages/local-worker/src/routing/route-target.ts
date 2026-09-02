// Local-vs-cloud routing heuristic — decides which execution path a given
// capture target goes through. Not fully specified anywhere in
// docs/Ocular_PRD_v0.2.md or docs/rules/13-local-worker-and-distribution.md;
// this file is where that decision is designed, per the local-worker
// implementation plan's Phase 2 scope.
//
// Rule chain (first match wins):
//   1. Literal localhost/127.0.0.1/::1 hostname                 -> local
//   2. Resolves to a private/link-local IP (localSafetyCheck)    -> local
//   3. Explicit user-configured allowlist domain                -> local
//   4. Everything else                                          -> cloud
//
// Cloud-metadata targets are rejected outright regardless of path — that's
// localSafetyCheck's job, called here so routing and safety share one DNS
// resolution instead of resolving twice.

import { localSafetyCheck } from '../ssrf/local-check.js';
import { config } from '../config.js';

export type RouteTarget = 'local' | 'cloud';

export type RouteDecision =
  | { route: RouteTarget }
  /** Rejected outright (e.g. cloud-metadata, malformed URL) — neither path should render it. */
  | { route: 'blocked'; reason: 'INVALID_URL' | 'SSRF_BLOCKED' };

function hostnameIsLiteralLocalhost(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    const normalized = hostname.replace(/^\[|\]$/g, '').toLowerCase();
    return normalized === 'localhost' || normalized === '127.0.0.1' || normalized === '::1';
  } catch {
    return false;
  }
}

function hostnameMatchesAllowlist(url: string, allowlist: readonly string[]): boolean {
  if (allowlist.length === 0) return false;
  try {
    const { hostname } = new URL(url);
    return allowlist.some((domain) => hostname.toLowerCase() === domain.toLowerCase());
  } catch {
    return false;
  }
}

export async function routeTarget(
  url: string,
  localDomains: readonly string[] = config.localDomains,
): Promise<RouteDecision> {
  if (hostnameIsLiteralLocalhost(url)) {
    return { route: 'local' };
  }

  if (hostnameMatchesAllowlist(url, localDomains)) {
    return { route: 'local' };
  }

  // Resolve once, via localSafetyCheck, to answer both "is this private"
  // (routing question) and "is this outright blocked" (metadata-range
  // safety question) from a single DNS lookup.
  const check = await localSafetyCheck(url);
  if (!check.allowed) {
    return { route: 'blocked', reason: check.reason ?? 'SSRF_BLOCKED' };
  }

  return { route: check.isPrivate ? 'local' : 'cloud' };
}
