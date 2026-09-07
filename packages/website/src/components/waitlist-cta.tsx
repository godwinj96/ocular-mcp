import { useEffect, useState } from 'react';

// Swaps the pricing section's "Choose a plan" link for a waitlist signup
// form when an admin has waitlist mode on — see
// packages/dashboard/app/admin/waitlist for the toggle and
// docs/rules (Session 34 brief §2) for why: the cloud worker has no hosting
// yet, so sending someone into checkout for a plan that can't render
// anything on the open web yet would be selling something that doesn't work.
//
// THIS IS A RUNTIME CHECK, NOT A BUILD-TIME ONE, on purpose. The website is
// a static Vite SPA with no server of its own to bake a flag into at deploy
// time, and the whole point of an admin toggle is that flipping it doesn't
// require a rebuild+redeploy of a different package. So this fetches the
// dashboard's public flag endpoint on mount instead.
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:3001';

type Phase = 'loading' | 'checkout' | 'waitlist-form' | 'waitlist-submitting' | 'waitlist-done';

export function WaitlistCta() {
  const [phase, setPhase] = useState<Phase>('loading');
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`${DASHBOARD_URL}/api/public/waitlist-status`)
      .then((res) => (res.ok ? res.json() : { waitlistMode: false }))
      .then((data: { waitlistMode?: boolean }) => {
        if (!cancelled) setPhase(data.waitlistMode ? 'waitlist-form' : 'checkout');
      })
      // A failed flag check should never block the primary CTA — fail open
      // to the normal checkout path, same "advisory, not load-bearing"
      // posture the local worker's own heartbeat takes on a failed request.
      .catch(() => {
        if (!cancelled) setPhase('checkout');
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPhase('waitlist-submitting');
    try {
      const res = await fetch(`${DASHBOARD_URL}/api/public/waitlist`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      if (!res.ok) throw new Error('request failed');
      setPhase('waitlist-done');
    } catch {
      setError("Couldn't join the waitlist — try again in a moment.");
      setPhase('waitlist-form');
    }
  }

  const ctaClass =
    'inline-flex h-[42px] items-center rounded-full bg-accent px-[22px] font-brand text-[13.5px] font-semibold tracking-normal text-surface-base transition-[background-color,transform] duration-fast hover:-translate-y-px hover:bg-accent-hover active:translate-y-0 active:bg-accent-active disabled:cursor-not-allowed disabled:bg-rule-mark disabled:text-text-inactive';

  // Reserve the CTA's footprint during the flag check so the section doesn't
  // visibly jump once it resolves.
  if (phase === 'loading') {
    return <div aria-hidden className="h-[42px]" />;
  }

  if (phase === 'checkout') {
    return (
      <a href={DASHBOARD_URL} className={ctaClass}>
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
