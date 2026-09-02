// Local-path target-safety check — the deliberate INVERSE of
// packages/worker/src/ssrf/authoritative-check.ts's cloud-path check.
// Private IPs are PERMITTED here (a developer viewing their own dev server
// is not crossing a privilege boundary); cloud-metadata ranges are STILL
// BLOCKED (the worker may itself be running on a VPS).
//
// docs/rules/13-local-worker-and-distribution.md §1's hard rule: this is a
// separate, explicitly-named code path — never a flag/toggle on the cloud
// check, and this file is never imported by packages/worker (nor does it
// import from there — see docs/rules/02-repo-structure.md §1 item 5). The
// IPv4/IPv6 classification logic below is deliberately duplicated from the
// cloud check rather than shared, matching the existing precedent of
// packages/dashboard/lib/hash-key.ts's deliberate duplication across a
// package boundary — a helper both paths need would go in @ocular/shared,
// but this specific logic must NOT be shared, since the two paths apply
// opposite polarity to the same classification (cloud: block if private;
// local: allow if private, still block if metadata).

import { lookup } from 'node:dns/promises';

export interface LocalCheckResult {
  allowed: boolean;
  /** True when the resolved address is private/loopback/link-local (i.e. this is a "local" target, not a public one). */
  isPrivate: boolean;
  reason?: 'INVALID_URL' | 'SSRF_BLOCKED';
}

function isCloudMetadataIPv4(ip: string): boolean {
  // 169.254.169.254 specifically — the well-known cloud-metadata endpoint
  // address used by AWS/GCP/Azure/etc. Still blocked on the local path even
  // though the rest of 169.254.0.0/16 (link-local) is otherwise permitted,
  // per docs/rules/13-local-worker-and-distribution.md §1's table.
  return ip === '169.254.169.254';
}

function isPrivateIPv4(ip: string): boolean {
  const parts = ip.split('.').map(Number);
  if (parts.length !== 4 || parts.some((part) => Number.isNaN(part))) return false;
  const [a, b] = parts as [number, number, number, number];
  if (a === 127) return true; // loopback
  if (a === 10) return true; // RFC1918
  if (a === 172 && b >= 16 && b <= 31) return true; // RFC1918
  if (a === 192 && b === 168) return true; // RFC1918
  if (a === 169 && b === 254) return true; // link-local, includes cloud metadata
  if (a === 0) return true; // "this network"
  return false;
}

function isPrivateIPv6(ip: string): boolean {
  const normalized = ip.toLowerCase();
  if (normalized === '::1') return true; // loopback
  if (normalized.startsWith('fe80:')) return true; // link-local
  if (/^f[cd][0-9a-f]{0,2}:/.test(normalized)) return true; // fc00::/7 (ULA)
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(normalized);
  if (mapped?.[1]) return isPrivateIPv4(mapped[1]); // IPv4-mapped IPv6
  return false;
}

// Normalize before resolution — same rule as the cloud check.
export async function localSafetyCheck(url: string): Promise<LocalCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { allowed: false, isPrivate: false, reason: 'INVALID_URL' };
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return { allowed: false, isPrivate: false, reason: 'INVALID_URL' };
  }

  const hostname = parsed.hostname.replace(/^\[|\]$/g, '');

  let resolved: { address: string; family: number }[];
  try {
    resolved = await lookup(hostname, { all: true, verbatim: true });
  } catch {
    return { allowed: false, isPrivate: false, reason: 'INVALID_URL' };
  }

  if (resolved.length === 0) {
    return { allowed: false, isPrivate: false, reason: 'INVALID_URL' };
  }

  // Cloud-metadata check first and absolute — never overridden by the
  // "private IPs are fine locally" allowance, per rules-13 §1's table.
  const hitsMetadata = resolved.some(
    ({ address, family }) => family === 4 && isCloudMetadataIPv4(address),
  );
  if (hitsMetadata) {
    return { allowed: false, isPrivate: true, reason: 'SSRF_BLOCKED' };
  }

  const isPrivate = resolved.some(({ address, family }) =>
    family === 4 ? isPrivateIPv4(address) : isPrivateIPv6(address),
  );

  return { allowed: true, isPrivate };
}
