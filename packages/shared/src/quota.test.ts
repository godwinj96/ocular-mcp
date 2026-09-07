import { describe, expect, it } from 'vitest';
import { createQuotaReader, quotaKey } from './quota.js';
import type { QuotaPeekClient } from './quota.js';

function fakeClient(store: Record<string, string>): QuotaPeekClient {
  return {
    async get(key: string) {
      return key in store ? store[key] : null;
    },
  };
}

describe('quotaKey', () => {
  it('namespaces by account id', () => {
    expect(quotaKey('acct_123')).toBe('quota:acct_123');
  });
});

describe('createQuotaReader', () => {
  it('returns the full dailyQuota when no key exists yet', async () => {
    const getQuotaStatus = createQuotaReader(fakeClient({}));
    const status = await getQuotaStatus('acct_123', 40);
    expect(status.remaining).toBe(40);
  });

  it('returns the stored remaining value when a key exists', async () => {
    const getQuotaStatus = createQuotaReader(fakeClient({ 'quota:acct_123': '12.5' }));
    const status = await getQuotaStatus('acct_123', 40);
    expect(status.remaining).toBe(12.5);
  });
});
