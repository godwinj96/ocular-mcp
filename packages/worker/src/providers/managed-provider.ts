// Stub for a future managed-browser backend (e.g. Browserbase) swapped in
// behind BrowserProvider without touching the pipeline. Not built in Phase 1.

import type { BrowserContextHandle, BrowserProvider, ProviderHealth, RungProfile } from './browser-provider.js';

export class ManagedProvider implements BrowserProvider {
  async init(): Promise<void> {
    throw new Error('ManagedProvider not implemented — deferred out of Phase 1');
  }

  async newContext(profile: RungProfile): Promise<BrowserContextHandle> {
    void profile;
    throw new Error('ManagedProvider not implemented — deferred out of Phase 1');
  }

  async recycle(): Promise<void> {
    throw new Error('ManagedProvider not implemented — deferred out of Phase 1');
  }

  health(): ProviderHealth {
    throw new Error('ManagedProvider not implemented — deferred out of Phase 1');
  }

  async dispose(): Promise<void> {
    throw new Error('ManagedProvider not implemented — deferred out of Phase 1');
  }
}
