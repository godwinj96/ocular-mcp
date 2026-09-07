// The allowance rail: one slot per capture in the day's cloud allowance.
//
// FIXED SLOTS THAT WRAP, not flex-1. The website's rail divides its track by
// the segment count, which makes the slot proportion a function of the
// container: measured at 1440px its slots render 18.15 x 10px = 1.82:1, which
// is the founder's "the rail proportion is wrong" note -- a slot nearly twice
// as wide as it is tall reads as a dash, and a row of dashes reads as a dashed
// line rather than as something countable. Ported naively into the dashboard's
// narrower column it gets WORSE: (1032 - 39*3) / 40 = 22.9px at 14px tall,
// i.e. 1.64:1.
//
// Fixing the slot at 6x14 (0.43:1) and letting the row wrap makes the shape
// independent of both container width and cap. 40 slots is one row; 150 is
// three. Wrapped rows read as a punch card, which is in register.
//
// THRESHOLDS come from Geist's published breakpoints -- >=80% warning, >=95%
// error -- so the dashboard uses the same numeric boundaries a lot of
// developers already have calibrated. Only the LEADING spent slot and the count
// recolour. Recolouring the whole rail is decoration; recolouring the leading
// edge is a needle.
//
// NO ANIMATION. The website's rail animates because it is a demo of the
// product. A real meter that animates is a toy.

const CAUTION_AT = 0.8;
const FAULT_AT = 1;

interface RailProps {
  spent: number;
  total: number;
}

export function Rail({ spent, total }: RailProps) {
  const clamped = Math.max(0, Math.min(spent, total));
  const ratio = total > 0 ? clamped / total : 0;
  const leadTone =
    ratio >= FAULT_AT ? 'bg-fault' : ratio >= CAUTION_AT ? 'bg-caution' : 'bg-accent';

  return (
    <div
      role="meter"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={total}
      aria-label={`${clamped} of ${total} web captures used today`}
      className="flex max-w-rail flex-wrap"
      style={{ gap: 'var(--rail-row-gap) var(--rail-gap)' }}
    >
      {Array.from({ length: total }, (_, i) => {
        const isSpent = i < clamped;
        const isLead = i === clamped - 1;
        return (
          <span
            key={i}
            aria-hidden
            className={isSpent ? (isLead ? leadTone : 'bg-accent') : 'bg-text-inactive'}
            style={{ width: 'var(--rail-slot-w)', height: 'var(--rail-slot-h)' }}
          />
        );
      })}
    </div>
  );
}

export function railTone(spent: number, total: number): 'default' | 'caution' | 'fault' {
  const ratio = total > 0 ? spent / total : 0;
  if (ratio >= FAULT_AT) return 'fault';
  if (ratio >= CAUTION_AT) return 'caution';
  return 'default';
}
