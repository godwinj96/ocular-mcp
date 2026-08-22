import { describe, expect, test } from 'vitest';
import { hexToOklch, mixOklchHex, oklchToHex } from '../src/tokens/color.js';
import { INK, WHITE } from '../src/tokens/brand.js';

describe('OKLCH color roundtrip', () => {
  test('hex -> oklch -> hex roundtrips within rounding tolerance', () => {
    const result = oklchToHex(hexToOklch(INK));
    expect(result.toUpperCase()).toBe(INK.toUpperCase());
  });

  test('mixOklchHex(t=0) returns the from color, t=1 returns the to color', () => {
    expect(mixOklchHex(INK, WHITE, 0).toUpperCase()).toBe(INK.toUpperCase());
    expect(mixOklchHex(INK, WHITE, 1).toUpperCase()).toBe(WHITE.toUpperCase());
  });

  test('mixOklchHex midpoint is lighter than INK and darker than WHITE', () => {
    const mid = hexToOklch(mixOklchHex(INK, WHITE, 0.5));
    const inkL = hexToOklch(INK).l;
    const whiteL = hexToOklch(WHITE).l;
    expect(mid.l).toBeGreaterThan(inkL);
    expect(mid.l).toBeLessThan(whiteL);
  });
});
