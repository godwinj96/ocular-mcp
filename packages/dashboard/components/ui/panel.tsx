import type { ReactNode } from 'react';

// A bounded object on the page. Frame is --rule-mark ("this thing has an
// edge"), internal dividers are --rule-divider ("rows of one thing"), and the
// two are never swapped -- one border colour doing both jobs is what made the
// old key list read as four boxes instead of one table.
//
// No shadow, ever. Depth in this system is a value shift and nothing else:
// base -> elevated -> raised, three rungs, and a panel that needs to feel
// deeper steps to the next rung rather than growing a shadow.

interface PanelProps {
  title?: string;
  /** Right-aligned metadata on the title row -- a count, a timestamp. */
  meta?: ReactNode;
  /** A lamp colour for the top edge; used to mark a panel that needs reading. */
  accent?: 'caution' | 'fault';
  className?: string;
  children: ReactNode;
}

const ACCENT_RULE: Record<string, string> = {
  caution: 'border-t-2 border-t-caution',
  fault: 'border-t-2 border-t-fault',
};

export function Panel({ title, meta, accent, className = '', children }: PanelProps) {
  return (
    <section
      className={`rounded border border-rule-mark bg-surface-elevated p-5 md:p-6 ${
        accent ? ACCENT_RULE[accent] : ''
      } ${className}`}
    >
      {title && (
        <header className="mb-4 flex items-baseline justify-between gap-4 border-b border-rule-divider pb-4">
          <h2 className="text-[20px] font-medium tracking-[-0.015em] text-text-primary">{title}</h2>
          {meta && <span className="font-mono text-[11px] text-text-tertiary">{meta}</span>}
        </header>
      )}
      {children}
    </section>
  );
}
