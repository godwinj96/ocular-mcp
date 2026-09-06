import { useEffect, useState, type RefObject } from 'react';

export interface TreeRow {
  indent: 0 | 1;
  role: string;
  name: string;
  /** "56,124   215×54" — design-space pixels, formatted as the tool reports them. */
  coords: string;
  /** Design-space top edge. Kept numeric so consumers can time a row against
   *  the overlay's scan line instead of re-parsing it back out of `coords`. */
  y: number;
  position: 'in-view' | 'below-fold';
}

/**
 * Reads the tree rows out of the specimen's own DOM.
 *
 * The rows used to be a literal array with coordinate strings typed by hand
 * from a browser session. That is a claim nothing checks: the numbers were
 * correct on the day they were measured and silently became fiction the
 * moment anyone moved an element. It also made swapping the specimen
 * expensive, which is the reason two sections were sharing one page.
 *
 * Elements opt in with `data-tree-role` / `data-tree-name` in the specimen.
 * Everything else — position, size, and whether a row is in view or past the
 * fold — is measured, so the readout cannot disagree with the picture beside
 * it.
 *
 * Coordinates are reported in the specimen's DESIGN space (the notional
 * 1440x900 it is authored at), not in scaled screen pixels, because that is
 * what a capture of that page would actually return.
 */

/** The notional viewport a specimen is authored at — mirrors SpecimenFrame. */
const DESIGN_WIDTH = 1440;
/** The 16/10 frame crops here; below it, the picture stops and the tree doesn't.
 *  Exported so a consumer can time a row against the frame the picture shows. */
export const FOLD_Y = 900;

export function useTreeRows<T extends HTMLElement>(
  rootRef: RefObject<T>,
  deps: unknown[] = [],
): TreeRow[] {
  const [rows, setRows] = useState<TreeRow[]>([]);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;

    const measure = () => {
      const specimen = root.querySelector<HTMLElement>('.specimen');
      if (!specimen) return;

      const specRect = specimen.getBoundingClientRect();
      if (specRect.width < 1) return;
      // The specimen is laid out at DESIGN_WIDTH and scaled by a transform, so
      // dividing measured pixels by this recovers the authored coordinates.
      const scale = specRect.width / DESIGN_WIDTH;
      if (scale <= 0) return;

      const found: TreeRow[] = [];
      for (const el of Array.from(specimen.querySelectorAll<HTMLElement>('[data-tree-role]'))) {
        const r = el.getBoundingClientRect();
        const x = Math.round((r.left - specRect.left) / scale);
        const y = Math.round((r.top - specRect.top) / scale);
        const w = Math.round(r.width / scale);
        const h = Math.round(r.height / scale);

        found.push({
          indent: el.dataset.treeIndent === '0' ? 0 : 1,
          role: el.dataset.treeRole ?? '',
          name: el.dataset.treeName ?? '',
          coords: `${x},${y}`.padEnd(9, ' ') + `${w}×${h}`,
          y,
          position: y >= FOLD_Y ? 'below-fold' : 'in-view',
        });
      }

      // Top-down, which is also the order the overlay's scan line reaches
      // them. Previously this sorted by parsing the y back out of the
      // formatted `coords` string — which broke silently the moment the
      // padding made "56,124  " split differently than expected.
      found.sort((a, b) => a.y - b.y);
      setRows(found);
    };

    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(root);
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
  }, [rootRef, ...deps]);

  return rows;
}
