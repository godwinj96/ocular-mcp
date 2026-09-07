'use client';

import { useState } from 'react';
import { generateKeyAction } from './actions';
import { Button } from '../../components/ui/button';
import { CodeBlock } from '../../components/ui/code-block';
import { Panel } from '../../components/ui/panel';

// COLLAPSED BY DEFAULT. The old form kept an input and a button permanently on
// the page, which is confusing with zero keys ("am I supposed to make one?")
// and competes with the table when there are some. A single secondary button
// that opens the form says the right thing in both states.
//
// THE FAILURE PATH IS NEW. The old handler was try/finally with no catch, so a
// failed generate silently did nothing at all -- the spinner stopped and the
// page sat there. A user cannot distinguish that from "the button is broken".
export function GenerateKeyForm() {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [rawKey, setRawKey] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    setPending(true);
    setError(null);
    try {
      const { rawKey: newKey } = await generateKeyAction(label.trim() || null);
      setRawKey(newKey);
      setLabel('');
      setOpen(false);
    } catch {
      setError("That didn't work. Nothing was created — try again.");
    } finally {
      setPending(false);
    }
  }

  if (rawKey) {
    return (
      // The caution rule carries the urgency. The key itself renders in
      // --text-primary, not in a signal colour: --signal means "the instrument
      // is live", which a string of characters is not, and colouring the
      // payload makes the thing you were told to copy carefully harder to read.
      <Panel accent="caution">
        <p className="text-[15px] font-medium text-text-primary">Copy this key now.</p>
        <p className="mt-stack-1 max-w-[60ch] text-[15px] text-text-secondary">
          It won&apos;t be shown again. If you lose it, revoke it and make a new one.
        </p>
        <div className="mt-stack-2">
          <CodeBlock code={rawKey} label="Copy API key" />
        </div>
        <div className="mt-stack-2">
          <Button variant="quiet" onClick={() => setRawKey(null)}>
            Done
          </Button>
        </div>
      </Panel>
    );
  }

  if (!open) {
    return (
      <div>
        <Button variant="secondary" onClick={() => setOpen(true)}>
          New key
        </Button>
        {error && <p className="mt-stack-1 font-mono text-[11.5px] text-fault">{error}</p>}
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="key-label"
        className="block font-mono text-[11px] uppercase tracking-[0.16em] text-text-quaternary"
      >
        Label (optional)
      </label>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        <input
          id="key-label"
          type="text"
          value={label}
          onChange={(event) => setLabel(event.target.value)}
          placeholder="CI pipeline"
          className="h-9 w-full max-w-[320px] rounded border border-rule-mark bg-surface-elevated px-3 text-[13px] text-text-primary placeholder:text-text-quaternary"
        />
        <Button variant="primary" onClick={handleGenerate} disabled={pending}>
          {pending ? 'Generating…' : 'Generate'}
        </Button>
        <Button variant="quiet" onClick={() => setOpen(false)} disabled={pending}>
          Cancel
        </Button>
      </div>
      {error && <p className="mt-stack-1 font-mono text-[11.5px] text-fault">{error}</p>}
    </div>
  );
}
