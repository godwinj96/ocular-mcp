// inspect_ui extractor — local path. Deliberately near-identical logic to
// packages/worker/src/extractors/design-tokens.ts (same caps, same
// categories) so the two paths report design tokens consistently; ported
// from Patchright's page.evaluate(fn, arg) form to CDP's evaluateFn() (see
// ../browser/headless-shell.ts). Duplicated rather than shared for the same
// reason as ../image/pipeline.ts — the DOM-walk closure itself is
// engine-agnostic, but each engine's page-evaluation entrypoint is
// different, and packages/local-worker must not import from packages/worker
// (docs/rules/13-local-worker-and-distribution.md §1).

import type { HeadlessShellPage } from '../browser/headless-shell.js';

export interface DesignTokens {
  palette: string[];
  typography: string[];
  spacing: string[];
  radius: string[];
  shadow: string[];
  breakpoints: number[];
}

const MAX_ELEMENTS_WALKED = 800;
const MAX_TOKENS_PER_CATEGORY = 40;

export async function extractDesignTokens(page: HeadlessShellPage): Promise<DesignTokens> {
  return page.evaluateFn(
    ({ maxElements, maxPerCategory }: { maxElements: number; maxPerCategory: number }) => {
      const palette = new Set<string>();
      const typography = new Set<string>();
      const spacing = new Set<string>();
      const radius = new Set<string>();
      const shadow = new Set<string>();

      const isMeaningful = (value: string): boolean =>
        value !== '' && value !== 'none' && value !== 'normal' && value !== '0px';

      const elements = Array.from(document.querySelectorAll('*')).slice(0, maxElements);

      for (const el of elements) {
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) continue;

        const style = window.getComputedStyle(el);

        if (palette.size < maxPerCategory) {
          if (isMeaningful(style.color)) palette.add(style.color);
          if (isMeaningful(style.backgroundColor)) palette.add(style.backgroundColor);
        }
        if (typography.size < maxPerCategory) {
          typography.add(`${style.fontFamily} ${style.fontSize} ${style.fontWeight}`);
        }
        if (spacing.size < maxPerCategory) {
          if (isMeaningful(style.padding)) spacing.add(style.padding);
          if (isMeaningful(style.margin)) spacing.add(style.margin);
        }
        if (radius.size < maxPerCategory && isMeaningful(style.borderRadius)) {
          radius.add(style.borderRadius);
        }
        if (shadow.size < maxPerCategory && isMeaningful(style.boxShadow)) {
          shadow.add(style.boxShadow);
        }
      }

      const candidateBreakpoints = [320, 375, 480, 640, 768, 1024, 1280, 1440, 1920];
      const declaredBreakpoints = new Set<number>();
      for (const sheet of Array.from(document.styleSheets)) {
        let rules: CSSRuleList;
        try {
          rules = sheet.cssRules;
        } catch {
          continue;
        }
        for (const rule of Array.from(rules)) {
          if (rule instanceof CSSMediaRule) {
            for (const bp of candidateBreakpoints) {
              if (rule.media.mediaText.includes(`${bp}px`)) declaredBreakpoints.add(bp);
            }
          }
        }
      }

      return {
        palette: Array.from(palette),
        typography: Array.from(typography),
        spacing: Array.from(spacing),
        radius: Array.from(radius),
        shadow: Array.from(shadow),
        breakpoints: Array.from(declaredBreakpoints).sort((a, b) => a - b),
      };
    },
    { maxElements: MAX_ELEMENTS_WALKED, maxPerCategory: MAX_TOKENS_PER_CATEGORY },
  );
}
