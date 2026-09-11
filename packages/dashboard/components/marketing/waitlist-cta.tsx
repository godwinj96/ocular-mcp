'use client';

import { useState } from 'react';
import {
  useWaitlistMode,
  CHECKOUT_PATH,
  WAITLIST_SUBMIT_PATH,
} from '../../hooks/marketing/use-waitlist-mode';

// The pricing section's own CTA: the one place on the site with room for an
// actual inline signup form, so it's the canonical waitlist entry point —
// see hero.tsx, nav.tsx, cta-footer.tsx, which link HERE (#pricing) instead
// of duplicating this form when waitlist mode is on.
type Phase = 'loading' | 'checkout' | 'waitlist-form' | 'waitlist-submitting' | 'waitlist-done';

export function WaitlistCta() {
  const waitlistMode = useWaitlistMode();
  const [submitted, setSubmitted] = useState(false);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const phase: Phase = submitted
    ? 'waitlist-done'
    : submitting
      ? 'waitlist-submitting'
      : waitlistMode === null
        ? 'loading'
        : waitlistMode
          ? 'waitlist-form'
          : 'checkout';

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(WAITLIST_SUBMIT_PATH, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('request failed');
      setSubmitted(true);
    } catch {
      setError("Couldn't join the waitlist — try again in a moment.");
    } finally {
      setSubmitting(false);
    }
  }

  const ctaClass =
    'inline-flex h-[42px] items-center rounded-full bg-accent px-[22px] font-brand text-[13.5px] font-semibold tracking-normal text-surface-base transition-[background-color,transform] duration-fast hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active disabled:cursor-not-allowed disabled:bg-rule-mark disabled:text-text-inactive';

  // Reserve the CTA's footprint during the flag check so the section
  // doesn't visibly jump once it resolves -- "Choose a plan" and the
  // email-input-plus-button form are different widths.
  if (phase === 'loading') {
    return <div aria-hidden className="h-[42px]" />;
  }

  if (phase === 'checkout') {
    return (
      <a href={CHECKOUT_PATH} className={ctaClass}>
        Choose a plan
      </a>
    );
  }

  if (phase === 'waitlist-done') {
    return (
      <p className="font-mono text-[13.5px] text-text-secondary">
        You&rsquo;re on the list — we&rsquo;ll email you when the open web is live.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-wrap items-center gap-3">
      <label htmlFor="waitlist-email" className="sr-only">
        Email
      </label>
      <input
        id="waitlist-email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        disabled={phase === 'waitlist-submitting'}
        className="h-[42px] w-full max-w-[280px] rounded-full border border-rule-mark bg-surface-elevated px-4 font-mono text-[13.5px] text-text-primary placeholder:text-text-quaternary"
      />
      <button type="submit" disabled={phase === 'waitlist-submitting'} className={ctaClass}>
        {phase === 'waitlist-submitting' ? 'Joining…' : 'Join the waitlist'}
      </button>
      {error && <p className="w-full font-mono text-[12px] text-fault">{error}</p>}
    </form>
  );
}
