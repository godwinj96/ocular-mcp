// KPI probe — drives the local worker over real MCP stdio and reports the
// numbers that matter for dogfooding cost: latency (cold vs. cached), the
// payload split between screenshot and a11y tree, and how much of that tree
// is semantically empty wrapper nodes.
//
// Deliberately speaks raw MCP stdio rather than importing the worker's own
// modules: it measures what an MCP *client* actually receives, which is the
// thing that lands in an agent's context window and gets billed. Measuring
// the internals would miss serialization overhead entirely.
//
// Usage:
//   node packages/local-worker/scripts/kpi-probe.mjs <worker-dist-main.js> [url]
//
// Requires the target URL to be serving, and — because the worker validates
// its subscription on startup — the cloud mcp-server running on
// OCULAR_CLOUD_MCP_URL. See docs/dogfooding/README.md.
import { spawn } from 'node:child_process';

const WORKER = process.argv[2];
const URL_ = process.argv[3] ?? 'http://localhost:5173';

if (!WORKER) {
  console.error('Usage: node kpi-probe.mjs <path-to-local-worker/dist/main.js> [url]');
  process.exit(1);
}

const proc = spawn('node', [WORKER], { stdio: ['pipe', 'pipe', 'pipe'] });
let buf = '';
const pending = new Map();

proc.stdout.on('data', (chunk) => {
  buf += chunk.toString();
  let i;
  while ((i = buf.indexOf('\n')) >= 0) {
    const line = buf.slice(0, i).trim();
    buf = buf.slice(i + 1);
    if (!line) continue;
    try {
      const msg = JSON.parse(line);
      if (msg.id && pending.has(msg.id)) {
        pending.get(msg.id)(msg);
        pending.delete(msg.id);
      }
    } catch {
      // Non-JSON stdout line (a log). Ignored — only JSON-RPC frames matter.
    }
  }
});

let nextId = 1;
function send(method, params) {
  const id = nextId++;
  return new Promise((resolve) => {
    pending.set(id, resolve);
    proc.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}

function roleHistogram(node, counts = {}, emptyGeneric = { n: 0 }) {
  const role = node.role ?? 'unknown';
  counts[role] = (counts[role] ?? 0) + 1;
  // A `generic` node with no accessible name is a layout wrapper: it tells an
  // agent nothing the screenshot doesn't already show, but still costs tokens.
  if (role === 'generic' && !node.name) emptyGeneric.n++;
  for (const c of node.children ?? []) roleHistogram(c, counts, emptyGeneric);
  return { counts, emptyGeneric };
}

const t0 = Date.now();
await send('initialize', {
  protocolVersion: '2024-11-05',
  capabilities: {},
  clientInfo: { name: 'kpi-probe', version: '1.0' },
});
const initializeMs = Date.now() - t0;

const results = [];
for (const label of ['cold', 'warm']) {
  const t = Date.now();
  const res = await send('tools/call', {
    name: 'view_page',
    // `fresh` on the first pass forces a real render; the second pass is left
    // cacheable so the pair measures the cache's actual effect.
    arguments: { url: URL_, detail: 'balanced', fresh: label === 'cold' },
  });
  const latencyMs = Date.now() - t;

  const content = res.result?.content ?? [];
  const image = content.find((c) => c.type === 'image');
  const text = content.find((c) => c.type === 'text');
  const imageBytes = image?.data ? Buffer.from(image.data, 'base64').length : 0;
  const textBytes = text?.text ? Buffer.byteLength(text.text) : 0;

  let treeStats = null;
  try {
    const parsed = JSON.parse(text.text);
    if (parsed.a11yTree?.root) {
      const { counts, emptyGeneric } = roleHistogram(parsed.a11yTree.root);
      const totalNodes = Object.values(counts).reduce((a, b) => a + b, 0);
      treeStats = {
        totalNodes,
        emptyGenericNodes: emptyGeneric.n,
        emptyGenericPct: +((emptyGeneric.n / totalNodes) * 100).toFixed(1),
        roles: Object.fromEntries(Object.entries(counts).sort((a, b) => b[1] - a[1])),
      };
    }
  } catch {
    // Tool returned non-JSON text (an error string, most likely) — leave null.
  }

  results.push({
    pass: label,
    latencyMs,
    imageKB: +(imageBytes / 1024).toFixed(1),
    a11yKB: +(textBytes / 1024).toFixed(1),
    // Both are estimates, not billing truth: Claude bills images at roughly
    // (w*h)/750 tokens, and ~4 bytes/token is a serviceable proxy for dense
    // JSON. Good enough to compare the two against each other by an order of
    // magnitude, which is the question this probe exists to answer.
    estImageTokens: Math.round((800 * 600) / 750),
    estA11yTokens: Math.round(textBytes / 4),
    treeStats,
  });
}

console.log(JSON.stringify({ url: URL_, initializeMs, results }, null, 2));
proc.kill();
process.exit(0);
