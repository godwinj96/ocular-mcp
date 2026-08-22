import { useCurrentFrame } from 'remotion';
import {
  Claim,
  Emergence,
  Resolution,
  GazeRing,
  SigilReveal,
  Surface,
  SequenceRenderer,
  sequencePlanTotalFrames,
  useAwareness,
  loadPoppins,
  tokenInterpolate,
  TYPE_ROLES,
  N,
  type SequencePlan,
} from '@ocular/motion';

// The Ocular hero panel's SequencePlan — Motion Design Bible §IV.16 rule 3
// (Data-Authoring Rule). See DEVLOG/session notes for the full rule-by-rule
// mapping of the original hand-rolled version this replaced.
//
// This is the second pass at this file. The first pass was canon-compliant
// but visually inert: plain text on a flat field, no cards, no icons, no
// camera motion, no depth — the bible bans glow/gradient/accent-hue, but it
// does not ban (and in fact requires, §I.6 rule 14 / §IV.15 rules 5-7)
// actual rebuilt UI surfaces, shadow-based depth, and Observer Camera
// motion. This pass uses all three: <Surface> cards (radius/shadow/neutral
// fill, no glow), simple ring/line glyphs in the Logomark's own visual
// family (never colored brand logos — that would violate the two-color
// canon), and real camera push-ins via each Beat's `attentionTarget`.
//
// Beat map (bible §III.14 short-form 5-Beat compression, bookended by a
// Loop Closure pair per §II.11 rules 7-11 — this panel autoplays on a loop):
//   B0  Conviction (rest)               — the Loop Closure frame, L3
//   B1  Hook (Recognition+Curiosity)    — Product Atom glimpse, L0
//   B2  Tension + Possibility           — the blocked state, L0->L1
//   B3  Discovery (L1->L2, once)        — connecting Ocular
//   B4  Empowerment + Confidence        — retry + result, L2
//   B5  Clarity + Scale + Conviction    — settle back to rest, L3 (== B0)

loadPoppins();

export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 400;

// -- Icon glyphs -------------------------------------------------------
// Simple ring/line-weight shapes in the Logomark's own construction
// language (a stroked circle is the family resemblance) — never a
// colored third-party brand mark (Idealized UI Rule + two-color canon).

function iconColor(state: string): string {
  return state === 'L0' || state === 'L1' ? N['700'] : N['400'];
}

function PromptGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
      <path
        d="M9 8.5 13 12 9 15.5"
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BlindGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
      <line
        x1="6.5"
        y1="17.5"
        x2="17.5"
        y2="6.5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function LinkGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="8" cy="16" r="4" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="16" cy="8" r="4" fill="none" stroke={color} strokeWidth="2" />
      <line
        x1="10.8"
        y1="13.2"
        x2="13.2"
        y2="10.8"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function EyeGlyph({ color }: { color: string }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke={color} strokeWidth="2" />
      <circle cx="14.6" cy="9.4" r="3.2" fill={color} />
    </svg>
  );
}

// -- Shared scene shell --------------------------------------------------

function IdealizedPanel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 28,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  );
}

function TextLine({
  text,
  entryFrame,
  mono = true,
}: {
  text: string;
  entryFrame: number;
  mono?: boolean;
}) {
  const frame = useCurrentFrame();
  const awareness = useAwareness();
  const color = awareness.state === 'L0' || awareness.state === 'L1' ? '#F2F2F0' : '#0B0F17';
  const chars = Math.round(tokenInterpolate(frame, entryFrame, 'base', 0, text.length, 'reveal'));

  return (
    <span
      style={{
        fontFamily: mono ? '"Geist Mono", ui-monospace, monospace' : TYPE_ROLES.ui.fontFamily,
        fontSize: 19,
        color,
      }}
    >
      {text.slice(0, chars)}
    </span>
  );
}

// B0/B5 — the resting/arriving Sigil Reveal. Shared so both frames are
// pixel-identical once settled (Loop Closure motion parity, §II.11 rule 8).
function RestOrArrival({ animate }: { animate: boolean }) {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <SigilReveal atFrame={animate ? 0 : -1000} polarity="light" sizePx={72} />
    </div>
  );
}

// B1 — Hook: the Product Atom glimpse (§III.14 rule 4, Inversion Rule).
function Hook() {
  const awareness = useAwareness();
  const glyph = iconColor(awareness.state);
  return (
    <IdealizedPanel>
      <Surface elevation="card" padding={22} style={{ maxWidth: 620 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PromptGlyph color={glyph} />
          <TextLine text="take a screenshot of stripe.com" entryFrame={0} />
        </div>
      </Surface>
      <Emergence entryFrame={42} duration="base" travelPx={8}>
        <div
          style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12, paddingLeft: 4 }}
        >
          <BlindGlyph color={glyph} />
          <TextLine text="Agent: I can't browse the web yet." entryFrame={-1000} mono={false} />
        </div>
      </Emergence>
    </IdealizedPanel>
  );
}

// B2 — Tension + Possibility: the blocked state. No GazeRing here — its
// absence *is* the depiction of blindness (§I.6 rule 13). A single Claim
// carries the headline instead of a hand-rolled div.
function Blocked() {
  const awareness = useAwareness();
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
      }}
    >
      <BlindGlyph color={iconColor(awareness.state)} />
      <Claim text="No way to see the page." entryFrame={0} reveal="Emergence" />
    </div>
  );
}

// B3 — Discovery: connecting Ocular. The Gaze Ring appears here for the
// first time (§I.6 rule 13 — never before L1+), fills the connect action.
function Connect() {
  const frame = useCurrentFrame();
  const awareness = useAwareness();
  const glyph = iconColor(awareness.state);
  return (
    <IdealizedPanel>
      <Surface elevation="card" padding={22} style={{ maxWidth: 660 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <LinkGlyph color={glyph} />
          <TextLine text="claude mcp add ocular https://mcp.ocular.io" entryFrame={0} />
        </div>
        <Emergence entryFrame={52} duration="base" travelPx={6}>
          <Surface elevation="raised" radius="sm" padding={12} style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <EyeGlyph color={glyph} />
              <TextLine text="Connected — 4 tools available" entryFrame={-1000} mono={false} />
            </div>
          </Surface>
        </Emergence>
        {/* Positioned relative to this Surface (position:relative), whose
            content-box dimensions are actually known — an ancestor further
            out (IdealizedPanel) is flex-centered with no predictable size,
            which is why an earlier version of this scene had the ring
            floating disconnected from anything. */}
        {frame > 52 ? (
          <GazeRing
            path={[
              { x: 580, y: 6 },
              { x: 300, y: 66 },
            ]}
            arrivalFrame={72}
            action="fill"
          />
        ) : null}
      </Surface>
    </IdealizedPanel>
  );
}

// B4 — Empowerment + Confidence: retry, and the result resolves into focus
// (Resolution reveal — "uncertainty becomes certainty" — not a glow pulse).
function Retry() {
  const awareness = useAwareness();
  const glyph = iconColor(awareness.state);
  return (
    <IdealizedPanel>
      <Surface elevation="card" padding={22} style={{ maxWidth: 660 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <PromptGlyph color={glyph} />
          <TextLine text="take a screenshot of stripe.com" entryFrame={0} />
        </div>
        <Resolution entryFrame={40} duration="base">
          <Surface elevation="raised" radius="sm" padding={12} style={{ marginTop: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <EyeGlyph color={glyph} />
              <TextLine text="view_page(url) -> rendered screenshot" entryFrame={-1000} />
            </div>
          </Surface>
        </Resolution>
        <GazeRing
          path={[
            { x: 580, y: 6 },
            { x: 350, y: 66 },
          ]}
          arrivalFrame={18}
          action="read"
        />
      </Surface>
    </IdealizedPanel>
  );
}

export const workflowPlan: SequencePlan = {
  id: 'ocular-hero-workflow',
  width: WIDTH,
  height: HEIGHT,
  loop: true,
  beats: [
    {
      id: 'b0-rest',
      stage: 'Conviction (rest)',
      frames: 96,
      awarenessState: 'L3',
      boundaryOut: 'LucidityStep',
      attentionTarget: { subject: 'rest', framing: { x: 0, y: 0, scale: 1 }, move: 'dolly' },
      render: () => <RestOrArrival animate={false} />,
    },
    {
      id: 'b1-hook',
      stage: 'Recognition + Curiosity (Hook)',
      frames: 140,
      awarenessState: 'L0',
      boundaryOut: 'FieldHandoff',
      motionEntries: [{ id: 'prompt', class: 'primary', startFrame: 0, endFrame: 70 }],
      render: () => <Hook />,
    },
    {
      id: 'b2-tension',
      stage: 'Tension + Possibility',
      frames: 230,
      awarenessState: 'L1',
      boundaryOut: 'LucidityStep',
      motionEntries: [{ id: 'blocked', class: 'primary', startFrame: 0, endFrame: 32 }],
      attentionTarget: {
        subject: 'blocked-headline',
        framing: { x: 0, y: -8, scale: 1.06 },
        move: 'dolly',
      },
      render: () => <Blocked />,
    },
    {
      id: 'b3-discovery',
      stage: 'Discovery',
      frames: 96,
      awarenessState: 'L2',
      boundaryOut: 'FieldHandoff',
      // endFrame must stay inside this Beat's non-crossfading core window
      // (frames - boundaryOverlapFrames('FieldHandoff') = 96 - 32 = 64) —
      // spilling past it overlaps B4's own leading motion during the
      // shared crossfade and blows the >1.0 budget (§I.5).
      motionEntries: [{ id: 'connect', class: 'primary', startFrame: 0, endFrame: 60 }],
      attentionTarget: {
        subject: 'connect-card',
        framing: { x: 0, y: 0, scale: 1 },
        move: 'dolly',
      },
      render: () => <Connect />,
    },
    {
      id: 'b4-empowerment',
      stage: 'Empowerment + Confidence',
      frames: 220,
      awarenessState: 'L2',
      boundaryOut: 'LucidityStep',
      motionEntries: [{ id: 'retry', class: 'primary', startFrame: 0, endFrame: 61 }],
      attentionTarget: {
        subject: 'result-card',
        framing: { x: 0, y: -6, scale: 1.05 },
        move: 'dolly',
      },
      render: () => <Retry />,
    },
    {
      id: 'b5-arrival',
      stage: 'Clarity + Scale + Conviction',
      frames: 150,
      awarenessState: 'L3',
      boundaryOut: 'FieldHandoff',
      // Deliberately no motionEntries — Clarity/Conviction is near-total
      // stillness by definition (Emotional Arc table, §I.4); the Sigil
      // Reveal's settle into rest is the inherent shape of *reaching* that
      // state, not a competing motion the ledger needs to gate.
      attentionTarget: { subject: 'rest', framing: { x: 0, y: 0, scale: 1 }, move: 'dolly' },
      render: () => <RestOrArrival animate={true} />,
    },
  ],
};

export const TOTAL_FRAMES = sequencePlanTotalFrames(workflowPlan);

export function WorkflowDemo() {
  return <SequenceRenderer plan={workflowPlan} />;
}
