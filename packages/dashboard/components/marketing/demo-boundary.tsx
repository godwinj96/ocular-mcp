'use client';

import { SectionHeader } from './section-header';
import { useInView } from '../../hooks/marketing/use-in-view';

// S4 · It can look. It can't act.
//
// The best idea in the round-5 spec, and the one that makes this section
// explain the product visually instead of asserting it in a sentence: a read
// cursor steps down the available operations and then STOPS DEAD on the rule.
// It does not ease out of the halt, it does not overshoot, it does not bounce
// — a bounce would imply it tried and was repelled, which is the wrong claim.
// It simply cannot go further, and it waits there for a second and a half.
// The animation's own inability to cross the line is the argument.
//
// Deliberately no red, no padlock, no strikethrough, no shield. Every one of
// those implies a switch exists somewhere. Inactive colour and an em dash
// carry it: the lower group reads as ABSENT, the way a build manifest shows
// what wasn't compiled in.

const CYCLE_MS = 5240;
const ROW_H = '2.2em';

const AVAILABLE = ['read the rendered frame', 'read the element tree', 'read motion as frames'];
const UNIMPLEMENTED = ['click', 'type', 'navigate', 'submit'];

export function DemoBoundary() {
  const { ref, inView } = useInView<HTMLDivElement>();

  return (
    <section
      id="boundary"
      className="pb-sec-tail pt-sec"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <SectionHeader
          eyebrow="Read-only"
          heading="It can look. It can't act."
          deck="No clicking, no typing, no navigation. The boundary is the product, not a setting you could turn off."
        />

        <div
          ref={ref}
          className={`demo-loop relative mt-group max-w-[44ch] ${inView ? 'is-live' : ''}`}
          style={{ ['--row-h' as string]: ROW_H }}
        >
          {/* The cursor. Absolutely positioned so it can travel independently
              of the rows it reads. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-signal"
            style={{
              opacity: 0,
              marginTop: '2.05em',
              animation: `boundary-cursor ${CYCLE_MS}ms linear infinite`,
            }}
          />

          <div className="font-mono text-[12.5px] leading-[2.2]">
            {AVAILABLE.map((label, i) => (
              <div key={label} className="flex items-baseline justify-between gap-6">
                <span
                  className="text-text-secondary"
                  style={{
                    animation: `boundary-row ${CYCLE_MS}ms linear infinite`,
                    animationDelay: `${i * 700}ms`,
                  }}
                >
                  {label}
                </span>
                <span className="shrink-0 text-signal">available</span>
              </div>
            ))}

            {/* The line the cursor cannot cross. */}
            <hr className="my-2 border-0 border-t border-rule-structural" />

            {UNIMPLEMENTED.map((label) => (
              <div key={label} className="flex items-baseline justify-between gap-6">
                <span className="text-text-inactive">{label}</span>
                <span className="shrink-0 text-text-inactive">— not implemented</span>
              </div>
            ))}
          </div>
        </div>

        {/* The limit that read-only does NOT remove. Volunteering this is
            worth more to this audience than any claim that could replace it,
            and CLAUDE.md forbids the claim it would otherwise invite. */}
        <p className="mt-group max-w-[66ch] text-[15px] leading-[1.6] text-text-tertiary [text-wrap:pretty]">
          What that removes is the risk of your agent doing something on a page. Read-only
          doesn&rsquo;t make the page itself safe to read. Whatever Ocular captures still becomes
          part of what your agent sees — the same as anything else it reads from the web. And a page
          can contain text written to trick an agent that reads it. Read-only is a real promise
          about actions. It isn&rsquo;t a promise about the words on a page.
        </p>
      </div>
    </section>
  );
}
