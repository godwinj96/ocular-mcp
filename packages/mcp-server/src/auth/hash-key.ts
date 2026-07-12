// Static API key hashing. Per infra/postgres/README.md and
// docs/rules/04-mcp-server-and-auth.md §2, the raw key is never stored —
// only its hash, checked directly against static_api_keys.key_hash.

import { createHash } from 'node:crypto';

export function hashApiKey(rawKey: string): string {
  return createHash('sha256').update(rawKey).digest('hex');
}
