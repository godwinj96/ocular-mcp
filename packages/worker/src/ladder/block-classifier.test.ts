import { describe, expect, it } from 'vitest';
import { classifyBlock } from './block-classifier.js';

describe('classifyBlock', () => {
  it('classifies a normal 200 response with real content as CLEAN', () => {
    const verdict = classifyBlock({
      httpStatus: 200,
      responseHeaders: {},
      title: 'Example Domain',
      bodyTextLength: 500,
    });
    expect(verdict).toBe('CLEAN');
  });

  // Regression test: a live smoke test against the real example.com (which is
  // served via Cloudflare but shows no challenge) initially misclassified as
  // CHALLENGE because the classifier treated `server: cloudflare` alone as a
  // challenge signal — most of the web is Cloudflare-fronted without being
  // blocked. Only `cf-mitigated` (set specifically when Cloudflare actually
  // served a challenge) is a real signal.
  it('does not classify a plain Cloudflare-fronted 200 response as CHALLENGE', () => {
    const verdict = classifyBlock({
      httpStatus: 200,
      responseHeaders: { server: 'cloudflare', 'cf-cache-status': 'HIT' },
      title: 'Example Domain',
      bodyTextLength: 500,
    });
    expect(verdict).toBe('CLEAN');
  });

  it('classifies a response with cf-mitigated header as CHALLENGE', () => {
    const verdict = classifyBlock({
      httpStatus: 200,
      responseHeaders: { 'cf-mitigated': 'challenge' },
      title: 'Just a moment...',
      bodyTextLength: 200,
    });
    expect(verdict).toBe('CHALLENGE');
  });

  it('classifies a "Just a moment..." title as CHALLENGE', () => {
    const verdict = classifyBlock({
      httpStatus: 200,
      responseHeaders: {},
      title: 'Just a moment...',
      bodyTextLength: 200,
    });
    expect(verdict).toBe('CHALLENGE');
  });

  it('classifies HTTP 429 as CHALLENGE', () => {
    const verdict = classifyBlock({ httpStatus: 429, responseHeaders: {}, title: '', bodyTextLength: 100 });
    expect(verdict).toBe('CHALLENGE');
  });

  it('classifies HTTP 403 as HARD_BLOCK', () => {
    const verdict = classifyBlock({ httpStatus: 403, responseHeaders: {}, title: 'Forbidden', bodyTextLength: 50 });
    expect(verdict).toBe('HARD_BLOCK');
  });

  it('classifies an "Access Denied" title as HARD_BLOCK', () => {
    const verdict = classifyBlock({ httpStatus: 200, responseHeaders: {}, title: 'Access Denied', bodyTextLength: 50 });
    expect(verdict).toBe('HARD_BLOCK');
  });

  it('classifies HTTP 500+ as HARD_BLOCK', () => {
    const verdict = classifyBlock({ httpStatus: 503, responseHeaders: {}, title: '', bodyTextLength: 200 });
    expect(verdict).toBe('HARD_BLOCK');
  });

  it('classifies a near-empty body with no other signals as EMPTY', () => {
    const verdict = classifyBlock({ httpStatus: 200, responseHeaders: {}, title: 'Untitled', bodyTextLength: 5 });
    expect(verdict).toBe('EMPTY');
  });
});
