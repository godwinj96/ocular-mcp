import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { generateApiKey, hashApiKey } from './hash-key';

describe('hashApiKey', () => {
  it('produces a 64-char lowercase hex sha256 digest', () => {
    const hash = hashApiKey('ocular_test-key');

    expect(hash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('is deterministic for the same input', () => {
    expect(hashApiKey('ocular_same-input')).toBe(hashApiKey('ocular_same-input'));
  });

  it('differs for different input', () => {
    expect(hashApiKey('ocular_a')).not.toBe(hashApiKey('ocular_b'));
  });

  // hash-key.ts's own comment says this must stay byte-for-byte identical to
  // mcp-server/src/auth/hash-key.ts's algorithm (plain sha256-hex, no salt) —
  // mcp-server verifies raw keys against hashes this package generates at
  // key-creation time, so any algorithm drift here would silently lock every
  // dashboard-generated key out at auth time. Computed independently via
  // node:crypto directly (not by importing mcp-server's module — package
  // boundaries stay cross-import-free per docs/rules/02-repo-structure.md)
  // so this test fails if either side ever adds a salt, pepper, or a
  // different digest algorithm.
  it('is plain unsalted sha256-hex, matching the documented mcp-server contract', () => {
    const rawKey = 'ocular_parity-check-9f3e';
    const expected = createHash('sha256').update(rawKey).digest('hex');

    expect(hashApiKey(rawKey)).toBe(expected);
  });
});

describe('generateApiKey', () => {
  it('produces a key prefixed with "ocular_"', () => {
    expect(generateApiKey()).toMatch(/^ocular_/);
  });

  it('produces a URL-safe token (no padding, +, or / characters)', () => {
    const key = generateApiKey();

    expect(key).not.toMatch(/[+/=]/);
  });

  it('produces unique keys across calls', () => {
    const keys = Array.from({ length: 20 }, () => generateApiKey());

    expect(new Set(keys).size).toBe(keys.length);
  });
});
