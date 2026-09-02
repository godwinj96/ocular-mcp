import { useState } from 'react';
import { BentoCell, BentoGrid } from '../components/bento-grid.js';
import { ScrollReveal } from '../components/scroll-reveal.js';
import { MotionCta } from '../components/motion-cta.js';

// Same fallback pattern as pricing.tsx — local dev's dashboard port unless
// the build environment overrides it.
const DASHBOARD_URL = import.meta.env.VITE_DASHBOARD_URL ?? 'http://localhost:3001';

// The real MCP client config shape (mcpServers block) — no vendor-specific
// wrapper, so this is copy-pasteable into Claude Desktop's
// claude_desktop_config.json, Cursor's mcp.json, or any other MCP-spec
// client. `npx -y useocular` is the actual published bin — see
// docs/rules/13-local-worker-and-distribution.md §10.
const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "ocular": {
      "command": "npx",
      "args": ["-y", "useocular"],
      "env": {
        "OCULAR_API_KEY": "your-api-key-here"
      }
    }
  }
}`;

function CopyableBlock({ code, label }: { code: string; label: string }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-xl bg-surface-base p-4 font-mono text-sm text-text-primary">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={`Copy ${label}`}
        className="absolute right-3 top-3 rounded-md border border-white/10 bg-surface-elevated px-2 py-1 font-mono text-xs text-text-secondary transition hover:text-text-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

const STEPS = [
  {
    n: '1',
    title: 'Get an API key',
    body: (
      <>
        <p className="max-w-measure text-text-secondary">
          Ocular validates an active subscription before rendering — even for local-only capture.
          Generate a key from your dashboard.
        </p>
        <MotionCta
          href={`${DASHBOARD_URL}/keys`}
          className="mt-4 inline-block rounded-full bg-accent px-5 py-2 text-sm font-semibold text-surface-base transition hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Open dashboard → Keys
        </MotionCta>
      </>
    ),
  },
  {
    n: '2',
    title: 'Add Ocular to your MCP client',
    body: (
      <>
        <p className="max-w-measure text-text-secondary">
          Paste this into your client's MCP config (Claude Desktop's{' '}
          <code className="font-mono text-text-primary">claude_desktop_config.json</code>, Cursor's{' '}
          <code className="font-mono text-text-primary">mcp.json</code>, or equivalent), swapping in
          the key from step 1.
        </p>
        <div className="mt-4">
          <CopyableBlock code={MCP_CONFIG_SNIPPET} label="MCP config" />
        </div>
      </>
    ),
  },
  {
    n: '3',
    title: 'Restart your client',
    body: (
      <p className="max-w-measure text-text-secondary">
        `npx` fetches Ocular on first launch — no separate install step. Restart your MCP client and
        the five tools (<code className="font-mono text-text-primary">view_page</code>,{' '}
        <code className="font-mono text-text-primary">inspect_ui</code>,{' '}
        <code className="font-mono text-text-primary">extract_assets</code>,{' '}
        <code className="font-mono text-text-primary">motion_capture</code>,{' '}
        <code className="font-mono text-text-primary">get_quota</code>) are available immediately.
      </p>
    ),
  },
  {
    n: '4',
    title: 'Point it at your dev server',
    body: (
      <p className="max-w-measure text-text-secondary">
        Ask your agent to look at{' '}
        <code className="font-mono text-text-primary">localhost:3000</code> (or wherever your dev
        server runs). Local and private-network renders are unmetered and instant — no cloud
        round-trip. The public web routes through Ocular's cloud fleet automatically when needed.
      </p>
    ),
  },
];

export function SetupPage() {
  return (
    <div className="mx-auto max-w-[1000px] px-6 py-16 md:py-24">
      <h1 className="text-display-md font-bold text-text-primary">Connect Ocular</h1>
      <p className="mt-4 max-w-measure text-text-secondary">
        Four steps, a couple of minutes. Your agent gets real eyes on your dev server and the live
        web.
      </p>

      <BentoGrid className="mt-12">
        {STEPS.map((step, index) => (
          <ScrollReveal
            key={step.n}
            index={index}
            className="col-span-2 md:col-span-4 lg:col-span-12"
          >
            <BentoCell span="full" as="article">
              <div className="flex items-start gap-4">
                <span className="font-mono text-2xl font-bold text-accent">{step.n}</span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg font-semibold text-text-primary">{step.title}</h2>
                  <div className="mt-2">{step.body}</div>
                </div>
              </div>
            </BentoCell>
          </ScrollReveal>
        ))}
      </BentoGrid>

      <p className="mt-12 max-w-measure text-text-secondary">
        Read-only. Ocular cannot act on your browser — no clicking, typing, or navigation on your
        behalf.
      </p>
    </div>
  );
}
