import { useEffect, useRef } from 'react';
import { Mesh, Program, Renderer, Triangle } from 'ogl';

// GPU-only ambient background — a single fragment shader draws the entire
// dot grid procedurally (no per-dot JS/DOM work). Dots are subtle at rest
// and scale up + drift toward the cursor within a falloff radius, per the
// brand-identity texture pass. Mounted once at App root (single shared
// WebGL context) rather than per-section.
const CELL_PX = 18; // spacing between dot centers — denser grid, was too sparse at 28
const HOVER_RADIUS_PX = 200; // cursor falloff radius
const DRIFT_PX = 10; // max distance a dot's center shifts toward the cursor
// Base values are the "visible at rest, everywhere" floor — cursor
// reactivity and flow-field drift are additive on top of this, never a
// replacement for it (all three properties must coexist, not trade off).
const BASE_RADIUS_PX = 3.0;
const MAX_RADIUS_PX = 3.7; // small delta over base — hover reads as "subtly brighter", not "switched on"
const BASE_OPACITY = 0.38;
const MAX_OPACITY = 0.5;
const FLOW_SPEED = 0.08; // how fast the wave field evolves over time
const FLOW_SCALE = 0.045; // spatial frequency of the wave field
const FLOW_DRIFT_PX = 12; // max positional offset from the flow field alone — was too small to notice at 6
const MAX_DPR = 2; // cap device-pixel-ratio cost on very high-DPI screens

// Cursor reactivity now depends on activity, not just position — a
// stationary cursor releases the dots beneath it back to their idle wave
// state after IDLE_TIMEOUT_MS, and re-engages quickly once it moves again.
const IDLE_TIMEOUT_MS = 1000;
const RELEASE_DURATION_MS = 450; // ease-out once idle
const REENGAGE_DURATION_MS = 120; // snap back quickly on movement

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
  uniform vec2 uMouse;
  uniform float uTime;
  uniform float uReactivity;
  uniform float uMouseActive;
  varying vec2 vUv;

  // Cheap analytic flow field — a scalar potential (angle) built from two
  // overlapping sine/cosine terms over position + time, converted to a unit
  // direction. No texture lookups, no real Perlin/simplex noise needed; this
  // is the standard "scalar-potential-to-vector" trick used in shader
  // flow-field art, and it's what makes the whole grid drift like slow
  // waves independent of the cursor.
  vec2 flowDirection(vec2 p, float t) {
    float angle = sin(p.x * ${FLOW_SCALE.toFixed(3)} + t) + cos(p.y * ${FLOW_SCALE.toFixed(3)} - t * 0.8);
    return vec2(cos(angle), sin(angle));
  }

  void main() {
    vec2 fragCoord = vUv * uResolution;

    vec2 gridPos = fragCoord / ${CELL_PX.toFixed(1)};
    vec2 cellIndex = floor(gridPos);
    vec2 cellCenter = (cellIndex + 0.5) * ${CELL_PX.toFixed(1)};

    // Wave drift — always on (subject to uReactivity/reduced-motion), runs
    // everywhere, independent of the cursor.
    float flowTime = uTime * ${FLOW_SPEED.toFixed(3)};
    vec2 flow = flowDirection(cellCenter, flowTime) * ${FLOW_DRIFT_PX.toFixed(1)} * uReactivity;
    vec2 restCenter = cellCenter + flow;

    // Cursor pull — added on top of the wave drift, not a replacement.
    // Gated by uMouseActive: a stationary cursor eases this term back to 0
    // after IDLE_TIMEOUT_MS even though uMouse's position hasn't changed.
    float distToMouse = length(cellCenter - uMouse);
    float falloff = smoothstep(${HOVER_RADIUS_PX.toFixed(1)}, 0.0, distToMouse) * uReactivity * uMouseActive;
    vec2 dir = normalize(uMouse - cellCenter + 0.0001);
    vec2 driftedCenter = restCenter + dir * falloff * ${DRIFT_PX.toFixed(1)};

    float distToCenter = length(fragCoord - driftedCenter);
    float radius = mix(${BASE_RADIUS_PX.toFixed(2)}, ${MAX_RADIUS_PX.toFixed(2)}, falloff);

    float dotMask = 1.0 - smoothstep(radius - 1.0, radius + 1.0, distToCenter);
    float opacity = mix(${BASE_OPACITY.toFixed(2)}, ${MAX_OPACITY.toFixed(2)}, falloff) * dotMask;

    gl_FragColor = vec4(vec3(1.0), opacity);
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
        uMouse: { value: [-9999, -9999] },
        uTime: { value: 0 },
        uReactivity: { value: prefersReducedMotion ? 0 : 1 },
        uMouseActive: { value: 0 },
      },
    });
    const mesh = new Mesh(gl, { geometry, program });

    function resize() {
      renderer.setSize(window.innerWidth, window.innerHeight);
      program.uniforms.uResolution.value = [window.innerWidth, window.innerHeight];
    }
    resize();
    window.addEventListener('resize', resize);

    let lastMoveTime = -Infinity;
    function handlePointerMove(event: PointerEvent) {
      program.uniforms.uMouse.value = [event.clientX, window.innerHeight - event.clientY];
      lastMoveTime = performance.now();
    }
    if (!prefersReducedMotion) {
      window.addEventListener('pointermove', handlePointerMove);
    }

    let rafId = 0;
    let running = true;
    let mouseActive = 0;
    const startedAt = performance.now();

    function loop(now: number) {
      if (!running) return;
      program.uniforms.uTime.value = (now - startedAt) / 1000;

      // Ease mouseActive toward 1 while recently moved, toward 0 once idle
      // past IDLE_TIMEOUT_MS — re-engage fast, release slow (see plan §2/3).
      const idleMs = now - lastMoveTime;
      const target = idleMs < IDLE_TIMEOUT_MS ? 1 : 0;
      const duration = target === 1 ? REENGAGE_DURATION_MS : RELEASE_DURATION_MS;
      const step = 1 / (duration / 16.7); // approx per-frame step at 60fps
      mouseActive += (target - mouseActive) * Math.min(step, 1);
      program.uniforms.uMouseActive.value = mouseActive;

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
      window.removeEventListener('pointermove', handlePointerMove);
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
