import type { ReactNode } from 'react';

// Stat and key/value strip -- the two shapes that replace "card".
//
// A stat sits DIRECTLY ON the ground: no border, no background, no box. That is
// the whole fix for "3 cards floating in darkness". The old root wrapped every
// destination in `rounded-xl border bg-surface-elevated p-5`, which is what you
// do when you have no navigation and need each link to look clickable. With a
// bar in place, boxing a number adds nothing and costs the page its calm.
//
// Separation between stats is a 1px --rule-divider gutter, not a gap between
// cards.

interface StatProps {
  label: string;
  value: ReactNode;
  /** One line under the number. Keep it a fact, not a caption. */
  detail?: ReactNode;
  /** Threshold state -- see the rail for where the breakpoints come from. */
  tone?: 'default' | 'caution' | 'fault';
}

const VALUE_TONE = {
  default: 'text-text-primary',
  caution: 'text-caution',
  fault: 'text-fault',
} as const;

export function Stat({ label, value, detail, tone = 'default' }: StatProps) {
  return (
    <div>
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-quaternary">
        {label}
      </p>
      <p
        className={`mt-stack-1 font-mono text-[40px] font-medium leading-none tracking-[-0.02em] tabular ${VALUE_TONE[tone]}`}
      >
        {value}
      </p>
      {detail && (
        <p className="mt-stack-1 font-mono text-[11.5px] tracking-[0.02em] text-text-tertiary">
          {detail}
        </p>
      )}
    </div>
  );
}

export function StatRow({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start gap-x-8 gap-y-6 [&>*+*]:border-l [&>*+*]:border-rule-divider [&>*+*]:pl-8">
      {children}
    </div>
  );
}

interface KeyValuesProps {
  rows: ReadonlyArray<{ key: string; value: ReactNode }>;
  className?: string;
}

// The mono key/value strip the setup page already uses. Label left in
// --text-secondary, value right in --text-tertiary, one --rule-divider between
// rows. Deliberately narrow: it is reference detail, not the page's subject.
export function KeyValues({ rows, className = '' }: KeyValuesProps) {
  return (
    <dl className={`divide-y divide-rule-divider border-y border-rule-divider ${className}`}>
      {rows.map((row) => (
        <div key={row.key} className="flex items-baseline justify-between gap-6 py-2.5">
          <dt className="font-mono text-[12.5px] text-text-secondary">{row.key}</dt>
          <dd className="font-mono text-[12.5px] text-text-tertiary tabular">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
