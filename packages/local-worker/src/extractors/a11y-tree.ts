// view_page extractor — accessibility tree, local path. Same DOM-walk
// design as packages/worker/src/extractors/a11y-tree.ts (see that file's
// header comment for the native-AX-API-vs-DOM-walk trade-off rationale) —
// deliberately duplicated, not shared, same rationale as this package's
// other extractors (design-tokens.ts, assets.ts).

import type { A11yTree } from '@ocular/shared';
import type { HeadlessShellPage } from '../browser/headless-shell.js';

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
          if (!built) continue;

          // A nameless `generic` wrapper that adds NO DISTINCT GEOMETRY -- one
          // child, same box -- is hoisted. That is provably lossless: the
          // wrapper's rect is the child's rect, so nothing a reader could
          // measure disappears with it.
          //
          // Nothing stronger than this is safe, and the stronger version was
          // written first and measured before it shipped. Hoisting EVERY
          // nameless generic, and dropping nameless generic leaves, cut the
          // payload 41% -- and deleted 154 visible nodes on this project's own
          // marketing page, including the SVG paths that draw the logo. Those
          // are precisely the "drawn instead of marked up" elements Ocular
          // exists to see, and a tree that omits them is lying by omission
          // about the one thing the screenshot cannot explain.
          if (
            built.role === 'generic' &&
            !built.name &&
            built.children.length === 1 &&
            Math.abs(built.children[0]!.coords.w - built.coords.w) < 1 &&
            Math.abs(built.children[0]!.coords.h - built.coords.h) < 1
          ) {
            children.push(built.children[0]!);
          } else {
            children.push(built);
          }
        }

        const role = roleOf(el);
        const name = nameOf(el);

        // The ONLY node ever dropped: a nameless generic leaf with zero area.
        // It cannot be seen, by definition, so it cannot be the thing a reader
        // is trying to understand. Any leaf with real width and height stays,
        // however anonymous -- a coloured span, an icon, a rule, a chart bar
        // and an SVG path all arrive here nameless and roleless, and every one
        // of them is visible pixels the screenshot shows and the tree is
        // supposed to locate.
        if (
          role === 'generic' &&
          !name &&
          children.length === 0 &&
          (rect.width === 0 || rect.height === 0)
        ) {
          return null;
        }

        return {
          role,
          name,
          inView,
          // Rounded. Sub-pixel precision on a layout coordinate is noise a
          // reader cannot use and cannot verify -- "2567.896728515625" costs
          // 18 characters to say 2568. Across a thousand nodes and four
          // numbers each, the rounding alone is a large fraction of the
          // payload.
          coords: {
            x: Math.round(rect.x + window.scrollX),
            y: Math.round(rect.y + window.scrollY),
            w: Math.round(rect.width),
            h: Math.round(rect.height),
          },
          children,
        };
      }

      const full = buildNode(document.body) ?? {
        role: 'generic',
        inView: false,
        coords: { x: 0, y: 0, w: 0, h: 0 },
        children: [],
      };

      // SPLIT THE WALK. In-viewport nodes keep their full detail; everything
      // past the fold is summarised. See the amended rule in
      // @ocular/shared's a11y-tree.schema.ts for why: a full walk of a real
      // page serialises to ~107KB, which is a response the caller's transport
      // truncates -- and a tree nobody receives annotates nothing.
      //
      // A node survives into `root` if it is in view OR has a descendant in
      // view. The second half matters: dropping an out-of-view ancestor would
      // reparent its visible children and corrupt the nesting, which is the one
      // thing the tree knows that a list of boxes does not.
      const LANDMARKS = ['navigation', 'main', 'banner', 'contentinfo', 'form', 'table', 'list'];

      const outline = {
        nodeCount: 0,
        headings: [] as Array<{ role: string; name: string; y: number }>,
        landmarks: [] as Array<{ role: string; name?: string; y: number }>,
        countsByRole: {} as Record<string, number>,
      };

      function summarise(node: WalkNode): void {
        outline.nodeCount++;
        if (node.role === 'heading' && node.name) {
          outline.headings.push({ role: node.role, name: node.name, y: node.coords.y });
        } else if (LANDMARKS.indexOf(node.role) !== -1) {
          outline.landmarks.push({ role: node.role, name: node.name, y: node.coords.y });
        } else {
          outline.countsByRole[node.role] = (outline.countsByRole[node.role] ?? 0) + 1;
        }
        for (const child of node.children) summarise(child);
      }

      function hasVisibleDescendant(node: WalkNode): boolean {
        if (node.inView) return true;
        for (const child of node.children) {
          if (hasVisibleDescendant(child)) return true;
        }
        return false;
      }

      function scope(node: WalkNode): WalkNode {
        const kept: WalkNode[] = [];
        for (const child of node.children) {
          if (hasVisibleDescendant(child)) {
            kept.push(scope(child));
          } else {
            summarise(child);
          }
        }
        return { ...node, children: kept };
      }

      const root = scope(full);
      const viewportCount = (function count(node: WalkNode): number {
        let total = 1;
        for (const child of node.children) total += count(child);
        return total;
      })(root);

      return {
        root,
        outline: outline.nodeCount > 0 ? outline : undefined,
        truncated: nodeCount >= maxNodes,
        nodeCount: viewportCount,
        more:
          outline.nodeCount > 0
            ? `${outline.nodeCount} more elements below the fold — headings and landmarks are listed in outline; call get_tree for the rest.`
            : undefined,
      };
    },
    { maxNodes: MAX_A11Y_NODES },
  );
}
