// Minimal, self-contained sRGB <-> OKLCH conversion (Björn Ottosson's OKLab).
// Used exclusively by AwarenessTimeline to interpolate the Persistent
// Field's colour along the Ink<->White axis in OKLCH space (Material
// Specification §IV.15 rule 4) — sRGB-space lerp is explicitly what this
// exists to avoid, since it produces a visible desaturated sag through the
// midpoint that would make the Discovery event look washed rather than
// illuminating.

export type Oklch = { l: number; c: number; h: number };

function srgbChannelToLinear(v: number): number {
  return v <= 0.04045 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4);
}

function linearChannelToSrgb(v: number): number {
  const clamped = Math.min(1, Math.max(0, v));
  return clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * Math.pow(clamped, 1 / 2.4) - 0.055;
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = hex.replace('#', '');
  const r = parseInt(normalized.slice(0, 2), 16) / 255;
  const g = parseInt(normalized.slice(2, 4), 16) / 255;
  const b = parseInt(normalized.slice(4, 6), 16) / 255;
  return { r, g, b };
}

function rgbToHex(r: number, g: number, b: number): string {
  const toByte = (v: number) => Math.round(Math.min(1, Math.max(0, v)) * 255);
  const hex = (v: number) => toByte(v).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

export function hexToOklch(hex: string): Oklch {
  const { r, g, b } = hexToRgb(hex);
  const lr = srgbChannelToLinear(r);
  const lg = srgbChannelToLinear(g);
  const lb = srgbChannelToLinear(b);

  const l = 0.4122214708 * lr + 0.5363325363 * lg + 0.0514459929 * lb;
  const m = 0.2119034982 * lr + 0.6806995451 * lg + 0.1073969566 * lb;
  const s = 0.0883024619 * lr + 0.2817188376 * lg + 0.6299787005 * lb;

  const l_ = Math.cbrt(l);
  const m_ = Math.cbrt(m);
  const s_ = Math.cbrt(s);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const a = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const bLab = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const C = Math.sqrt(a * a + bLab * bLab);
  const H = (Math.atan2(bLab, a) * 180) / Math.PI;

  return { l: L, c: C, h: H < 0 ? H + 360 : H };
}

export function oklchToHex(oklch: Oklch): string {
  const hRad = (oklch.h * Math.PI) / 180;
  const a = oklch.c * Math.cos(hRad);
  const b = oklch.c * Math.sin(hRad);

  const l_ = oklch.l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = oklch.l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = oklch.l - 0.0894841775 * a - 1.291485548 * b;

  const l = l_ * l_ * l_;
  const m = m_ * m_ * m_;
  const s = s_ * s_ * s_;

  const lr = +4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const lg = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const lb = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;

  return rgbToHex(linearChannelToSrgb(lr), linearChannelToSrgb(lg), linearChannelToSrgb(lb));
}

// Shortest-hue-path lerp so the interpolated ramp never swings the long way
// around the hue circle for a two-color, low-chroma system like this one.
function lerpHue(a: number, b: number, t: number): number {
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

export function mixOklchHex(fromHex: string, toHex: string, t: number): string {
  const from = hexToOklch(fromHex);
  const to = hexToOklch(toHex);
  const clamped = Math.min(1, Math.max(0, t));
  return oklchToHex({
    l: from.l + (to.l - from.l) * clamped,
    c: from.c + (to.c - from.c) * clamped,
    h: lerpHue(from.h, to.h, clamped),
  });
}
