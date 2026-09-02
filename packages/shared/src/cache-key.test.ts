import { describe, expect, it } from 'vitest';
import { computeCacheKey, isCacheableUrl } from './cache-key.js';

describe('computeCacheKey', () => {
  it('is deterministic for the same tool and args', () => {
    const a = computeCacheKey('view_page', { url: 'https://example.com', detail: 'balanced' });
    const b = computeCacheKey('view_page', { url: 'https://example.com', detail: 'balanced' });
    expect(a).toBe(b);
  });

  it('is independent of key order (same identity, different object literal order)', () => {
    const a = computeCacheKey('view_page', { url: 'https://example.com', detail: 'balanced' });
    const b = computeCacheKey('view_page', { detail: 'balanced', url: 'https://example.com' });
    expect(a).toBe(b);
  });

  it('differs for a different tool with identical args', () => {
    const a = computeCacheKey('view_page', { url: 'https://example.com' });
    const b = computeCacheKey('inspect_ui', { url: 'https://example.com' });
    expect(a).not.toBe(b);
  });

  it('differs for a different URL', () => {
    const a = computeCacheKey('view_page', { url: 'https://example.com' });
    const b = computeCacheKey('view_page', { url: 'https://example.org' });
    expect(a).not.toBe(b);
  });

  it('differs for a different meaningful arg (e.g. detail level)', () => {
    const a = computeCacheKey('view_page', { url: 'https://example.com', detail: 'low' });
    const b = computeCacheKey('view_page', { url: 'https://example.com', detail: 'high' });
    expect(a).not.toBe(b);
  });

  it('ignores the fresh flag — a fresh:true and fresh:false call address the same cache entry', () => {
    const a = computeCacheKey('view_page', {
      url: 'https://example.com',
      detail: 'balanced',
      fresh: true,
    });
    const b = computeCacheKey('view_page', {
      url: 'https://example.com',
      detail: 'balanced',
      fresh: false,
    });
    expect(a).toBe(b);
  });
});

describe('isCacheableUrl', () => {
  it('allows a plain URL with no query, userinfo, or secret-shaped path', () => {
    expect(isCacheableUrl('https://example.com/pricing')).toBe(true);
  });

  it('rejects a URL with a query string', () => {
    expect(isCacheableUrl('https://example.com/page?token=abc123')).toBe(false);
  });

  it('rejects a URL with userinfo', () => {
    expect(isCacheableUrl('https://user:pass@example.com/page')).toBe(false);
  });

  it.each([
    'https://example.com/reset-password/abc',
    'https://example.com/invite/abc',
    'https://example.com/share/abc',
    'https://example.com/auth/callback',
    'https://example.com/session/abc',
    'https://example.com/otp/abc',
  ])('rejects a secret-shaped path: %s', (url) => {
    expect(isCacheableUrl(url)).toBe(false);
  });

  it('rejects an unparseable URL', () => {
    expect(isCacheableUrl('not a url')).toBe(false);
  });
});
