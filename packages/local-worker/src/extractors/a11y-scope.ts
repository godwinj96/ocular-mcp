// The pure half of the accessibility-tree walk: given an already-sampled,
// UNPRUNED tree, decide what ships in full (`root`) and what gets summarised
// (`outline`). See docs/rules/05-worker-and-browser-pipeline.md §4a for the
// amended rule this implements, and a11y-tree.ts for the DOM-sampling half
// this can't absorb (getBoundingClientRect etc. only exist inside a page).
//
// WHY THIS IS A SEPARATE, REAL, IMPORTABLE FILE instead of more inline code
// inside a11y-tree.ts's evaluateFn closures. The walk's safety property —
// "every element with non-zero area appears in `root` or `outline`" — used to
// rest on one manual measurement, and DOM-tree pruning bugs are exactly the
// kind that hide well: a sibling function in this same file's DOM-walk half
// (the nameless-wrapper hoisting rule in a11y-tree.ts's buildNode) silently
// deleted 154 visible nodes the first time it shipped, on this project's own
// marketing page, before anyone measured it (see DEVLOG's session-34 entry).
// A property this load-bearing needs a real test suite, and a function
// embedded in a page.evaluateFn() string cannot be `import`ed into a Vitest
// file — it only exists as text, executed inside an isolated V8 context via
// CDP.
//
// The fix is NOT a second hand-typed copy (that reintroduces exactly the
// "two copies that can silently drift" problem docs/rules/02-repo-structure.md
// §0.6 exists to rule out) — it's making the same function do both jobs.
// `evaluateFn`'s only requirement (see headless-shell.ts) is that
// `fn.toString()` produce a self-contained function body: no closures over
// outer variables, no imports. `scopeToViewport` below satisfies that by
// construction — every helper it needs is declared INSIDE it, never at this
// module's top level — so a11y-tree.ts splices `scopeToViewport.toString()`
// directly into the string it sends over CDP. The exact function this file
// tests is the exact function that runs in the browser; there is no second
// copy to drift.
import type { A11yNode, A11yOutline } from '@ocular/shared';

export interface ScopedA11yTree {
  root: A11yNode;
  outline: A11yOutline | undefined;
  /** Node count of `root` alone (the in-viewport subtree), for the caller's own truncation accounting. */
  viewportCount: number;
}

/**
 * SPLIT THE WALK. In-viewport nodes (and any ancestor of one, so nesting
 * survives) keep full detail in `root`; every subtree with nothing visible in
 * it is summarised into `outline` instead of shipped node-by-node. See this
 * file's header for why the full-detail default was unaffordable.
 *
 * The safety invariant this whole file exists to prove: every node reachable
 * from `full` ends up counted exactly once, either as a node in `root` or as
 * one of `outline.nodeCount`. Nothing is silently dropped — see
 * `a11y-scope.test.ts`.
 *
 * SELF-CONTAINED ON PURPOSE (see this file's header): every helper is a
 * nested declaration, and `LANDMARKS` is a literal inside the function body,
 * not the usual module-level export — `.toString()` on this function must
 * capture everything it needs, because the copy that runs in the browser has
 * no access to anything outside this function's own source text.
 */
export function scopeToViewport(full: A11yNode): ScopedA11yTree {
  const LANDMARKS = ['navigation', 'main', 'banner', 'contentinfo', 'form', 'table', 'list'];

  const outline = {
    nodeCount: 0,
    headings: [] as A11yOutline['headings'],
    landmarks: [] as A11yOutline['landmarks'],
    countsByRole: {} as Record<string, number>,
  };

  function summarise(node: A11yNode): void {
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

  function hasVisibleDescendant(node: A11yNode): boolean {
    if (node.inView) return true;
    for (const child of node.children) {
      if (hasVisibleDescendant(child)) return true;
    }
    return false;
  }

  function scope(node: A11yNode): A11yNode {
    const kept: A11yNode[] = [];
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

  function count(node: A11yNode): number {
    let total = 1;
    for (const child of node.children) total += count(child);
    return total;
  }

  return {
    root,
    outline: outline.nodeCount > 0 ? outline : undefined,
    viewportCount: count(root),
  };
}

/** Same list `scopeToViewport` uses internally — exported for tests only; the runtime copy stays inlined (see the function's own comment for why). */
export const LANDMARKS = ['navigation', 'main', 'banner', 'contentinfo', 'form', 'table', 'list'];
