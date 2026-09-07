import type { ReactNode } from 'react';

// Rows of one thing.
//
// Three rules doing three jobs, which is the entire argument for retiring the
// single #2A2A2E border token: the header sits on --rule-structural (the
// page's spine), rows divide on --rule-divider (dark enough that twelve of
// them read as grain rather than as a ladder), and the hovered row's own
// divider steps up to --rule-mark. With one colour for all three, a five-row
// list reads as five boxes.
//
// Hover is a VALUE SHIFT to --surface-elevated -- the only depth mechanism the
// concept permits, and the reason a table needs no shadow to feel tactile.
//
// Numerics and dates are mono + tabular so digits align down the column, and
// dates render ISO rather than toLocaleDateString(): a locale-formatted date
// renders differently on the server than in the browser, which is both a
// hydration hazard and, in a sortable column, simply worse.

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

// Nouns, never sentences: "Last used", not "When it was last used".
export function Th({ children, numeric = false }: { children: ReactNode; numeric?: boolean }) {
  return (
    <th
      scope="col"
      className={`border-b border-rule-structural pb-2 font-mono text-[11px] font-medium uppercase tracking-[0.16em] text-text-tertiary ${
        numeric ? 'text-right' : ''
      }`}
    >
      {children}
    </th>
  );
}

export function Tr({ children, muted = false }: { children: ReactNode; muted?: boolean }) {
  return (
    <tr
      className={`group border-b border-rule-divider transition-colors duration-fast ease-base hover:bg-surface-elevated ${
        muted ? 'text-text-quaternary' : ''
      }`}
    >
      {children}
    </tr>
  );
}

export function Td({
  children,
  numeric = false,
  mono = false,
  className = '',
}: {
  children: ReactNode;
  numeric?: boolean;
  mono?: boolean;
  className?: string;
}) {
  return (
    <td
      className={`py-3 align-middle text-[13px] ${numeric ? 'text-right tabular' : ''} ${
        mono || numeric ? 'font-mono' : ''
      } ${className}`}
    >
      {children}
    </td>
  );
}

// Unknown and inapplicable values render as an em-dash, per Geist's table
// guidance -- never "N/A", never "null", never an empty cell that reads as a
// rendering bug. "Never used" is exactly this case.
export function Blank() {
  return (
    <span aria-label="none" className="text-text-inactive">
      —
    </span>
  );
}
