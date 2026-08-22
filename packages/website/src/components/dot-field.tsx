import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

// GPU-only ambient background — a single fragment shader draws the entire
// dot grid procedurally (no per-dot JS/DOM work). Mounted once at App root
// (single shared WebGL context) rather than per-section.
//
// Cursor reactivity was removed (see the commented-out block below) after it
// caused a visible bug: any positional drift (cursor-pull or the old
// flow-field drift) large enough to approach a cell's half-width made dots
// look clipped into little bounding boxes, because each fragment only ever
// computes *its own* grid cell's dot — a drifted dot that crosses into a
// neighboring cell's domain never gets drawn there, since that cell
// independently computes its own (different) dot. The fix is a genuinely
// static grid: dots never leave their cell center, so nothing can ever be
// clipped by a cell boundary. The "wave" is now amplitude-only (radius +
// opacity), evaluated once per cell so the whole dot breathes in unison
// with zero flicker/banding.
const CELL_PX = 9; // spacing between dot centers (halved per feedback — was too far apart)
const BASE_RADIUS_PX = 0.6; // scaled down ~80% per feedback — dots were too big
const WAVE_RADIUS_PX = 0.84; // per-cell wave peak — a gentle size "breathe", not a switch
const BASE_OPACITY = 0.38;
const WAVE_OPACITY = 0.62; // per-cell wave peak brightness
const FLOW_SPEED = 0.08; // how fast the ambient wave evolves over time
// uTime is wrapped at this period (seconds) before reaching the shader.
// Without this, uTime grows unboundedly for the life of a long-open tab,
// and GLSL's sin()/cos() lose enough precision on large arguments that the
// wave visibly freezes (confirmed live: uTime kept advancing correctly on
// the JS side, but the rendered canvas stopped changing at all once it grew
// large). 20*pi/FLOW_SPEED is chosen so every sine term below (which use
// phase rates of 1x, 0.7x, and 0.5x of `t`) lands back on an exact multiple
// of 2*PI at the wrap point — the wrap is phase-continuous, not a visible
// jump.
const TIME_WRAP_SECONDS = (20 * Math.PI) / FLOW_SPEED;
// Three different spatial frequencies/axes (not one) so the wave doesn't
// read as an obviously repeating sine sweep.
const WAVE_FREQ_X = 0.02;
const WAVE_FREQ_Y = 0.025;
const WAVE_FREQ_XY = 0.015;
const MAX_DPR = 2; // cap device-pixel-ratio cost on very high-DPI screens

// -- Disabled cursor-reactivity subsystem -----------------------------------
// Kept here (not deleted) in case a non-buggy reactive version is worth
// revisiting later. To re-enable: uncomment these constants, the uMouse/
// uMouseActive uniforms and shader terms below, and the pointermove/idle-
// timeout logic in the effect.
// const HOVER_RADIUS_PX = 200; // cursor falloff radius
// const DRIFT_PX = 10; // max distance a dot's center shifts toward the cursor
// const IDLE_TIMEOUT_MS = 1000;
// const RELEASE_DURATION_MS = 450; // ease-out once idle
// const REENGAGE_DURATION_MS = 120; // snap back quickly on movement
// -----------------------------------------------------------------------------

const VERTEX_SHADER = `
  attribute vec2 position;
  attribute vec2 uv;
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  precision highp float;
  uniform vec2 uResolution;
  uniform float uTime;
  uniform float uReactivity;
  // uniform vec2 uMouse;
  // uniform float uMouseActive;
  varying vec2 vUv;

  void main() {
    vec2 fragCoord = vUv * uResolution;

    vec2 gridPos = fragCoord / ${CELL_PX.toFixed(1)};
    vec2 cellIndex = floor(gridPos);
    vec2 cellCenter = (cellIndex + 0.5) * ${CELL_PX.toFixed(1)};

    // Ambient wave — a per-cell scalar (constant across every pixel of the
    // cell, since it's a function of cellCenter only), so the whole dot
    // fades/grows in unison with zero per-pixel flicker. Three overlapping
    // sine terms at different frequencies/axes avoid an obviously repeating
    // sweep. uReactivity zeroes it under prefers-reduced-motion, collapsing
    // every dot back to the static BASE_* values.
    float t = uTime * ${FLOW_SPEED.toFixed(3)};
    float waveA = sin(cellCenter.x * ${WAVE_FREQ_X.toFixed(4)} + t);
    float waveB = sin(cellCenter.y * ${WAVE_FREQ_Y.toFixed(4)} - t * 0.7);
    float waveC = sin((cellCenter.x + cellCenter.y) * ${WAVE_FREQ_XY.toFixed(4)} + t * 0.5);
    float wave01 = (0.5 + 0.5 * ((waveA + waveB + waveC) / 3.0)) * uReactivity;

    float radius = mix(${BASE_RADIUS_PX.toFixed(2)}, ${WAVE_RADIUS_PX.toFixed(2)}, wave01);
    float opacityTarget = mix(${BASE_OPACITY.toFixed(2)}, ${WAVE_OPACITY.toFixed(2)}, wave01);

    // Dots never leave their cell center — this alone is what makes it a
    // true, gap-free grid (see the file-header comment for why the old
    // drifting version broke this).
    float distToCenter = length(fragCoord - cellCenter);

    float dotMask = 1.0 - smoothstep(radius - 1.0, radius + 1.0, distToCenter);

    gl_FragColor = vec4(vec3(1.0), opacityTarget * dotMask);
  }
`;

export function DotField() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const renderer = new Renderer({
      canvas,
      alpha: true,
      dpr: Math.min(window.devicePixelRatio, MAX_DPR),
    });
    const gl = renderer.gl;
    gl.clearColor(0, 0, 0, 0);

    const geometry = new Triangle(gl);
    const program = new Program(gl, {
      vertex: VERTEX_SHADER,
      fragment: FRAGMENT_SHADER,
      transparent: true,
      uniforms: {
        uResolution: { value: [window.innerWidth, window.innerHeight] },
        uTime: { value: 0 },
        uReactivity: { value: prefersReducedMotion ? 0 : 1 },
        // uMouse: { value: [-9999, -9999] },
        // uMouseActive: { value: 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      program.uniforms.uResolution.value = [window.innerWidth, window.innerHeight];
    }
    resize();
    window.addEventListener('resize', resize);

    // let lastMoveTime = -Infinity;
    // function handlePointerMove(event: PointerEvent) {
    //   program.uniforms.uMouse.value = [event.clientX, window.innerHeight - event.clientY];
    //   lastMoveTime = performance.now();
    // }
    // if (!prefersReducedMotion) {
    //   window.addEventListener('pointermove', handlePointerMove);
    // }

    let rafId = 0;
    let running = true;
    // let mouseActive = 0;
    const startedAt = performance.now();

    function loop(now: number) {
      if (!running) return;
      program.uniforms.uTime.value = ((now - startedAt) / 1000) % TIME_WRAP_SECONDS;

      // const idleMs = now - lastMoveTime;
      // const target = idleMs < IDLE_TIMEOUT_MS ? 1 : 0;
      // const duration = target === 1 ? REENGAGE_DURATION_MS : RELEASE_DURATION_MS;
      // const step = 1 / (duration / 16.7);
      // mouseActive += (target - mouseActive) * Math.min(step, 1);
      // program.uniforms.uMouseActive.value = mouseActive;

      renderer.render({ scene: mesh });
      rafId = requestAnimationFrame(loop);
    }

    function handleVisibilityChange() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(rafId);
      } else if (!running) {
        running = true;
        rafId = requestAnimationFrame(loop);
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    rafId = requestAnimationFrame(loop);

    return () => {
      running = false;
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
      // window.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-20"
    />
  );
}
