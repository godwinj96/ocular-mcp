import type { ReactNode } from 'react';

// Modular bento grid per research & planning/06-brand-identity.md §6.3 —
// Müller-Brockmann 12-column grid, stepping to 4/2 columns per breakpoint.
// Span classes are written out (not computed) so Tailwind's content scanner
// can see them statically.

interface BentoGridProps {
  children: ReactNode;
  className?: string;
}

export function BentoGrid({ children, className = '' }: BentoGridProps) {
  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 lg:grid-cols-12 gap-4 ${className}`}>
      {children}
    </div>
  );
}

interface BentoCellProps {
  children: ReactNode;
  span?: 'full' | 'hero' | 'half' | 'third' | 'quarter';
  as?: 'div' | 'article';
  surface?: 'open' | 'card';
  className?: string;
}

const SPAN_CLASSES: Record<NonNullable<BentoCellProps['span']>, string> = {
  full: 'col-span-2 md:col-span-4 lg:col-span-12',
  hero: 'col-span-2 md:col-span-4 lg:col-span-8',
  half: 'col-span-2 md:col-span-2 lg:col-span-6',
  third: 'col-span-2 md:col-span-2 lg:col-span-4',
  quarter: 'col-span-1 md:col-span-1 lg:col-span-3',
};

// Depth via value-shift only, per the "Instrument" concept (research &
// planning/moodboards/2026-09-02-ocular-visual-identity.html): a single
// hairline border, no gradient, no glow-shadow, no background fill change on
// hover beyond a one-step surface lift. Refactoring UI's "border + shadow +
// background at once" anti-pattern — Round 2's gradient-border-plus-violet-
// glow combination — is exactly what this replaces.
export function BentoCell({
  children,
  span = 'quarter',
  as: Tag = 'div',
  surface = 'card',
  className = '',
}: BentoCellProps) {
  if (surface !== 'card') {
    return <Tag className={`${SPAN_CLASSES[span]} ${className}`}>{children}</Tag>;
  }

  return (
    <Tag
      className={`${SPAN_CLASSES[span]} rounded border border-rule-structural bg-surface-elevated p-6 transition-colors duration-200 hover:bg-surface-raised md:p-8 ${className}`}
    >
      {children}
    </Tag>
  );
}
