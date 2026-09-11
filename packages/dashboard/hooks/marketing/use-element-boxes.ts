'use client';

import { useEffect, useState, type RefObject } from 'react';

export interface ElementBox {
  /** Percentages of the frame, so the overlay scales with the specimen. */
  x: number;
  y: number;
  w: number;
  h: number;
  /** The role label drawn on the box — what the a11y tree would call it. */
  tag: string;
}

/**
 * Measures every meaningful element inside a specimen frame and returns their
 * boxes as percentages of that frame.
 *
 * Why measured and not hand-listed. The hero previously drew three boxes from
 * a literal array of coordinates. Two problems: three boxes understate what
 * the product does — it reads the whole tree, not a highlight reel — and a
 * hand-written coordinate is a claim nothing checks, so the moment anyone
 * edits the specimen the overlay quietly starts pointing at empty space. Both
 * disappear if the boxes come from the same DOM the picture is rendered from:
 * the overlay cannot drift, and "every element" is free rather than fifty
 * lines of transcription.
 *
 * This is also the honest version of the claim the section makes. The boxes
 * are derived from real layout geometry, exactly as the real a11y-tree
 * coordinates are.
 */

// GROUPING, not exhaustive outlining.
//
// The founder's correction, after a pass that boxed every text-bearing
// element: "it's not about bounding every single thing, it's about showing
// everything on the page was recognized." A box per span produced ~120
// overlapping rectangles and a wall of labels reading "text" — which
// demonstrates thoroughness and communicates nothing.
//
// So the unit is a TEXT BLOCK. Two steps:
//
//   1. Find the innermost block-level elements that contain text — one per
//      visual line or field, never a wrapper whose text lives in children.
//   2. Collapse siblings: where a parent holds two or more of those, the
//      PARENT is the box. A heading and its field become one group; an item
//      name, its variant and its price become one row.
//
// The result is the page's actual structure, which is what "recognised the
// page" looks like, at a density a person can read.
const WORD = /[\p{L}\p{N}]/u;

const REPLACED = new Set(['CANVAS', 'IMG', 'INPUT', 'SVG', 'VIDEO', 'TEXTAREA', 'SELECT']);

// Inline elements are parts of a line, not blocks of their own.
const INLINE_DISPLAY = new Set(['inline', 'contents', 'none']);

function isBlockLike(el: Element): boolean {
  const d = getComputedStyle(el).display;
  return !INLINE_DISPLAY.has(d);
}

function hasText(el: Element): boolean {
  return WORD.test(el.textContent ?? '');
}

/** A block that contains text but no smaller block that does — one line/field. */
function isInnermostTextBlock(el: Element): boolean {
  if (REPLACED.has(el.tagName)) return true;
  if (!isBlockLike(el) || !hasText(el)) return false;
  for (const child of Array.from(el.children)) {
    if (REPLACED.has(child.tagName)) return false;
    if (isBlockLike(child) && hasText(child)) return false;
  }
  return true;
}

const ROLE_BY_TAG: Record<string, string> = {
  H1: 'h1',
  H2: 'h2',
  H3: 'h3',
  H4: 'h4',
  A: 'link',
  BUTTON: 'button',
  INPUT: 'input',
  TEXTAREA: 'input',
  SELECT: 'input',
  CANVAS: 'canvas',
  IMG: 'img',
  SVG: 'img',
  LI: 'listitem',
  TR: 'row',
  TABLE: 'table',
  NAV: 'nav',
  HEADER: 'banner',
  FOOTER: 'contentinfo',
  FORM: 'form',
  SECTION: 'group',
  ARTICLE: 'group',
  ASIDE: 'group',
  UL: 'list',
  OL: 'list',
  P: 'text',
};

function roleOf(el: Element, grouped: boolean): string {
  const explicit = el.getAttribute('role');
  if (explicit) return explicit;
  const mapped = ROLE_BY_TAG[el.tagName];
  if (mapped) return mapped;
  return grouped ? 'group' : 'text';
}

/** Below this, a box is smaller than its own 1px stroke is thick. */
const MIN_SIDE_PX = 10;
/** And below this share of the frame it cannot hold a legible label. */
const MIN_SIDE_PCT = 0.9;
/**
 * A ceiling on boxes. Raised from 44 once every box carried a label: the
 * founder's note was that the sweep has to land on EVERYTHING, and a cap that
 * quietly drops the tail makes the demo claim more than it shows. This is a
 * bound against pathological pages, not a design choice.
 */
const MAX_BOXES = 160;

export function useElementBoxes<T extends HTMLElement>(
  frameRef: RefObject<T>,
  /** Bump to force a re-measure after content changes. */
  deps: unknown[] = [],
): ElementBox[] {
  const [boxes, setBoxes] = useState<ElementBox[]>([]);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const measure = () => {
      const frameRect = frame.getBoundingClientRect();
      if (frameRect.width < 1 || frameRect.height < 1) return;

      // Step 1 — innermost text blocks.
      const leaves: HTMLElement[] = [];
      for (const el of Array.from(frame.querySelectorAll<HTMLElement>('*'))) {
        if (isInnermostTextBlock(el)) leaves.push(el);
      }

      // Step 2 — collapse to the parent wherever a parent holds several.
      const leafCountByParent = new Map<Element, number>();
      for (const leaf of leaves) {
        const parent = leaf.parentElement;
        if (parent) leafCountByParent.set(parent, (leafCountByParent.get(parent) ?? 0) + 1);
      }

      // ...but ONLY when the parent is a tight cluster of leaves and nothing
      // else. This guard is the fix for the founder's round-7 note that the
      // second demo's "bounding boxes aren't complete."
      //
      // They were all being drawn; the problem was that they had been
      // collapsed into one. The Tessera specimen's `.spec-b-body` holds an h1,
      // a sub-line, two h2s and a canvas as direct children — five leaves — so
      // the "parent holds several" rule promoted the WHOLE BODY to a single
      // box and every heading inside it vanished. The demo drew a rectangle
      // round the entire page and called it a reading.
      //
      // A parent should only stand in for its children when it has no other
      // structure of its own. `.spec-b-kpi` (three spans, nothing else) is a
      // real group and collapsing it is right. `.spec-b-body` also contains a
      // KPI grid and a table, so it is a SECTION, and a section is not a
      // group — its children are separate things that were each recognised.
      //
      // Measured on both specimens: Tessera goes 7 -> 10 boxes and gains the
      // h1, the h2 and the canvas it had been swallowing; Northsound goes
      // 20 -> 25 and its labels sharpen from a run of "group" into h1, h2,
      // button and text. The hero was quietly losing structure to the same
      // fault — it just had enough boxes left that nobody noticed.
      const leafSet = new Set<Element>(leaves);
      const isLeafCluster = (parent: Element) =>
        Array.from(parent.children).every((child) => leafSet.has(child));

      const targets = new Map<Element, boolean>();
      for (const leaf of leaves) {
        const parent = leaf.parentElement;
        if (
          parent &&
          (leafCountByParent.get(parent) ?? 0) > 1 &&
          frame.contains(parent) &&
          isLeafCluster(parent)
        ) {
          targets.set(parent, true);
        } else {
          targets.set(leaf, false);
        }
      }

      const found: ElementBox[] = [];
      const seen = new Set<string>();

      for (const [el, grouped] of targets) {
        const r = el.getBoundingClientRect();
        if (r.width < MIN_SIDE_PX || r.height < MIN_SIDE_PX) continue;

        // The specimen is cropped by the frame; a box for something below the
        // fold would float outside the picture with nothing under it.
        if (r.bottom <= frameRect.top || r.top >= frameRect.bottom) continue;
        if (r.right <= frameRect.left || r.left >= frameRect.right) continue;

        const x = ((r.left - frameRect.left) / frameRect.width) * 100;
        const y = ((r.top - frameRect.top) / frameRect.height) * 100;
        const w = (r.width / frameRect.width) * 100;
        const h = (r.height / frameRect.height) * 100;
        if (w < MIN_SIDE_PCT || h < MIN_SIDE_PCT) continue;

        // A group that lands on the same rect as one of its children would
        // stack two strokes and read as one heavier box.
        const key = `${x.toFixed(1)}:${y.toFixed(1)}:${w.toFixed(1)}:${h.toFixed(1)}`;
        if (seen.has(key)) continue;
        seen.add(key);

        found.push({ x, y, w, h, tag: roleOf(el, grouped) });
      }

      // Sort by bottom edge: the sweep acquires in the order the scan line
      // reaches things, so this is also the acquisition order.
      found.sort((a, b) => a.y + a.h - (b.y + b.h));
      setBoxes(found.slice(0, MAX_BOXES));
    };

    measure();

    // The specimen is fitted by a scale transform that settles a frame after
    // mount, and re-fits on resize — measuring once would capture the
    // pre-fit geometry.
    const ro = new ResizeObserver(measure);
    ro.observe(frame);
    const raf = requestAnimationFrame(measure);

    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
    // The `...deps` spread below is a variable-length dependency array, which
    // react-hooks/exhaustive-deps genuinely cannot verify statically — the
    // warning is correct, not a false positive, and the caller owns getting
    // `deps` right. Suppressed deliberately.
    //
    // (Session 31 had to downgrade this to a plain comment because
    // eslint-plugin-react-hooks was not installed, so the directive named an
    // unresolvable rule and failed the whole lint run. The plugin is wired up
    // now, so the directive works again.)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameRef, ...deps]);

  return boxes;
}
