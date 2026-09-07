import { describe, expect, test, vi, beforeEach, afterEach } from 'vitest';
import { Heartbeat, newWorkerId } from './heartbeat.js';

// The behaviours worth pinning are the ones that would silently lose data or
// silently keep the process alive -- neither of which shows up in a manual test.

function okResponse(): Response {
  return new Response(JSON.stringify({ ok: true }), { status: 200 });
}

describe('Heartbeat', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  test('reports immediately on start rather than waiting for the first interval', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const beat = new Heartbeat({
      getToken: async () => 'token',
      workerId: 'w-1',
      version: '0.4.1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    beat.start();
    await vi.advanceTimersByTimeAsync(0);
    beat.stop();

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('sends capture counts and resets them after a successful report', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const beat = new Heartbeat({
      getToken: async () => 'token',
      workerId: 'w-1',
      version: '0.4.1',
      intervalMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    beat.countCapture('local');
    beat.countCapture('local');
    beat.countCapture('cloud');

    beat.start();
    await vi.advanceTimersByTimeAsync(0);

    const first = JSON.parse((fetchImpl.mock.calls[0]![1] as RequestInit).body as string);
    expect(first.localCaptures).toBe(2);
    expect(first.cloudCaptures).toBe(1);

    await vi.advanceTimersByTimeAsync(1000);
    beat.stop();

    const second = JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string);
    expect(second.localCaptures).toBe(0);
    expect(second.cloudCaptures).toBe(0);
  });

  // The one that actually matters: a developer working offline on a plane
  // should not have their month's capture count silently zeroed.
  test('restores counts when the request fails, so an offline spell loses nothing', async () => {
    const fetchImpl = vi
      .fn()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(okResponse());

    const beat = new Heartbeat({
      getToken: async () => 'token',
      workerId: 'w-1',
      version: '0.4.1',
      intervalMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    beat.countCapture('local');
    beat.start();
    await vi.advanceTimersByTimeAsync(0);

    await vi.advanceTimersByTimeAsync(1000);
    beat.stop();

    const retried = JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string);
    expect(retried.localCaptures).toBe(1);
  });

  test('restores counts on a non-2xx response, not just on a thrown error', async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(new Response('nope', { status: 503 }))
      .mockResolvedValue(okResponse());

    const beat = new Heartbeat({
      getToken: async () => 'token',
      workerId: 'w-1',
      version: '0.4.1',
      intervalMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    beat.countCapture('cloud');
    beat.start();
    await vi.advanceTimersByTimeAsync(0);
    await vi.advanceTimersByTimeAsync(1000);
    beat.stop();

    const retried = JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string);
    expect(retried.cloudCaptures).toBe(1);
  });

  test('counts captured mid-flight are not dropped', async () => {
    let release: (() => void) | undefined;
    const fetchImpl = vi.fn().mockImplementation(
      () =>
        new Promise<Response>((resolve) => {
          release = () => resolve(okResponse());
        }),
    );

    const beat = new Heartbeat({
      getToken: async () => 'token',
      workerId: 'w-1',
      version: '0.4.1',
      intervalMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    beat.start();
    await vi.advanceTimersByTimeAsync(0);

    // Arrives while the first request is still open.
    beat.countCapture('local');
    release?.();
    await vi.advanceTimersByTimeAsync(1000);
    beat.stop();

    const second = JSON.parse((fetchImpl.mock.calls[1]![1] as RequestInit).body as string);
    expect(second.localCaptures).toBe(1);
  });

  test('stop() prevents any further reports', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const beat = new Heartbeat({
      getToken: async () => 'token',
      workerId: 'w-1',
      version: '0.4.1',
      intervalMs: 1000,
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    beat.start();
    await vi.advanceTimersByTimeAsync(0);
    beat.stop();
    await vi.advanceTimersByTimeAsync(5000);

    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  test('a failing token resolver does not throw out of the timer', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(okResponse());
    const beat = new Heartbeat({
      getToken: async () => {
        throw new Error('not signed in');
      },
      workerId: 'w-1',
      version: '0.4.1',
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });

    beat.start();
    await expect(vi.advanceTimersByTimeAsync(0)).resolves.not.toThrow();
    beat.stop();

    expect(fetchImpl).not.toHaveBeenCalled();
  });

  test('worker ids are opaque and unique, not derived from the machine', () => {
    expect(newWorkerId()).not.toBe(newWorkerId());
    expect(newWorkerId()).toMatch(/^[0-9a-f-]{36}$/);
  });
});
