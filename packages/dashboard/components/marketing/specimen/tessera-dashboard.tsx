'use client';

import { useEffect, useRef } from 'react';

// Specimen page B — a fictional analytics dashboard, rendered as DOM at a
// notional 1440x900 and scaled into a demo frame.
//
// WHY A SECOND SPECIMEN EXISTS. The hero and the tree readout were both
// rendering NorthsoundCheckout. The founder's call: "you can't recycle the
// same page from the hero area to the first demonstration." He is right for a
// reason worth writing down — the two sections make different claims, and
// showing the same page twice invites the reader to think the second section
// is a restatement of the first rather than a new argument.
//
// WHY A DASHBOARD SPECIFICALLY. This section's whole payload is that the
// picture and the tree have holes only the other can fill, and a dashboard
// supplies both holes honestly rather than by contrivance:
//
//   - The chart is a real <canvas> with no accessible name. A tree can see
//     that a node exists and can say nothing whatever about what it plots.
//     That is not a staged weakness; it is the actual, permanent limit of
//     DOM-only tooling, and it is the reason this product renders pixels.
//   - The table runs past the 16/10 crop, so its rows are invisible to the
//     picture and perfectly legible to the tree.
//
// A checkout form has neither property naturally.
//
// The tree rows are NOT transcribed from this file. Every element the tree
// lists carries data-tree-role/data-tree-name here, and the readout measures
// their real geometry at runtime (see hooks/use-tree-rows.ts). Coordinates
// that are typed by hand are a claim nothing checks; these cannot drift.
//
// It shares nothing with our chrome, and nothing with Northsound either: a
// cool slate ground against Northsound's warm neutral, a blue accent against
// its terracotta, tabular figures and a dense data-UI rhythm against its
// roomy consumer form. Two specimens that look alike read as one house style
// rather than as two different sites being observed.

// The latency histogram the canvas actually paints.
//
// Right-skewed, as a real response-time distribution is, and shaped so that
// 95% of the mass falls below 250ms — which is what makes the "p95 241 ms" KPI
// above it and this chart the same claim rather than two unrelated numbers.
// A specimen whose own figures disagree is a specimen a careful reader stops
// believing, and this page's entire job is to be believed.
const BUCKETS = [600, 1800, 2600, 2100, 1000, 220, 90, 40, 20, 10, 8];
/** Upper edge of each bucket, in ms; the last is an overflow bin. */
const BUCKET_MS = 50;
const P95_MS = 241;
const AXIS_TICKS = [0, 100, 200, 300, 400, 500];

const ROWS = [
  { region: 'eu-west-1', p95: '214 ms', err: '0.02%', reqs: '1,284,902' },
  { region: 'us-east-1', p95: '188 ms', err: '0.01%', reqs: '3,940,117' },
  { region: 'ap-south-1', p95: '402 ms', err: '0.14%', reqs: '612,455' },
  { region: 'sa-east-1', p95: '365 ms', err: '0.04%', reqs: '208,730' },
];

export function TesseraDashboard() {
  const chartRef = useRef<HTMLCanvasElement>(null);

  // Drawn on mount, once. The backing store is sized from the element's own
  // layout box rather than from hard-coded attributes: the canvas is stretched
  // to `width: 100%` by specimen.css, so fixed 1180x230 attributes were being
  // scaled to roughly 1328x330 and would have rendered any type inside the
  // chart visibly squashed on one axis.
  useEffect(() => {
    const canvas = chartRef.current;
    if (!canvas) return;
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w < 1 || h < 1) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.scale(dpr, dpr);

    // Palette read from the specimen's own custom properties, so the chart
    // cannot drift from the page it sits on.
    const css = getComputedStyle(canvas);
    const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    const line = read('--spec-line', '#dde3ed');
    const accent = read('--spec-accent', '#2f5fa8');
    const ink3 = read('--spec-ink-3', '#97a0b5');
    const ink2 = read('--spec-ink-2', '#56607a');

    const padL = 24;
    const padR = 24;
    const padT = 22;
    const padB = 34;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;
    const maxMs = BUCKETS.length * BUCKET_MS;
    const xOf = (ms: number) => padL + (ms / maxMs) * plotW;

    ctx.clearRect(0, 0, w, h);

    // Horizontal gridlines — four, unlabelled. They give the bars something to
    // sit against without turning the chart into a table of numbers.
    ctx.strokeStyle = line;
    ctx.lineWidth = 1;
    for (let i = 1; i <= 4; i++) {
      const y = Math.round(padT + (plotH / 4) * i) + 0.5;
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(padL + plotW, y);
      ctx.stroke();
    }

    // Bars.
    const peak = Math.max(...BUCKETS);
    const slot = plotW / BUCKETS.length;
    const gap = 4;
    ctx.fillStyle = accent;
    BUCKETS.forEach((count, i) => {
      const barH = Math.max(1, (count / peak) * plotH);
      ctx.fillRect(padL + i * slot + gap / 2, padT + plotH - barH, Math.max(1, slot - gap), barH);
    });

    // The p95 marker. Dashed so it reads as an annotation over the data rather
    // than as another series, and labelled with the same figure the KPI row
    // above states.
    const px = Math.round(xOf(P95_MS)) + 0.5;
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = ink2;
    ctx.beginPath();
    ctx.moveTo(px, padT - 6);
    ctx.lineTo(px, padT + plotH);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = ink2;
    ctx.font = '500 13px ui-sans-serif, system-ui, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(`p95 · ${P95_MS} ms`, px + 7, padT - 8);

    // X axis.
    ctx.strokeStyle = line;
    ctx.beginPath();
    ctx.moveTo(padL, Math.round(padT + plotH) + 0.5);
    ctx.lineTo(padL + plotW, Math.round(padT + plotH) + 0.5);
    ctx.stroke();

    ctx.fillStyle = ink3;
    ctx.font = '13px ui-sans-serif, system-ui, sans-serif';
    ctx.textAlign = 'center';
    AXIS_TICKS.forEach((ms) => {
      ctx.fillText(`${ms}`, xOf(ms), padT + plotH + 10);
    });
    ctx.textAlign = 'left';
    ctx.fillText('ms', padL + plotW - 14, padT + plotH + 10);
  }, []);

  return (
    <div className="specimen specimen-b">
      <header className="specimen-bar" data-tree-role="header" data-tree-name='"Tessera"'>
        <span className="specimen-wordmark">Tessera</span>
        <nav className="specimen-steps">
          <span className="specimen-step-on">Overview</span>
          <span>Traces</span>
          <span>Alerts</span>
        </nav>
        <span className="specimen-help">rowan@fastmail.com</span>
      </header>

      <div className="spec-b-body">
        <h1 className="specimen-h1" data-tree-role="h1" data-tree-name='"Latency overview"'>
          Latency overview
        </h1>
        <p className="specimen-sub">Last 24 hours · all services · refreshed 40 seconds ago</p>

        <div className="spec-b-kpis">
          <div className="spec-b-kpi">
            <span className="spec-b-kpi-label">p95 latency</span>
            <span className="spec-b-kpi-value">241 ms</span>
            <span className="spec-b-kpi-delta">−12.4% vs yesterday</span>
          </div>
          <div className="spec-b-kpi">
            <span className="spec-b-kpi-label">Error rate</span>
            <span className="spec-b-kpi-value">0.04%</span>
            <span className="spec-b-kpi-delta">−0.01pp vs yesterday</span>
          </div>
          <div className="spec-b-kpi">
            <span className="spec-b-kpi-label">Requests</span>
            <span className="spec-b-kpi-value">6.04M</span>
            <span className="spec-b-kpi-delta">+3.1% vs yesterday</span>
          </div>
        </div>

        <h2 className="specimen-h2">Response time distribution</h2>
        {/*
          A real canvas element, deliberately unlabelled, and — as of round 8 —
          with something actually drawn in it.
          
          It shipped empty, and the founder read the section as broken: "there's
          nothing under 'Response time distribution'. I assume there's supposed
          to be a table there." Fair. An empty bordered rectangle reads as a
          dashboard that failed to load, not as a chart.

          Painting it STRENGTHENS the section's claim rather than compromising
          it. The claim is that an element tree can tell your agent a canvas
          exists and nothing whatever about what it plots. An empty canvas makes
          that trivially true and visually broken; a canvas with a real
          distribution in it makes exactly the same claim while showing what is
          being lost. The demo was arguing its point by having nothing to lose.

          The tree below still reports `canvas [no accessible name]`, because
          that is still genuinely all a tree can know about it.
        */}
        <canvas
          ref={chartRef}
          className="spec-b-chart"
          data-tree-role="canvas"
          data-tree-name="[no accessible name]"
        />

        {/* Past the 16/10 crop: visible to the tree, invisible to the picture. */}
        <h2 className="specimen-h2" data-tree-role="h2" data-tree-name='"Slowest regions"'>
          Slowest regions
        </h2>
        <table className="spec-b-table" data-tree-role="table" data-tree-name='"Slowest regions"'>
          <thead>
            <tr>
              <th>Region</th>
              <th>p95</th>
              <th>Errors</th>
              <th>Requests</th>
            </tr>
          </thead>
          <tbody>
            {ROWS.map((r) => (
              <tr key={r.region}>
                <td>{r.region}</td>
                <td>{r.p95}</td>
                <td>{r.err}</td>
                <td className="spec-b-num">{r.reqs}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="specimen-micro">
          Sampled at 1% · figures are illustrative and do not describe a real service.
        </p>
      </div>
    </div>
  );
}
