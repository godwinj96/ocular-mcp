import { describe, expect, it } from 'vitest';
import { viewPageInputSchema } from './view-page.schema.js';
import { inspectUiInputSchema } from './inspect-ui.schema.js';
import { extractAssetsInputSchema } from './extract-assets.schema.js';
import { getQuotaInputSchema } from './get-quota.schema.js';

describe('viewPageInputSchema', () => {
  it('accepts a bare URL and fills in defaults', () => {
    const parsed = viewPageInputSchema.parse({ url: 'https://example.com' });
    expect(parsed).toEqual({
      url: 'https://example.com',
      detail: 'balanced',
      full_page: false,
    });
  });

  it('accepts an explicit viewport within bounds', () => {
    const parsed = viewPageInputSchema.parse({
      url: 'https://example.com',
      viewport: { w: 1280, h: 720 },
    });
    expect(parsed.viewport).toEqual({ w: 1280, h: 720 });
  });

  it('rejects a non-URL string', () => {
    expect(() => viewPageInputSchema.parse({ url: 'not-a-url' })).toThrow();
  });

  it('rejects a viewport below the minimum bound', () => {
    expect(() =>
      viewPageInputSchema.parse({ url: 'https://example.com', viewport: { w: 10, h: 10 } }),
    ).toThrow();
  });

  it('rejects a viewport above the maximum bound', () => {
    expect(() =>
      viewPageInputSchema.parse({ url: 'https://example.com', viewport: { w: 9999, h: 9999 } }),
    ).toThrow();
  });

  it('rejects an invalid detail value', () => {
    expect(() =>
      viewPageInputSchema.parse({ url: 'https://example.com', detail: 'ultra' }),
    ).toThrow();
  });
});

describe('inspectUiInputSchema', () => {
  it('has no full_page field', () => {
    const parsed = inspectUiInputSchema.parse({ url: 'https://example.com' });
    expect(parsed).not.toHaveProperty('full_page');
    expect(parsed.detail).toBe('balanced');
  });
});

describe('extractAssetsInputSchema', () => {
  it('defaults include to all three asset kinds', () => {
    const parsed = extractAssetsInputSchema.parse({ url: 'https://example.com' });
    expect(parsed.include).toEqual(['svg', 'img', 'icons']);
  });

  it('accepts a narrowed include list', () => {
    const parsed = extractAssetsInputSchema.parse({ url: 'https://example.com', include: ['svg'] });
    expect(parsed.include).toEqual(['svg']);
  });

  it('rejects an unknown asset kind', () => {
    expect(() =>
      extractAssetsInputSchema.parse({ url: 'https://example.com', include: ['font'] }),
    ).toThrow();
  });
});

describe('getQuotaInputSchema', () => {
  it('accepts an empty object', () => {
    expect(getQuotaInputSchema.parse({})).toEqual({});
  });
});
