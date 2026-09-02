// view_page extractor — accessibility tree, shipped alongside every
// screenshot. See docs/rules/05-worker-and-browser-pipeline.md §4a.
//
// Design note: this builds a Set-of-Mark tree from a bounded DOM walk
// (role/name inferred from tag+ARIA, coordinates from getBoundingClientRect)
// rather than calling the browser's native Accessibility.snapshot() API.
// The native API is more ARIA-computation-correct but doesn't include
// per-node coordinates — getting those would need a second CDP round-trip
// (DOM.getBoxModel) per node, matched by backendNodeId, considerably more
// complex than the single evaluate() call every other extractor in this
// file already uses. This is a deliberate accuracy-vs-consistency
// trade-off, not an oversight: role/name here are a simplified heuristic,
// not the browser's exact accessible-name-and-description algorithm.
// Revisit if agent feedback shows the heuristic misclassifies often enough
// to matter.

import type { Page } from '../providers/self-hosted-provider.js';
import type { A11yTree } from '@ocular/shared';

const MAX_A11Y_NODES = 1500;

export async function extractA11yTree(page: Page): Promise<A11yTree> {
  return page.evaluate(
    ({ maxNodes }) => {
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
