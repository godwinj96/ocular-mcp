import type { ReactNode } from 'react';

// The in-concept replacement for the tinted alert card.
//
// Linear, Stripe and Geist all ship tinted status blocks -- a red-washed error
// card, a green-washed success banner -- and they are the obvious thing to
// copy. A tint is a HUE SHIFT applied to a surface, and this system's whole
// premise is value-shift depth with no decoration, so a tinted panel would be
// the single loudest violation available.
//
// A 2px rule in the lamp colour carries exactly the same information using the
// system that already does all the structural work here. No fill, no tint, no
// radius on the marked edge.
//
// It also replaces the dashed box the billing page used for its unavailable
// state -- `border-dashed` is the one border style that appears nowhere else in
// the product.

type NoticeTone = 'fault' | 'caution' | 'signal' | 'neutral';

const TONE: Record<NoticeTone, { rule: string; eyebrow: string }> = {
  fault: { rule: 'border-l-fault', eyebrow: 'text-fault' },
  caution: { rule: 'border-l-caution', eyebrow: 'text-caution' },
  signal: { rule: 'border-l-signal', eyebrow: 'text-signal' },
  neutral: { rule: 'border-l-rule-mark', eyebrow: 'text-text-quaternary' },
};

interface NoticeProps {
  tone?: NoticeTone;
  title: string;
  children?: ReactNode;
  /** One action at most. A notice with two actions is a dialog in disguise. */
  action?: ReactNode;
}

export function Notice({ tone = 'neutral', title, children, action }: NoticeProps) {
  const t = TONE[tone];

  return (
    <div className={`border-l-2 py-3 pl-4 ${t.rule}`} role={tone === 'fault' ? 'alert' : undefined}>
      <p className={`font-mono text-[11px] uppercase tracking-[0.16em] ${t.eyebrow}`}>{title}</p>
      {children && (
        <div className="mt-stack-1 max-w-[64ch] text-[15px] leading-[1.6] text-text-secondary">
          {children}
        </div>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}
