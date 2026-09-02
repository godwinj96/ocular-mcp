import { describe, expect, it, vi } from 'vitest';
import { SubscriptionValidator } from './validate.js';
import type { CheckOutcome, Clock } from './validate.js';

const REFRESH_MS = 15 * 60_000;
const GRACE_MS = 72 * 60 * 60_000;

function fakeClock(startMs: number): Clock & { advance(ms: number): void } {
  let now = startMs;
  return {
    now: () => now,
    advance: (ms: number) => {
      now += ms;
    },
  };
}

describe('SubscriptionValidator', () => {
  it('trusts a definitive active result', async () => {
    const check = vi
      .fn<[], Promise<CheckOutcome>>()
      .mockResolvedValue({ kind: 'definitive', active: true });
    const validator = new SubscriptionValidator(check, fakeClock(0), REFRESH_MS, GRACE_MS);

    const result = await validator.isActive();
    expect(result).toEqual({ active: true, fromOfflineGrace: false });
    expect(check).toHaveBeenCalledTimes(1);
  });

  it('fails closed on a definitive inactive result — never a default free tier', async () => {
    const check = vi
      .fn<[], Promise<CheckOutcome>>()
      .mockResolvedValue({ kind: 'definitive', active: false });
    const validator = new SubscriptionValidator(check, fakeClock(0), REFRESH_MS, GRACE_MS);

    const result = await validator.isActive();
    expect(result.active).toBe(false);
  });

  it('reuses a cached result within the refresh window without re-checking', async () => {
    const check = vi
      .fn<[], Promise<CheckOutcome>>()
      .mockResolvedValue({ kind: 'definitive', active: true });
    const clock = fakeClock(0);
    const validator = new SubscriptionValidator(check, clock, REFRESH_MS, GRACE_MS);

    await validator.isActive();
    clock.advance(REFRESH_MS - 1000);
    await validator.isActive();

    expect(check).toHaveBeenCalledTimes(1);
  });

  it('re-checks once the refresh window elapses', async () => {
    const check = vi
      .fn<[], Promise<CheckOutcome>>()
      .mockResolvedValue({ kind: 'definitive', active: true });
    const clock = fakeClock(0);
    const validator = new SubscriptionValidator(check, clock, REFRESH_MS, GRACE_MS);

    await validator.isActive();
    clock.advance(REFRESH_MS + 1000);
    await validator.isActive();

    expect(check).toHaveBeenCalledTimes(2);
  });

  it('a definitively-confirmed cache survives a network error within the offline-grace window', async () => {
    const check = vi
      .fn<[], Promise<CheckOutcome>>()
      .mockResolvedValueOnce({ kind: 'definitive', active: true })
      .mockResolvedValueOnce({ kind: 'network_error' });
    const clock = fakeClock(0);
    const validator = new SubscriptionValidator(check, clock, REFRESH_MS, GRACE_MS);

    await validator.isActive(); // confirms active, caches it
    clock.advance(REFRESH_MS + 1000); // force a re-check attempt
    const result = await validator.isActive(); // network error this time

    expect(result).toEqual({ active: true, fromOfflineGrace: true });
  });

  it('fails closed once the offline-grace window is exceeded — a developer on a plane loses local rendering, not gets it free forever', async () => {
    const check = vi
      .fn<[], Promise<CheckOutcome>>()
      .mockResolvedValueOnce({ kind: 'definitive', active: true })
      .mockResolvedValue({ kind: 'network_error' });
    const clock = fakeClock(0);
    const validator = new SubscriptionValidator(check, clock, REFRESH_MS, GRACE_MS);

    await validator.isActive();
    clock.advance(GRACE_MS + REFRESH_MS + 1000);
    const result = await validator.isActive();

    expect(result.active).toBe(false);
  });

  it('a network error with no prior confirmed check fails closed immediately — cannot grant grace to an unconfirmed account', async () => {
    const check = vi.fn<[], Promise<CheckOutcome>>().mockResolvedValue({ kind: 'network_error' });
    const validator = new SubscriptionValidator(check, fakeClock(0), REFRESH_MS, GRACE_MS);

    const result = await validator.isActive();
    expect(result).toEqual({ active: false, fromOfflineGrace: false });
  });

  it('a definitive inactive result overrides a previously-cached active grace state — no stale positive survives a real answer', async () => {
    const check = vi
      .fn<[], Promise<CheckOutcome>>()
      .mockResolvedValueOnce({ kind: 'definitive', active: true })
      .mockResolvedValueOnce({ kind: 'definitive', active: false });
    const clock = fakeClock(0);
    const validator = new SubscriptionValidator(check, clock, REFRESH_MS, GRACE_MS);

    await validator.isActive();
    clock.advance(REFRESH_MS + 1000);
    const result = await validator.isActive();

    expect(result).toEqual({ active: false, fromOfflineGrace: false });
  });
});
