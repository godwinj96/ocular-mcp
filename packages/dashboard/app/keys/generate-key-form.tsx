'use client';

import { useState } from 'react';
import { generateKeyAction } from './actions';

export function GenerateKeyForm() {
  const [label, setLabel] = useState('');
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleGenerate() {
    setPending(true);
    try {
      const { rawKey: newKey } = await generateKeyAction(label.trim() || null);
      setRawKey(newKey);
      setLabel('');
    } finally {
      setPending(false);
    }
  }

  if (rawKey) {
    return (
      <div className="rounded-xl border border-accent bg-surface-elevated p-5">
        <p className="text-sm font-semibold text-text-primary">Copy your key now — it won't be shown again.</p>
        <code className="mt-3 block break-all rounded-lg bg-surface-raised p-3 font-mono text-sm text-accent-glow">
          {rawKey}
        </code>
        <button
          type="button"
          onClick={() => setRawKey(null)}
          className="mt-4 text-sm text-text-secondary underline hover:text-text-primary"
        >
          Done
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <input
        type="text"
        value={label}
        onChange={(event) => setLabel(event.target.value)}
        placeholder="Optional label (e.g. 'CI pipeline')"
        className="rounded-lg border border-border bg-surface-elevated px-4 py-2 text-sm text-text-primary placeholder:text-text-secondary"
      />
      <button
        type="button"
        onClick={handleGenerate}
        disabled={pending}
        className="rounded-full bg-accent px-5 py-2 text-sm font-semibold text-surface-base transition hover:brightness-110 disabled:opacity-50"
      >
        {pending ? 'Generating…' : 'Generate new key'}
      </button>
    </div>
  );
}
