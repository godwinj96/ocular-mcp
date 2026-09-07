'use client';

import { useTransition } from 'react';

// The one new control this system didn't have yet. The universal signifier
// for "toggle" is a track with a circular thumb, but lamp.tsx explicitly
// rejects circles for this product ("this system does not spend anything on
// softness") — reinventing the toggle's basic sliding-track mechanism to
// avoid a circle would break the convention people already know it by, so
// this keeps the mechanism and changes only the ornament: a square thumb,
// the same move lamp.tsx already made for status dots.
//
// Radius is --radius (6px), not the pill radius Button uses — a toggle
// should never read as a shrunk button. Track colour "on" is --accent (the
// system's silver primary), never --signal: --signal is reserved for
// liveness/instrument readouts elsewhere, and a config switch isn't one.
interface ToggleProps {
  checked: boolean;
  label: string;
  /**
   * Called on click; the caller owns state (this is a controlled component,
   * not an internally-stateful one) so a sibling like a Lamp reacting to the
   * same "on/off" fact stays in sync with the switch itself rather than
   * lagging a render behind it.
   */
  onToggle: () => void;
  disabled?: boolean;
}

export function Toggle({ checked, label, onToggle, disabled = false }: ToggleProps) {
  const [pending, startTransition] = useTransition();

  function handleClick() {
    startTransition(onToggle);
  }

  const isOn = checked;

  return (
    <label className="flex items-center justify-between gap-4">
      <span className="text-[14px] text-text-primary">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={isOn}
        disabled={disabled || pending}
        onClick={handleClick}
        className={`relative h-5 w-9 shrink-0 rounded transition-colors duration-fast ease-base disabled:opacity-60 ${
          isOn ? 'bg-accent' : 'border border-rule-mark bg-surface-elevated'
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-[3px] h-3.5 w-3.5 rounded-sm transition-transform duration-fast ease-base ${
            isOn ? 'translate-x-[17px] bg-surface-base' : 'translate-x-[3px] bg-text-tertiary'
          }`}
        />
      </button>
    </label>
  );
}
