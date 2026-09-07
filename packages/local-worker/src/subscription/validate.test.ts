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
    expect(result).toEqual({ active: true, fromOfflineGrace: false, reason: 'active' });
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

    expect(result).toEqual({ active: true, fromOfflineGrace: true, reason: 'active' });
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
    // Fails closed, but reports WHY. Reported as 'inactive' this sends a paying
    // user to their billing page looking for a fault that is not there -- the
    // cloud server simply did not answer.
    expect(result).toEqual({ active: false, fromOfflineGrace: false, reason: 'unreachable' });
  });

  it('distinguishes an unreachable server from a genuinely inactive subscription', async () => {
    const unreachable = vi
      .fn<[], Promise<CheckOutcome>>()
      .mockResolvedValue({ kind: 'network_error' });
    const declined = vi
      .fn<[], Promise<CheckOutcome>>()
      .mockResolvedValue({ kind: 'definitive', active: false });

    const offline = await new SubscriptionValidator(
      unreachable,
      fakeClock(0),
      REFRESH_MS,
      GRACE_MS,
    ).isActive();
    const lapsed = await new SubscriptionValidator(
      declined,
      fakeClock(0),
      REFRESH_MS,
      GRACE_MS,
    ).isActive();

    // Both stop capture. They are not the same problem and must not read as one.
    expect(offline.active).toBe(false);
    expect(lapsed.active).toBe(false);
    expect(offline.reason).toBe('unreachable');
    expect(lapsed.reason).toBe('inactive');
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

    expect(result).toEqual({ active: false, fromOfflineGrace: false, reason: 'inactive' });
  });
});
