// view_page extractor — accessibility tree, local path. Same DOM-walk
// design as packages/worker/src/extractors/a11y-tree.ts (see that file's
// header comment for the native-AX-API-vs-DOM-walk trade-off rationale) —
// deliberately duplicated, not shared, same rationale as this package's
// other extractors (design-tokens.ts, assets.ts).

import type { A11yTree } from '@ocular/shared';
import type { HeadlessShellPage } from '../browser/headless-shell.js';
import { scopeToViewport } from './a11y-scope.js';

const MAX_A11Y_NODES = 1500;

/**
 * The FULL tree, below-fold detail included -- what `get_tree` returns.
 *
 * This is the same walk with the viewport split switched off. It exists as a
 * separate entry point rather than a flag on the capture path so the default
 * response can never accidentally become the expensive one: a caller has to ask
 * for this by name.
 *
 * `fromY` scopes the walk to a region of the page, which is how a caller pages
 * through a document too long to return at once. The outline's heading offsets
 * are exactly the values to pass.
 */
export async function extractFullA11yTree(
  page: HeadlessShellPage,
  opts: { fromY?: number; limit?: number } = {},
): Promise<A11yTree> {
  return page.evaluateFn(
    ({ maxNodes, fromY }: { maxNodes: number; fromY: number | null }) => {
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
        return el.getAttribute('role') ?? ROLE_MAP[el.tagName.toLowerCase()] ?? 'generic';
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
        const y = Math.round(rect.y + window.scrollY);
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

        const role = roleOf(el);
        const name = nameOf(el);

        // Same two safety rules as the capture-path walk: only a zero-area
        // nameless generic is ever dropped, and only a geometry-free wrapper is
        // ever collapsed.
        if (
          role === 'generic' &&
          !name &&
          children.length === 0 &&
          (rect.width === 0 || rect.height === 0)
        ) {
          return null;
        }

        // Region scoping: skip a node that ends before the requested offset and
        // has nothing below it either.
        if (fromY !== null && children.length === 0 && y + Math.round(rect.height) < fromY) {
          return null;
        }

        return {
          role,
          name,
          inView,
          coords: {
            x: Math.round(rect.x + window.scrollX),
            y,
            w: Math.round(rect.width),
            h: Math.round(rect.height),
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
    { maxNodes: Math.min(opts.limit ?? MAX_A11Y_NODES, 5000), fromY: opts.fromY ?? null },
  );
}

// See a11y-scope.ts's header for the full rationale. scopeToViewport is
// spliced into the CDP expression below via .toString() rather than
// hand-duplicated, so the function this file's tests exercise is exactly the
// function that runs in the browser -- verified by a11y-scope.test.ts's own
// ".toString() portability" case, which reconstitutes it the same way and
// checks it still behaves identically.
const SCOPE_TO_VIEWPORT_SOURCE = scopeToViewport.toString();

export async function extractA11yTree(page: HeadlessShellPage): Promise<A11yTree> {
  const expression = `
    (function () {
      const maxNodes = ${MAX_A11Y_NODES};
      let nodeCount = 0;
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      const ROLE_MAP = {
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

      function roleOf(el) {
        const explicit = el.getAttribute('role');
        if (explicit) return explicit;
        return ROLE_MAP[el.tagName.toLowerCase()] || 'generic';
      }

      function nameOf(el) {
        const aria = el.getAttribute('aria-label');
        if (aria) return aria;
        const alt = el.getAttribute('alt');
        if (alt) return alt;
        const title = el.getAttribute('title');
        if (title) return title;
        const text = (el.textContent || '').trim();
        return text ? text.slice(0, 120) : undefined;
      }

      function buildNode(el) {
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

        const children = [];
        for (const child of Array.from(el.children)) {
          if (nodeCount >= maxNodes) break;
          const built = buildNode(child);
          if (!built) continue;

          // A nameless generic wrapper that adds NO DISTINCT GEOMETRY -- one
          // child, same box -- is hoisted. Provably lossless: the wrapper's
          // rect is the child's rect. See a11y-tree.ts's git history / DEVLOG
          // session-34 entry for why nothing stronger than this is safe.
          if (
            built.role === 'generic' &&
            !built.name &&
            built.children.length === 1 &&
            Math.abs(built.children[0].coords.w - built.coords.w) < 1 &&
            Math.abs(built.children[0].coords.h - built.coords.h) < 1
          ) {
            children.push(built.children[0]);
          } else {
            children.push(built);
          }
        }

        const role = roleOf(el);
        const name = nameOf(el);

        // The ONLY node ever dropped: a nameless generic leaf with zero area.
        if (role === 'generic' && !name && children.length === 0 && (rect.width === 0 || rect.height === 0)) {
          return null;
        }

        return {
          role: role,
          name: name,
          inView: inView,
          coords: {
            x: Math.round(rect.x + window.scrollX),
            y: Math.round(rect.y + window.scrollY),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          },
          children: children,
        };
      }

      const full = buildNode(document.body) || {
        role: 'generic',
        inView: false,
        coords: { x: 0, y: 0, w: 0, h: 0 },
        children: [],
      };

      // SPLIT THE WALK. See docs/rules/05-worker-and-browser-pipeline.md §4a
      // (amended 2026-09-07) and a11y-scope.ts for the invariant this proves:
      // every node ends up counted exactly once, in root or in outline.
      const scopeToViewport = (${SCOPE_TO_VIEWPORT_SOURCE});
      const scoped = scopeToViewport(full);

      return {
        root: scoped.root,
        outline: scoped.outline,
        truncated: nodeCount >= maxNodes,
        nodeCount: scoped.viewportCount,
        more: scoped.outline
          ? scoped.outline.nodeCount + ' more elements below the fold — headings and landmarks are listed in outline; call get_tree for the rest.'
          : undefined,
      };
    })()
  `;

  return page.evaluate<A11yTree>(expression);
}
