// The ONLY file in the codebase permitted to import `patchright` directly —
// see docs/rules/01-architecture.md §3 and docs/rules/05-worker-and-browser-pipeline.md §2.

import { chromium } from 'patchright';
import type { Browser, BrowserContext, Page } from 'patchright';
import type { BrowserProvider, ProviderHealth, RungProfile } from './browser-provider.js';

// Re-exported so extractors/ladder code can type against Patchright's Page
// and BrowserContext without importing 'patchright' directly (that import is
// restricted to this file — see docs/rules/01-architecture.md §3).
export type { Page, BrowserContext };

export class SelfHostedProvider implements BrowserProvider {
  private browser: Browser | null = null;
  private startedAt = 0;
  private requestCount = 0;

  async init(): Promise<void> {
    this.browser = await chromium.launch({ headless: true });
    this.startedAt = Date.now();
    this.requestCount = 0;
  }

  async newContext(profile: RungProfile): Promise<BrowserContext> {
    if (!this.browser) {
      throw new Error('provider not initialized — call init() first');
    }
    this.requestCount += 1;
    // Rule: every field below must be internally coherent (proxy geo, UA,
    // locale, timezone) — rung-profiles.ts owns generating coherent bundles.
    return this.browser.newContext({
      proxy: profile.proxy,
      userAgent: profile.userAgent,
      viewport: profile.viewport,
      locale: profile.locale,
      timezoneId: profile.timezoneId,
    });
  }

  async recycle(): Promise<void> {
    await this.browser?.close();
    await this.init();
  }

  health(): ProviderHealth {
    return {
      rssBytes: process.memoryUsage().rss,
      uptimeMs: this.startedAt ? Date.now() - this.startedAt : 0,
      requestsSinceRecycle: this.requestCount,
    };
  }

  async dispose(): Promise<void> {
    await this.browser?.close();
    this.browser = null;
  }
}
