// The instrument's lamps, and the ONLY place colour carries meaning in this
// product. Stripe's rule, which this follows: colour is reserved exclusively
// for status, because when every data point uses colour the signal stops
// meaning anything.
//
// A SQUARE, not a circle. The registration ticks --rule-mark already serves are
// square; a circle is the softer, more decorative choice, and this system does
// not spend anything on softness.
//
// Note what deliberately has NO lamp: a healthy subscription. Absence is the
// good state on /billing, and only past_due and canceled get marked. Lighting
// a lamp for "everything is fine" is how a lamp stops being worth looking at.

export type LampState = 'live' | 'caution' | 'fault' | 'inactive';

const LAMP: Record<LampState, { box: string; text: string }> = {
  live: { box: 'bg-signal', text: 'text-signal' },
  caution: { box: 'bg-caution', text: 'text-caution' },
  fault: { box: 'bg-fault', text: 'text-fault' },
  inactive: { box: 'bg-text-inactive', text: 'text-text-tertiary' },
};

interface LampProps {
  state: LampState;
  label: string;
}

export function Lamp({ state, label }: LampProps) {
  const tone = LAMP[state];

  return (
    <p className="flex items-center gap-2">
      <span aria-hidden className={`h-2 w-2 shrink-0 ${tone.box}`} />
      <span className={`font-mono text-[11.5px] tracking-[0.02em] ${tone.text}`}>{label}</span>
    </p>
  );
}
