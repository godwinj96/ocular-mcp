# Ocular — Phase 1 Research & Planning

This directory contains the research, conclusions, and implementation plan for **Phase 1** of Ocular: the local, stdio-based **Vision MCP server** backed by a cloud stealth-browser pool.

> Scope note: Phase 2 (Hosted Context Gateway) and Phase 3 (Enterprise WAF / Computer-Use platform) are explicitly **out of scope** for these documents. Everything here targets shipping the $1/mo consumer utility described in Phase 1 of the project brief.

## Documents (read in order)

| # | File | Purpose |
|---|------|---------|
| 1 | [`01-research-findings.md`](./01-research-findings.md) | Current-state (2026) research on every fast-moving dependency: MCP SDK, stealth browsers, memory management, image/token economics, proxies, design-token extraction. Sourced. |
| 2 | [`02-conclusions-and-recommendations.md`](./02-conclusions-and-recommendations.md) | Decisions distilled from the research, including where I recommend **deviating from the original brief** and why. Read this to understand the "why" behind the plan. |
| 3 | [`03-phase1-architecture-plan.md`](./03-phase1-architecture-plan.md) | The build plan. Core technologies, system architecture, request lifecycle, module breakdown, bottlenecks, edge cases, tradeoffs, and a phased task list. Written to be executed by junior/mid engineers (or a lesser model). |
| 4 | [`04-open-questions.md`](./04-open-questions.md) | Unresolved decisions that need the founder's input before or during build, plus assumptions the plan currently bakes in. |
| 5 | [`05-user-flows.md`](./05-user-flows.md) | Every distinct end-to-end flow (signup, billing, tool calls, escalation, failure, quota exhaustion, key issuance, token expiry, cancellation) with the requirements each one surfaces. |

Enforceable engineering rules derived from these decisions live in [`../docs/rules/`](../docs/rules/) (one file per area: architecture, repo structure, shared contracts, MCP/auth, worker pipeline, external fetching, security, performance, error handling, testing, billing, environment/secrets) — read those before writing code, not just this directory.

## Key decisions locked with the founder (2026-07-10)

1. **Stealth strategy: Hybrid.** In-house patched-browser + proxy-escalation stack is the default; a commercial unblocker API is a pluggable fallback that only fires on repeated challenge failures.
2. **Infra: Self-hosted warm pool, abstracted.** Commit to self-hosted Chromium warm pools for cost, but place a thin `BrowserProvider` interface behind the worker so a managed/serverless browser can be swapped in per-request without rewriting the pipeline.
3. **Cost vs. reliability: Reliability-first with hard caps.** Default to returning a usable result (escalate, retry, fall back), but enforce per-user monthly quotas and per-request cost ceilings so the tail can't sink unit economics.

## The single most important research finding

The original brief's headline tooling choice — **"Playwright over Puppeteer"** — is correct for the *ergonomics* (isolated `BrowserContext`s, auto-waiting) but **wrong as the stealth transport** as of 2026. Anti-bot vendors now fingerprint *how the browser is driven* (the automation protocol / CDP handshake shape), not just the browser's JS-layer fingerprint. Vanilla Playwright and even `rebrowser-playwright` sit at the *bottom* of current Cloudflare benchmarks.

**Resolution:** Use **Patchright** — a drop-in, API-compatible Playwright replacement for Node that patches the CDP leaks — as the default engine. This preserves the entire Playwright programming model and ecosystem the brief committed to, while closing the biggest detection gap. See `02` §1 for the full argument.
