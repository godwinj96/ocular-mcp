import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { TransitionSeries, linearTiming } from '@remotion/transitions';
import { fade } from '@remotion/transitions/fade';
import { slide } from '@remotion/transitions/slide';

// The five-beat "why Ocular" story: prompt without Ocular -> blocked ->
// connect Ocular in one command -> retry the same prompt -> real result.
// Lives here (not a separate packages/remotion project) because it's played
// live via @remotion/player in the browser, not pre-rendered to a video file
// — see DEVLOG's Phase 6 note on why that tradeoff was chosen.
export const FPS = 30;
export const WIDTH = 1280;
export const HEIGHT = 400; // halved from the original 800 — panel was too tall

const BEATS = {
  promptNoOcular: 90,
  blocked: 55,
  connect: 100,
  retryPrompt: 45,
  success: 100,
} as const;

// TransitionSeries overlaps adjacent scenes — the composition's real total
// is shorter than the naive sum of beat durations by one TRANSITION_FRAMES
// per transition (4 transitions between 5 beats). See
// node_modules/@remotion/transitions' own docs for the exact formula.
const TRANSITION_FRAMES = 15;
const TRANSITION_COUNT = 4;
export const TOTAL_FRAMES = Object.values(BEATS).reduce((a, b) => a + b, 0) - TRANSITION_FRAMES * TRANSITION_COUNT;

// Named spring presets (not scattered inline damping/stiffness numbers) —
// same values the remotion-video-creation skill documents as the standard
// starting point for each feel.
const SPRINGS = {
  smooth: { damping: 200 }, // subtle reveals, no bounce
  snappy: { damping: 20, stiffness: 200 }, // UI elements
  bouncy: { damping: 8 }, // playful entrances
} as const;

const COLOR = {
  bg: '#1C1C1F',
  border: 'rgba(255,255,255,0.08)',
  textPrimary: '#F2F2F0',
  textSecondary: '#8F8F94',
  accent: '#8C7DFF',
  accentGlow: '#5EEAD4',
  danger: '#F2555A',
};

const monoStyle: React.CSSProperties = {
  fontFamily: '"Geist Mono", "JetBrains Mono", ui-monospace, monospace',
  fontSize: 22,
  lineHeight: 1.55,
};

// Reuses hero.tsx's own GrainOverlay technique (inline SVG feTurbulence) —
// same proven, on-brand texture, scoped to this panel instead of the page.
function PanelGrain() {
  return (
    <svg
      aria-hidden="true"
      style={{ position: 'absolute', inset: 0, opacity: 0.05, mixBlendMode: 'overlay' }}
      width="100%"
      height="100%"
    >
      <filter id="workflow-grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter="url(#workflow-grain)" />
    </svg>
  );
}

// Standard CSS vignette + scanline + dot-grid layers — deliberately echoing
// the site's own DotField background so the hero graphic and the page read
// as one coherent system, not two unrelated effects.
function PanelTexture() {
  return (
    <>
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.08) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'repeating-linear-gradient(0deg, rgba(255,255,255,0.025) 0px, rgba(255,255,255,0.025) 1px, transparent 1px, transparent 3px)',
        }}
      />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.4) 100%)',
        }}
      />
      <PanelGrain />
    </>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: COLOR.bg,
        border: `1px solid ${COLOR.border}`,
        borderRadius: 16,
        padding: 28,
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <PanelTexture />
      <div style={{ position: 'relative' }}>{children}</div>
    </AbsoluteFill>
  );
}

// Blinks on a fixed frame cadence — never per-character opacity, per the
// skill's text-animations rule; this is a separate glyph, not part of the
// typed string.
function BlinkingCursor() {
  const frame = useCurrentFrame();
  const visible = Math.floor(frame / 15) % 2 === 0;
  return (
    <span style={{ opacity: visible ? 1 : 0, color: COLOR.accentGlow }} aria-hidden="true">
      ▍
    </span>
  );
}

// Types out `text` character-by-character over `durationFrames`, starting at
// `startFrame`. Pure function of frame, no timers — frame-accurate by
// construction (Remotion's whole point over hand-tuned CSS transitions).
// Always use string slicing for typewriter effects, never per-character opacity.
function useTypewriter(text: string, startFrame: number, durationFrames: number): { text: string; done: boolean } {
  const frame = useCurrentFrame();
  const chars = Math.round(
    interpolate(frame, [startFrame, startFrame + durationFrames], [0, text.length], {
      extrapolateLeft: 'clamp',
      extrapolateRight: 'clamp',
    }),
  );
  return { text: text.slice(0, chars), done: chars >= text.length };
}

function PromptNoOcular() {
  const frame = useCurrentFrame();
  const prompt = useTypewriter('take a screenshot of stripe.com', 0, 30);
  const replyOpacity = interpolate(frame, [40, 55], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <Panel>
      <div style={monoStyle}>
        <span style={{ color: COLOR.accentGlow }}>{'> '}</span>
        <span style={{ color: COLOR.textPrimary }}>{prompt.text}</span>
        {!prompt.done && <BlinkingCursor />}
      </div>
      <div style={{ ...monoStyle, marginTop: 20, color: COLOR.textSecondary, opacity: replyOpacity }}>
        Agent: I can't browse the web — I don't have that capability yet.
      </div>
    </Panel>
  );
}

// Fixed, deterministic offsets — a per-frame glitch stutter via interpolate,
// not random jitter (random per-render would make the animation non-
// reproducible, which defeats Remotion's frame-accuracy premise).
const GLITCH_WINDOW: [number, number][] = [
  [4, 7],
  [10, 12],
  [18, 20],
];

function glitchOffset(frame: number): number {
  for (const [start, end] of GLITCH_WINDOW) {
    if (frame >= start && frame < end) return 3;
  }
  return 0;
}

function Blocked() {
  const frame = useCurrentFrame();
  const pop = spring({ frame, fps: FPS, config: SPRINGS.bouncy });
  const fadeOut = interpolate(frame, [35, 55], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glitch = glitchOffset(frame);

  return (
    <Panel>
      <div
        style={{
          position: 'relative',
          transform: `scale(${pop})`,
          opacity: fadeOut,
          textAlign: 'center',
        }}
      >
        {/* Glitch-text trick: red/cyan duplicate layers offset a few px during short windows */}
        <div
          aria-hidden="true"
          style={{
            ...monoStyle,
            position: 'absolute',
            inset: 0,
            fontSize: 32,
            fontWeight: 700,
            color: COLOR.danger,
            opacity: glitch > 0 ? 0.6 : 0,
            transform: `translateX(${glitch}px)`,
          }}
        >
          ✕ BLOCKED
        </div>
        <div
          aria-hidden="true"
          style={{
            ...monoStyle,
            position: 'absolute',
            inset: 0,
            fontSize: 32,
            fontWeight: 700,
            color: COLOR.accentGlow,
            opacity: glitch > 0 ? 0.5 : 0,
            transform: `translateX(${-glitch}px)`,
          }}
        >
          ✕ BLOCKED
        </div>
        <div style={{ ...monoStyle, fontSize: 32, fontWeight: 700, color: COLOR.danger }}>✕ BLOCKED</div>
        <div style={{ fontSize: 16, fontWeight: 400, color: COLOR.textSecondary, marginTop: 10 }}>
          No way to see the page.
        </div>
      </div>
    </Panel>
  );
}

// Fixed particle angles/distances — deterministic, not Math.random(), same
// reasoning as the glitch offsets above.
const PARTICLES = Array.from({ length: 10 }, (_, i) => ({
  angle: (i / 10) * Math.PI * 2,
  distance: 28 + (i % 3) * 10,
}));

function ConnectedBurst({ startFrame }: { startFrame: number }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [startFrame, startFrame + 20], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  if (progress <= 0) return null;

  return (
    <>
      {PARTICLES.map((p, i) => {
        const x = Math.cos(p.angle) * p.distance * progress;
        const y = Math.sin(p.angle) * p.distance * progress;
        const opacity = 1 - progress;
        return (
          <div
            key={i}
            aria-hidden="true"
            style={{
              position: 'absolute',
              left: -3,
              top: -3,
              width: 6,
              height: 6,
              borderRadius: '50%',
              backgroundColor: COLOR.accentGlow,
              opacity,
              transform: `translate(${x}px, ${y}px)`,
            }}
          />
        );
      })}
    </>
  );
}

function Connect() {
  const frame = useCurrentFrame();
  const command = useTypewriter('claude mcp add ocular https://mcp.ocular.io', 0, 45);
  const checkPop = spring({ frame: frame - 50, fps: FPS, config: SPRINGS.snappy });
  const checkOpacity = interpolate(frame, [48, 58], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <Panel>
      <div style={monoStyle}>
        <span style={{ color: COLOR.textSecondary }}>{'$ '}</span>
        <span style={{ color: COLOR.textPrimary }}>{command.text}</span>
        {!command.done && <BlinkingCursor />}
      </div>
      <div
        style={{
          ...monoStyle,
          position: 'relative',
          marginTop: 20,
          color: COLOR.accentGlow,
          opacity: checkOpacity,
          transform: `scale(${Math.max(checkPop, 0)})`,
          transformOrigin: 'left center',
        }}
      >
        ✓ Connected — 4 tools available
        <div style={{ position: 'absolute', left: 8, top: 12 }}>
          <ConnectedBurst startFrame={50} />
        </div>
      </div>
    </Panel>
  );
}

function RetryPrompt() {
  const prompt = useTypewriter('take a screenshot of stripe.com', 0, 30);
  return (
    <Panel>
      <div style={monoStyle}>
        <span style={{ color: COLOR.accentGlow }}>{'> '}</span>
        <span style={{ color: COLOR.textPrimary }}>{prompt.text}</span>
        {!prompt.done && <BlinkingCursor />}
      </div>
    </Panel>
  );
}

function Success() {
  const frame = useCurrentFrame();
  const resultOpacity = interpolate(frame, [15, 35], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const glowOpacity = interpolate(frame, [0, 20, 60, 90], [0, 0.5, 0.5, 0], { extrapolateRight: 'clamp' });

  return (
    <Panel>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 16,
          boxShadow: `inset 0 0 100px ${COLOR.accentGlow}`,
          opacity: glowOpacity,
          pointerEvents: 'none',
        }}
      />
      <div style={monoStyle}>
        <span style={{ color: COLOR.accentGlow }}>agent</span>
        <span style={{ color: COLOR.textSecondary }}>.call(</span>
        <span style={{ color: COLOR.accent }}>&quot;view_page&quot;</span>
        <span style={{ color: COLOR.textSecondary }}>, {'{ url }'})</span>
      </div>
      <div style={{ ...monoStyle, color: COLOR.textSecondary, marginTop: 10 }}>→</div>
      {/* Outcome only, no internal mechanics — no rung count, no exact
          duration, no exact resize target. Same "assert the outcome,
          withhold the mechanism" copy rule already applied to page copy. */}
      <pre style={{ ...monoStyle, color: COLOR.textPrimary, opacity: resultOpacity, marginTop: 6, whiteSpace: 'pre-wrap' }}>
{`{
  "ok": true,
  "image": "<rendered screenshot>"
}`}
      </pre>
      <div style={{ ...monoStyle, color: COLOR.textSecondary, marginTop: 14, opacity: resultOpacity }}>
        // your agent can see.
      </div>
    </Panel>
  );
}

export function WorkflowDemo() {
  const { width, height } = useVideoConfig();

  return (
    <AbsoluteFill style={{ width, height, backgroundColor: COLOR.bg }}>
      <TransitionSeries>
        <TransitionSeries.Sequence durationInFrames={BEATS.promptNoOcular}>
          <PromptNoOcular />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence durationInFrames={BEATS.blocked}>
          <Blocked />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={slide({ direction: 'from-right' })}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence durationInFrames={BEATS.connect}>
          <Connect />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence durationInFrames={BEATS.retryPrompt}>
          <RetryPrompt />
        </TransitionSeries.Sequence>
        <TransitionSeries.Transition
          presentation={fade()}
          timing={linearTiming({ durationInFrames: TRANSITION_FRAMES })}
        />
        <TransitionSeries.Sequence durationInFrames={BEATS.success}>
          <Success />
        </TransitionSeries.Sequence>
      </TransitionSeries>
    </AbsoluteFill>
  );
}
