'use client';

import { useEffect, useState } from 'react';

// A copyable block: the MCP config on first run, and the one-time API key.
//
// The payload renders in --text-primary, NOT in the signal. The old key form
// coloured the secret with `text-accent-glow`, which is wrong twice over: the
// token no longer exists, and --signal means "the instrument is live", which a
// string of characters is not. Urgency belongs in the label and in the
// containing panel's caution rule -- colouring the payload itself just makes it
// harder to read the thing you are being told to copy carefully.

interface CodeBlockProps {
  code: string;
  /** Announced to screen readers on copy; also the button's accessible name. */
  label?: string;
}

export function CodeBlock({ code, label = 'Copy' }: CodeBlockProps) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const id = setTimeout(() => setCopied(false), 2000);
    return () => clearTimeout(id);
  }, [copied]);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
    } catch {
      // Clipboard access can be denied outright (permissions policy, insecure
      // context). Selecting the text by hand still works, so failing silently
      // here would only be wrong if it hid a recovery path -- it doesn't.
      setCopied(false);
    }
  };

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded border border-rule-mark bg-surface-raised p-4 font-mono text-[13px] leading-[1.7] text-text-primary">
        <code className="whitespace-pre-wrap break-all">{code}</code>
      </pre>
      <button
        type="button"
        onClick={onCopy}
        aria-label={label}
        className="absolute right-3 top-3 rounded-full border border-rule-mark bg-surface-raised px-3 py-1 font-mono text-[11px] tracking-[0.02em] text-text-quaternary transition-colors duration-fast ease-base hover:text-text-primary"
      >
        {copied ? 'copied' : 'copy'}
      </button>
    </div>
  );
}
