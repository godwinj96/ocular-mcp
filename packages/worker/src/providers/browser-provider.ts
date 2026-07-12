// BrowserProvider interface — see docs/rules/01-architecture.md §3 and
// docs/rules/05-worker-and-browser-pipeline.md §2. Only self-hosted-provider.ts
// may import `patchright` directly (enforced by eslint.config.js).

export interface RungProfile {
  proxy?: { server: string; username?: string; password?: string };
  userAgent: string;
  viewport: { width: number; height: number };
  locale: string;
  timezoneId: string;
}

export interface ProviderHealth {
  rssBytes: number;
  uptimeMs: number;
  requestsSinceRecycle: number;
}

export interface BrowserContextHandle {
  close(): Promise<void>;
}

export interface BrowserProvider {
  init(): Promise<void>;
  newContext(profile: RungProfile): Promise<BrowserContextHandle>;
  recycle(): Promise<void>;
  health(): ProviderHealth;
  dispose(): Promise<void>;
}
