import type { ReactNode } from 'react';

// Depth via line art, not cards — per the "Instrument" concept (research &
// planning/moodboards/2026-09-02-ocular-visual-identity.html): "gradient-
// border/hover-glow bento cards → borderless hairline-column layout for
// feature rows (cards reserved only where containment is functional, e.g.
// pricing)." Wrap rows in a `divide-y divide-rule-divider` container; each row
// stays border-free itself so the divider never doubles up against
// ScrollReveal's own wrapper div.
interface HairlineRowProps {
  leading: ReactNode;
  title: string;
  children: ReactNode;
}

export function HairlineRow({ leading, title, children }: HairlineRowProps) {
  return (
    <div className="grid grid-cols-[28px_1fr] items-start gap-4 py-5 first:pt-0 last:pb-0 md:grid-cols-[32px_1fr]">
      <div className="pt-0.5 text-text-secondary">{leading}</div>
      <div className="min-w-0">
        <h3 className="text-base font-semibold text-text-primary">{title}</h3>
        <div className="mt-1.5 max-w-measure text-text-secondary">{children}</div>
      </div>
    </div>
  );
}
