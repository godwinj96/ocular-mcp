import { describe, expect, it } from 'vitest';
import type { A11yNode } from '@ocular/shared';
import { scopeToViewport } from './a11y-scope.js';

function node(partial: Partial<A11yNode> & { role: string }): A11yNode {
  return {
    name: undefined,
    inView: false,
    coords: { x: 0, y: 0, w: 10, h: 10 },
    children: [],
    ...partial,
  };
}

/** Total node count of the UNPRUNED tree — the ground truth the invariant checks against. */
function countAll(n: A11yNode): number {
  let total = 1;
  for (const child of n.children) total += countAll(child);
  return total;
}

// A tree with a mix of in-view and below-fold subtrees, several levels deep,
// so the recursive scope()/summarise() split has real structure to work on.
function sampleTree(): A11yNode {
  return node({
    role: 'generic',
    inView: true,
    children: [
      node({ role: 'heading', name: 'Welcome', inView: true }),
      node({
        role: 'main',
        inView: true,
        children: [node({ role: 'button', name: 'Sign up', inView: true })],
      }),
      // Below the fold entirely -- inView: false all the way down.
      node({
        role: 'navigation',
        inView: false,
        coords: { x: 0, y: 900, w: 10, h: 10 },
        children: [
          node({
            role: 'heading',
            name: 'More',
            inView: false,
            coords: { x: 0, y: 920, w: 10, h: 10 },
          }),
          node({
            role: 'listitem',
            inView: false,
            coords: { x: 0, y: 950, w: 10, h: 10 },
            children: [
              node({
                role: 'link',
                name: 'Docs',
                inView: false,
                coords: { x: 0, y: 950, w: 10, h: 10 },
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

describe('scopeToViewport — the safety invariant', () => {
  it('accounts for every node exactly once: viewportCount + outline.nodeCount === total nodes in the unpruned tree', () => {
    const full = sampleTree();
    const total = countAll(full);

    const scoped = scopeToViewport(full);

    const accountedFor = scoped.viewportCount + (scoped.outline?.nodeCount ?? 0);
    expect(accountedFor).toBe(total);
  });

  it('holds when nothing is below the fold: outline is absent, not zeroed-and-hidden', () => {
    const full = node({
      role: 'generic',
      inView: true,
      children: [node({ role: 'heading', name: 'Only heading', inView: true })],
    });

    const scoped = scopeToViewport(full);

    expect(scoped.outline).toBeUndefined();
    expect(scoped.viewportCount).toBe(countAll(full));
  });

  it('holds when the ENTIRE tree is below the fold: root is just the (invisible) document root, outline carries everything else', () => {
    const full = node({
      role: 'generic',
      inView: false,
      children: [
        node({ role: 'heading', name: 'Buried', inView: false }),
        node({
          role: 'main',
          inView: false,
          children: [node({ role: 'button', name: 'Go', inView: false })],
        }),
      ],
    });

    const scoped = scopeToViewport(full);

    expect(scoped.root.children).toHaveLength(0);
    expect(scoped.outline?.nodeCount).toBe(countAll(full) - 1);
  });

  it('holds on a wide, shallow tree (many below-fold siblings, not nested)', () => {
    const full = node({
      role: 'generic',
      inView: true,
      children: Array.from({ length: 50 }, (_, i) =>
        node({ role: 'listitem', inView: false, coords: { x: 0, y: 1000 + i, w: 10, h: 10 } }),
      ),
    });

    const scoped = scopeToViewport(full);

    expect(scoped.viewportCount + (scoped.outline?.nodeCount ?? 0)).toBe(countAll(full));
  });

  it('keeps a below-fold ancestor whose descendant IS in view — an ancestor is never dropped out from under a visible child', () => {
    const full = node({
      role: 'generic',
      inView: true,
      children: [
        node({
          role: 'generic',
          inView: false, // the wrapper itself is off-screen...
          coords: { x: 0, y: -50, w: 10, h: 200 }, // ...but tall enough that a child pokes into view
          children: [
            node({
              role: 'button',
              name: 'Reachable',
              inView: true,
              coords: { x: 0, y: 0, w: 10, h: 10 },
            }),
          ],
        }),
      ],
    });

    const scoped = scopeToViewport(full);

    // The wrapper survives in root (not summarised away), because dropping it
    // would reparent its visible child and corrupt the nesting.
    expect(scoped.root.children).toHaveLength(1);
    expect(scoped.root.children[0]!.children[0]!.name).toBe('Reachable');
    expect(scoped.outline).toBeUndefined();
  });
});

describe('scopeToViewport — outline content', () => {
  it('lists below-fold headings individually, with name and y', () => {
    const full = sampleTree();
    const scoped = scopeToViewport(full);

    expect(scoped.outline?.headings).toEqual([{ role: 'heading', name: 'More', y: 920 }]);
  });

  it('lists below-fold landmarks individually', () => {
    const full = sampleTree();
    const scoped = scopeToViewport(full);

    expect(scoped.outline?.landmarks).toEqual([{ role: 'navigation', name: undefined, y: 900 }]);
  });

  it('tallies everything else below the fold by role, without per-node detail', () => {
    const full = sampleTree();
    const scoped = scopeToViewport(full);

    // 'listitem' and 'link' are neither headings nor landmarks -- counted, not detailed.
    expect(scoped.outline?.countsByRole).toEqual({ listitem: 1, link: 1 });
  });

  it('never emits a heading in the outline that has no name (unidentifiable to a reader)', () => {
    const full = node({
      role: 'generic',
      inView: true,
      children: [
        node({
          role: 'heading',
          name: undefined,
          inView: false,
          coords: { x: 0, y: 900, w: 10, h: 10 },
        }),
      ],
    });

    const scoped = scopeToViewport(full);

    expect(scoped.outline?.headings).toEqual([]);
    expect(scoped.outline?.countsByRole).toEqual({ heading: 1 });
  });
});

describe("scopeToViewport — .toString() portability (see this module's header)", () => {
  it('has no free variables — its source, reconstituted with `new Function`, still runs correctly', () => {
    // This is the actual mechanism a11y-tree.ts relies on: splicing
    // scopeToViewport.toString() into a string sent to an isolated browser
    // context. If the function referenced anything outside its own body
    // (an import, a module-scope const), this would throw a ReferenceError
    // there long before a real browser ever saw it -- this test catches that
    // class of bug without needing a browser at all.

    const reconstituted = new Function(
      `return (${scopeToViewport.toString()})`,
    )() as typeof scopeToViewport;

    const full = sampleTree();
    expect(reconstituted(full)).toEqual(scopeToViewport(full));
  });
});
