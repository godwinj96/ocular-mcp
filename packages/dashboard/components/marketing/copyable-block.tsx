'use client';

import { useState } from 'react';

// Lifted out of setup-page.tsx, where it was a local function component, for
// one structural reason: it needs useState, and a page that exports `metadata`
// cannot be a client component. Splitting the interactive part out keeps the
// page itself a Server Component so its metadata (and its static HTML) works.
//
// NOT components/ui/code-block.tsx, which does the same job for the
// authenticated app. The two are visibly different -- that one is
// border-rule-mark / bg-surface-raised / p-4 with no overflow rule, this one
// is border-rule-divider / bg-surface-elevated / p-5 with overflow-x-auto --
// and the marketing site's appearance is the thing being preserved here, so
// swapping in the app's version would have been a silent restyle. Worth
// consolidating deliberately one day; not worth doing accidentally during a
// migration whose whole promise is that nothing looks different.
export function CopyableBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded border border-rule-divider bg-surface-elevated p-5 font-mono text-[13px] leading-[1.7] text-text-primary">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={`Copy ${label}`}
        className="absolute right-3 top-3 rounded-full border border-rule-mark px-3 py-1 font-mono text-[11px] tracking-[0.02em] text-text-quaternary transition-colors duration-fast hover:text-text-primary"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}
