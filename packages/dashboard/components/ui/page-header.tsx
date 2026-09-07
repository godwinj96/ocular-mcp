import type { ReactNode } from 'react';

// Eyebrow, title, optional deck, then the structural rule that separates the
// header from the page's content.
//
// The title is 30px against 15px body -- 2.0x, not the website's 2.6-3.1x.
// That ratio is a HERO rule (see packages/website/tailwind.config.ts) and it
// does not transfer: at 2.6x on a data page the page title out-shouts the data,
// and the data is the payload. Linear's app ladder tops out at 32px and
// Stripe's dashboard home runs six sizes total, for the same reason.
export function PageHeader({
  eyebrow,
  title,
  deck,
  children,
}: {
  eyebrow: string;
  title: string;
  deck?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="pb-8">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-text-quaternary">
        {eyebrow}
      </p>
      <div className="mt-stack-1 flex flex-wrap items-baseline justify-between gap-4">
        <h1 className="text-[30px] font-medium leading-[1.15] tracking-[-0.02em] text-text-primary">
          {title}
        </h1>
        {children}
      </div>
      {deck && (
        <p className="mt-stack-2 max-w-[64ch] text-[15px] leading-[1.6] text-text-secondary">
          {deck}
        </p>
      )}
      <div className="rule-hairline mt-8 border-b border-rule-structural" />
    </header>
  );
}
