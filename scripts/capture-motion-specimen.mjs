// Regenerates the motion section's contact sheet from the Fieldnote specimen.
//
// The sheet shipped on the website is GENUINE `motion_capture` output, not a
// mock of one — that is the whole point of the demo, and this script is how it
// stays true. It drives the local worker's own extractor (`captureMotion`) and
// its own `chrome-headless-shell` connection, i.e. exactly the code path the
// MCP tool runs; it only skips the MCP/subscription wrapper around it, which
// has no effect on pixels.
//
// Run it whenever public/specimens/fieldnote.html changes, or the sheet in the
// site and the page it claims to be a capture of will silently diverge.
//
//   npx tsx scripts/capture-motion-specimen.mjs
//
// Requires: the website dev server on :5173, and OCULAR_HEADLESS_SHELL_PATH in
// packages/local-worker/.env.

import { spawn } from 'node:child_process';
import { mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
process.loadEnvFile(join(root, 'packages/local-worker/.env'));

// Imported from source, not dist: the package bundles to a single
// dist/main.js with no granular entry points, so this script is run through
// tsx. Same modules either way.
const { connectHeadlessShell } = await import(
  '../packages/local-worker/src/browser/headless-shell.ts'
);

const URL_ = process.env.SPECIMEN_URL ?? 'http://localhost:5173/specimens/fieldnote.html';
const PORT = 9333;
const shellPath = process.env.OCULAR_HEADLESS_SHELL_PATH;
if (!shellPath) throw new Error('OCULAR_HEADLESS_SHELL_PATH is not set');

const profile = mkdtempSync(join(tmpdir(), 'ocular-specimen-'));
const shell = spawn(
  shellPath,
  [
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${profile}`,
    '--no-first-run',
    '--disable-gpu',
    '--hide-scrollbars',
  ],
  { stdio: 'ignore' },
);

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// connectHeadlessShell takes the WebSocket URL, not the HTTP one — in
// production the supervisor scrapes it from Chromium's "DevTools listening on
// ws://..." stderr line. /json/version is the equivalent lookup here.
async function browserWsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      const json = await res.json();
      if (json.webSocketDebuggerUrl) return json.webSocketDebuggerUrl;
    } catch {
      /* not up yet */
    }
    await wait(250);
  }
  throw new Error('chrome-headless-shell never opened its CDP port');
}

try {
  const browser = await connectHeadlessShell(await browserWsUrl());
  const page = await browser.newPage();

  // 1440x900 — a desktop layout verified at the browser's 800x600 default is a
  // different layout. This is the `viewport` field motion_capture was missing.
  await page.setViewport(1440, 900);
  await page.navigate(URL_, 30000);
  await wait(600);

  const { captureMotion } = await import(
    '../packages/local-worker/src/extractors/motion-capture.ts'
  );
  // samples: 5 is the SHEET THE SITE SHIPS, and it is a real argument to a
  // real call -- not the extractor default bent to suit the page. The founder
  // chose a 5x1 sheet for the motion section ("lets make it 5x1 for
  // simplicity's sake"); serving that by editing SCROLL_SCRUBBED_SAMPLES would
  // have halved the sampling density for every caller of the tool to fix a
  // website layout. The schema now carries a per-call `samples` knob instead,
  // so the demo stays genuine tool output and the product keeps its default.
  const out = await captureMotion(page, {
    url: URL_,
    mode: 'verification',
    scrollSampling: 'scroll-scrubbed',
    fps: 24,
    diffThreshold: 0.05,
    samples: Number(process.env.SHEET_SAMPLES ?? 5),
    fresh: true,
  });

  const dir = join(root, 'packages/website/src/assets');
  mkdirSync(dir, { recursive: true });
  const sheet = out.contactSheet;
  const outName = process.env.SHEET_NAME ?? 'motion-contact-sheet-1x5.webp';
  writeFileSync(join(dir, outName), Buffer.from(sheet.b64, 'base64'));
  console.log(
    `contact sheet: ${sheet.w}x${sheet.h}, ${sheet.tiles.length} tiles, ${sheet.bytes} bytes`,
  );
  console.log('scrollY per tile:', sheet.tiles.map((t) => t.scrollY).join(', '));

  await browser.close();
} finally {
  shell.kill();
}
