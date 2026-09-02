import { useRef } from 'react';
import { Dithering } from '@paper-design/shaders-react';
import { useReducedMotion } from 'framer-motion';
import { BentoCell, BentoGrid } from './bento-grid.js';
import { MotionCta } from './motion-cta.js';
import { Parallax } from './parallax.js';
import { WorkflowPlayer } from './workflow-player.js';
import logoMarkWatermark from '../assets/logo-mark-watermark.png';

// Fixed, full-viewport grain — inline SVG feTurbulence, no network asset,
// ~3-4% opacity via mix-blend-mode. brand-identity.md §6 texture notes.
function GrainOverlay() {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 h-full w-full opacity-[0.035] mix-blend-overlay"
    >
      <filter id="grain">
        <feTurbulence
          type="fractalNoise"
          baseFrequency="0.85"
          numOctaves="2"
          stitchTiles="stitch"
        />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  );
}

// Oversized logo mark bleeding off one corner — the actual Ocular icon
// silhouette (Ocular Assets/446821.png, confirmed transparent PNG via header
// inspection) filled with a live paper-design Dithering shader (warp preset,
// brand violet/cyan) instead of a flat static image, per brand-identity's
// "wonder, not a teardown" direction. Falls back to the static image under
// prefers-reduced-motion.
function Watermark() {
  const reduceMotion = useReducedMotion();

  const maskStyle: React.CSSProperties = {
    WebkitMaskImage: `url(${logoMarkWatermark})`,
    maskImage: `url(${logoMarkWatermark})`,
    WebkitMaskSize: 'contain',
    maskSize: 'contain',
    WebkitMaskRepeat: 'no-repeat',
    maskRepeat: 'no-repeat',
    WebkitMaskPosition: 'center',
    maskPosition: 'center',
  };

  return (
    <Parallax range={40} className="pointer-events-none absolute -right-12 -top-24 -z-10">
      {reduceMotion ? (
        <img
          src={logoMarkWatermark}
          alt=""
          aria-hidden="true"
          className="h-[32rem] w-[32rem] select-none opacity-[0.08] md:h-[40rem] md:w-[40rem]"
        />
      ) : (
        <div
          aria-hidden="true"
          className="h-[32rem] w-[32rem] select-none opacity-[0.16] md:h-[40rem] md:w-[40rem]"
          style={maskStyle}
        >
          <Dithering
            shape="warp"
            type="8x8"
            colorBack="#0A0A0B00"
            colorFront="#8C7DFF"
            size={2.4}
            speed={0.3}
            className="h-full w-full"
          />
        </div>
      )}
    </Parallax>
  );
}

// Cursor-reactive spotlight — a radial gradient following the pointer,
// disabled entirely under prefers-reduced-motion.
function Spotlight() {
  const ref = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  if (reduceMotion) return null;

  const handleMouseMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--x', `${event.clientX - rect.left}px`);
    el.style.setProperty('--y', `${event.clientY - rect.top}px`);
  };

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className="pointer-events-none absolute inset-0 -z-10 opacity-60 transition-opacity"
      style={{
        background:
          'radial-gradient(400px circle at var(--x, 50%) var(--y, 20%), rgba(124,108,255,0.12), transparent 70%)',
      }}
    />
  );
}

export function Hero() {
  return (
    <section id="top" className="relative mx-auto max-w-[1400px] px-6 pb-16 pt-24 md:pt-32">
      <GrainOverlay />
      <Watermark />
      <Spotlight />
      <BentoGrid>
        <BentoCell span="full" surface="open" className="mb-6">
          <p className="mb-5 font-mono text-sm uppercase tracking-widest text-accent-glow">
            Ocular · MCP server
          </p>
          <h1 className="max-w-3xl text-display-lg font-bold text-text-primary">
            Real eyes for AI agents.
          </h1>
          <p className="mt-6 max-w-measure text-lg leading-relaxed text-text-secondary md:text-xl">
            Sees your dev server and the live web. One MCP connection — no infrastructure to run, no
            blocks to fight.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <MotionCta
              href="/setup"
              className="rounded-full bg-accent px-6 py-3 font-semibold text-surface-base transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Connect Ocular — from $2.50/mo
            </MotionCta>
            <span className="font-mono text-sm text-text-secondary">
              5 tools · 1 MCP connection
            </span>
          </div>
        </BentoCell>

        <BentoCell span="full" surface="open">
          <WorkflowPlayer />
        </BentoCell>
      </BentoGrid>
    </section>
  );
}
