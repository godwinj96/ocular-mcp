// view_page extractor — accessibility tree, local path. Same DOM-walk
// design as packages/worker/src/extractors/a11y-tree.ts (see that file's
// header comment for the native-AX-API-vs-DOM-walk trade-off rationale) —
// deliberately duplicated, not shared, same rationale as this package's
// other extractors (design-tokens.ts, assets.ts).

import type { A11yTree } from '@ocular/shared';
import type { HeadlessShellPage } from '../browser/headless-shell.js';

const MAX_A11Y_NODES = 1500;

export async function extractA11yTree(page: HeadlessShellPage): Promise<A11yTree> {
  return page.evaluateFn(
    ({ maxNodes }: { maxNodes: number }) => {
      let nodeCount = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const ROLE_MAP: Record<string, string> = {
        a: 'link',
        button: 'button',
        input: 'textbox',
        textarea: 'textbox',
        select: 'combobox',
        img: 'img',
        h1: 'heading',
        h2: 'heading',
        h3: 'heading',
        h4: 'heading',
        h5: 'heading',
        h6: 'heading',
        nav: 'navigation',
        main: 'main',
        header: 'banner',
        footer: 'contentinfo',
        ul: 'list',
        ol: 'list',
        li: 'listitem',
        table: 'table',
        form: 'form',
      };

      function roleOf(el: Element): string {
        const explicit = el.getAttribute('role');
        if (explicit) return explicit;
        return ROLE_MAP[el.tagName.toLowerCase()] ?? 'generic';
      }

      function nameOf(el: Element): string | undefined {
        const aria = el.getAttribute('aria-label');
        if (aria) return aria;
        const alt = el.getAttribute('alt');
        if (alt) return alt;
        const title = el.getAttribute('title');
        if (title) return title;
        const text = (el.textContent ?? '').trim();
        return text ? text.slice(0, 120) : undefined;
      }

      interface WalkNode {
        role: string;
        name?: string;
        inView: boolean;
        coords: { x: number; y: number; w: number; h: number };
        children: WalkNode[];
      }

      function buildNode(el: Element): WalkNode | null {
        if (nodeCount >= maxNodes) return null;
        nodeCount++;

        const rect = el.getBoundingClientRect();
        const inView =
          rect.width > 0 &&
          rect.height > 0 &&
          rect.bottom >= 0 &&
          rect.top <= vh &&
          rect.right >= 0 &&
          rect.left <= vw;

        const children: WalkNode[] = [];
        for (const child of Array.from(el.children)) {
          if (nodeCount >= maxNodes) break;
          const built = buildNode(child);
          if (built) children.push(built);
        }

        return {
          role: roleOf(el),
          name: nameOf(el),
          inView,
          coords: {
            x: rect.x + window.scrollX,
            y: rect.y + window.scrollY,
            w: rect.width,
            h: rect.height,
          },
          children,
        };
      }

      const root = buildNode(document.body) ?? {
        role: 'generic',
        inView: false,
        coords: { x: 0, y: 0, w: 0, h: 0 },
        children: [],
      };

      return { root, truncated: nodeCount >= maxNodes, nodeCount };
    },
    { maxNodes: MAX_A11Y_NODES },
  );
}
