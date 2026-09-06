// Covers createCloudSubscriptionCheck's ERROR MAPPING specifically.
//
// validate.test.ts covers SubscriptionValidator's caching and grace logic but
// never exercises this function, so the mapping below was uncovered while
// being the exact thing the design warns about: confusing "not signed in"
// with "offline" turns a dropped connection into a cancelled subscription.

import { beforeEach, describe, expect, it, vi } from 'vitest';

const connectCloudClient = vi.fn();

vi.mock('../http/cloud-client.js', async () => {
  const actual =
    await vi.importActual<typeof import('../http/cloud-client.js')>('../http/cloud-client.js');
  return {
    ...actual,
    connectCloudClient: (...args: unknown[]) => connectCloudClient(...args),
  };
});

const { CredentialUnavailableError, NoApiKeyError } = await import('../http/cloud-client.js');
const { createCloudSubscriptionCheck } = await import('./validate.js');

function fakeClient(callTool: () => Promise<unknown>) {
  return { callTool, close: vi.fn().mockResolvedValue(undefined) };
}

beforeEach(() => {
  connectCloudClient.mockReset();
});

describe('createCloudSubscriptionCheck', () => {
  it('maps "not signed in" to a DEFINITIVE inactive — a config state has a real answer', async () => {
    connectCloudClient.mockRejectedValue(new NoApiKeyError());
    const result = await createCloudSubscriptionCheck()();
    expect(result).toEqual({ kind: 'definitive', active: false });
  });

  it('maps an offline credential lookup to network_error, NOT a cancelled subscription', async () => {
    // This is the regression guard. If this ever returns definitive:false,
    // a user with flaky wifi gets locked out of a subscription they pay for.
    connectCloudClient.mockRejectedValue(new CredentialUnavailableError('ENOTFOUND'));
    const result = await createCloudSubscriptionCheck()();
    expect(result).toEqual({ kind: 'network_error' });
  });

  it('maps an unknown connection failure to network_error', async () => {
    connectCloudClient.mockRejectedValue(new Error('ECONNREFUSED'));
    const result = await createCloudSubscriptionCheck()();
    expect(result).toEqual({ kind: 'network_error' });
  });

  it('treats a successful get_quota as definitive proof of an active subscription', async () => {
    connectCloudClient.mockResolvedValue(fakeClient(async () => ({ isError: false, content: [] })));
    const result = await createCloudSubscriptionCheck()();
    expect(result).toEqual({ kind: 'definitive', active: true });
  });

  it('treats an errored get_quota as definitively inactive', async () => {
    connectCloudClient.mockResolvedValue(fakeClient(async () => ({ isError: true, content: [] })));
    const result = await createCloudSubscriptionCheck()();
    expect(result).toEqual({ kind: 'definitive', active: false });
  });

  it('treats a mid-request failure as network_error, not an auth answer', async () => {
    connectCloudClient.mockResolvedValue(
      fakeClient(() => Promise.reject(new Error('socket hang up'))),
    );
    const result = await createCloudSubscriptionCheck()();
    expect(result).toEqual({ kind: 'network_error' });
  });

  it('always closes the client, even when the call fails', async () => {
    const close = vi.fn().mockResolvedValue(undefined);
    connectCloudClient.mockResolvedValue({
      callTool: () => Promise.reject(new Error('boom')),
      close,
    });
    await createCloudSubscriptionCheck()();
    expect(close).toHaveBeenCalledTimes(1);
  });
});
