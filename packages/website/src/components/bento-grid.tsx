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

// Gradient-hairline border via the mask technique: a padded gradient layer
// masked to only its edge, so the border reads as a real subtle gradient
// rather than a flat single-tone line — replaces Round 1's `border-border`.
const GRADIENT_BORDER_STYLE = {
  backgroundImage:
    'linear-gradient(var(--surface-elevated), var(--surface-elevated)), linear-gradient(135deg, rgba(255,255,255,0.14), rgba(255,255,255,0.02) 40%, rgba(124,108,255,0.18))',
  backgroundOrigin: 'border-box',
  backgroundClip: 'padding-box, border-box',
  border: '1px solid transparent',
} as const;

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
      className={`${SPAN_CLASSES[span]} group relative rounded-2xl p-6 transition-transform duration-300 hover:-translate-y-0.5 md:p-8 ${className}`}
      style={GRADIENT_BORDER_STYLE}
    >
      <div className="pointer-events-none absolute inset-0 -z-10 rounded-2xl opacity-0 shadow-[0_0_40px_rgba(124,108,255,0.15)] transition-opacity duration-300 group-hover:opacity-100" />
      {children}
    </Tag>
  );
}
