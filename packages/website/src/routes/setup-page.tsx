import { useState } from 'react';
import { BleedRule } from '../components/section-header.js';

// Round 5 — four steps become two, and the API key is gone from both.
//
// NOTE: this page describes the PLANNED one-time browser sign-in, not today's
// paste-an-API-key setup. Do not ship to production before the AuthKit rework
// lands (DEVLOG tracked backlog: "users must never fiddle with API keys").
// The whole reason to write it now is that the config block below is the
// thing being simplified, and its shape drives that work.
//
// The real MCP client config shape (mcpServers block) — no vendor-specific
// wrapper, so it is copy-pasteable into Claude Code, Cursor, Windsurf, Cline,
// Zed, Claude Desktop, or any other MCP-spec client. `npx -y useocular` is the
// actual published bin — see docs/rules/13-local-worker-and-distribution.md §10.
const MCP_CONFIG_SNIPPET = `{
  "mcpServers": {
    "ocular": {
      "command": "npx",
      "args": ["-y", "useocular"]
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
      <pre className="overflow-x-auto rounded border border-rule-divider bg-surface-elevated p-5 font-mono text-[13px] leading-[1.7] text-text-primary">
        <code>{code}</code>
      </pre>
      <button
        type="button"
        onClick={() => void handleCopy()}
        aria-label={`Copy ${label}`}
        className="absolute right-3 top-3 rounded-full border border-rule-mark px-3 py-1 font-mono text-[11px] tracking-[0.02em] text-text-quaternary transition-colors duration-fast hover:text-text-primary"
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
    </div>
  );
}

export function SetupPage() {
  return (
    <div className="pt-[136px]">
      <section
        className="pb-sec"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto max-w-[1240px]">
          <p className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-text-quaternary">
            Setup
          </p>
          <h1 className="mt-6 max-w-[16ch] text-[clamp(2.25rem,1.5rem+2.6vw,4rem)] font-normal leading-[1.0] tracking-[-0.022em] [text-wrap:balance]">
            <span className="text-text-quaternary">Two steps.</span>
            <span className="font-semibold text-text-primary"> One of them is a paste.</span>
          </h1>
          <p className="mt-7 max-w-[46ch] text-[clamp(1.0625rem,0.88rem+0.68vw,1.375rem)] leading-[1.4] tracking-[-0.012em] text-text-secondary [text-wrap:pretty]">
            Works with any MCP client: Claude Code, Cursor, Windsurf, Cline, Zed, Claude Desktop.
            There&rsquo;s nothing client-specific in the config.
          </p>
        </div>
      </section>

      <BleedRule />

      <section
        className="py-sec-lg"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto grid max-w-[1240px] grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-16">
          <div>
            <p className="font-mono text-[11px] leading-none tracking-[0.16em] text-text-quaternary">
              01
            </p>
            <h2 className="mt-4 text-[24px] font-medium leading-[1.2] tracking-[-0.018em] text-text-primary">
              Add one line to your MCP config
            </h2>
            <p className="mt-4 max-w-[46ch] text-[16px] leading-[1.6] text-text-secondary">
              That&rsquo;s the whole config. No key in it, so there&rsquo;s nothing to rotate and
              nothing to leak if the file ends up somewhere it shouldn&rsquo;t.
            </p>
            <div className="mt-7">
              <CopyableBlock code={MCP_CONFIG_SNIPPET} label="MCP config" />
            </div>
          </div>

          <div>
            <p className="font-mono text-[11px] leading-none tracking-[0.16em] text-text-quaternary">
              02
            </p>
            <h2 className="mt-4 text-[24px] font-medium leading-[1.2] tracking-[-0.018em] text-text-primary">
              Sign in once, in the browser
            </h2>
            <p className="mt-4 max-w-[46ch] text-[16px] leading-[1.6] text-text-secondary">
              The first time your agent asks to look at something, Ocular opens a browser tab and
              asks who you are. One click, then it closes. You won&rsquo;t be asked again on this
              machine.
            </p>
            <div className="mt-7 divide-y divide-rule-divider border-y border-rule-divider font-mono text-[12.5px] leading-[2.2]">
              <div className="flex items-baseline justify-between gap-6 py-2">
                <span className="text-text-secondary">agent connects</span>
                <span className="text-text-quaternary">browser warms up</span>
              </div>
              <div className="flex items-baseline justify-between gap-6 py-2">
                <span className="text-text-secondary">first capture</span>
                <span className="text-text-quaternary">sign-in tab opens once</span>
              </div>
              <div className="flex items-baseline justify-between gap-6 py-2">
                <span className="text-text-primary">every capture after</span>
                <span className="text-signal">connected</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      <BleedRule />

      <section
        className="py-sec-lg"
        style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
      >
        <div className="mx-auto max-w-[1240px]">
          <h2 className="max-w-[18ch] text-[clamp(2rem,1.15rem+2.9vw,3rem)] font-medium leading-[1.0] tracking-[-0.022em] text-text-primary [text-wrap:balance]">
            Then just ask.
          </h2>
          <p className="mt-7 max-w-[46ch] text-[17px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
            Your agent decides when to look. You don&rsquo;t call a tool, and you don&rsquo;t paste
            a screenshot. You tell it what you&rsquo;re building and it checks its own work.
          </p>
          <div className="mt-9 max-w-[52ch] border-y border-rule-divider py-6 font-mono text-[13px] leading-[1.8] text-text-secondary">
            &ldquo;the plan cards break at 1280 — fix it and make sure it actually renders&rdquo;
          </div>
        </div>
      </section>
    </div>
  );
}
