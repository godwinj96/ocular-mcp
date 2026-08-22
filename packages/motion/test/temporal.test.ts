import { describe, expect, test } from 'vitest';
import { T, tokenInterpolate } from '../src/tokens/temporal.js';

describe('tokenInterpolate', () => {
  test('clamps before start and holds "from"', () => {
    expect(tokenInterpolate(-10, 0, 'base', 0, 1, 'reveal')).toBe(0);
  });

  test('clamps after start+duration and holds "to"', () => {
    expect(tokenInterpolate(1000, 0, 'base', 0, 1, 'reveal')).toBe(1);
  });

  test('resolves duration tokens to the canonical frame counts', () => {
    expect(T.micro).toBe(4);
    expect(T.swift).toBe(8);
    expect(T.base).toBe(16);
    expect(T.deliberate).toBe(32);
    expect(T.scenic).toBe(64);
    expect(T.monumental).toBe(128);
  });
});
