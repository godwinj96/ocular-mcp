import Link from 'next/link';
import type { ComponentProps, ReactNode } from 'react';

// Three levels and no more. One primary per page, maximum -- two filled
// buttons on one screen is two pages arguing about which one you are on.
//
// The primary is the website nav's CTA, verbatim, including the 1px lift on
// hover. It transitions background-color between three EXPLICIT ladder rungs
// rather than using `brightness-110`, which is what the dashboard did before:
// a CSS filter on a token colour produces a value that is not in the ladder,
// which is precisely what a closed ladder exists to prevent.
//
// Disabled is a token colour, not `opacity-50`, for the same reason -- opacity
// over a token yields an off-ladder value, and a disabled control is exactly
// where you want the system to be legible.

const BASE =
  'inline-flex h-9 items-center justify-center rounded-full px-4 font-brand text-[13px] font-semibold transition-[background-color,color,border-color,transform] duration-150 ease-base disabled:cursor-not-allowed';

const PRIMARY = `${BASE} bg-accent text-surface-base hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active disabled:bg-rule-mark disabled:text-text-inactive disabled:translate-y-0`;

const SECONDARY = `${BASE} border border-rule-mark bg-transparent text-text-primary hover:border-accent hover:text-accent disabled:border-rule-divider disabled:text-text-inactive`;

const QUIET =
  'font-mono text-[12px] underline decoration-rule-mark underline-offset-4 transition-colors duration-fast ease-base disabled:cursor-not-allowed disabled:text-text-inactive';

const QUIET_DEFAULT = `${QUIET} text-text-secondary hover:text-text-primary hover:decoration-accent`;

// Destructive is the quiet level in --fault, never a filled red button. A
// filled destructive control competes with the page's one primary action, and
// Revoke should never be the loudest thing on a screen.
const QUIET_FAULT = `${QUIET} text-fault hover:decoration-fault`;

type Variant = 'primary' | 'secondary' | 'quiet' | 'destructive';

const VARIANT: Record<Variant, string> = {
  primary: PRIMARY,
  secondary: SECONDARY,
  quiet: QUIET_DEFAULT,
  destructive: QUIET_FAULT,
};

interface ButtonProps extends Omit<ComponentProps<'button'>, 'className'> {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

export function Button({ variant = 'secondary', className = '', ...rest }: ButtonProps) {
  return <button {...rest} className={`${VARIANT[variant]} ${className}`} />;
}

interface ButtonLinkProps extends Omit<ComponentProps<typeof Link>, 'className'> {
  variant?: Variant;
  className?: string;
  children: ReactNode;
}

export function ButtonLink({ variant = 'secondary', className = '', ...rest }: ButtonLinkProps) {
  return <Link {...rest} className={`${VARIANT[variant]} ${className}`} />;
}
