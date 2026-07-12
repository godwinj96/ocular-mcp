// Same sha256 scheme as packages/mcp-server/src/auth/hash-key.ts — duplicated
// deliberately, not cross-imported, per docs/rules/02-repo-structure.md's
// package-boundary rule (dashboard never imports mcp-server runtime code).
// Static keys are only ever looked up by hash; the raw key is shown to the
// user once at generation time and never stored/logged.
import { createHash } from 'node:crypto';

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}

export function generateApiKey(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const token = Buffer.from(bytes).toString('base64url');
  return `ocular_${token}`;
}
