# Ocular — Architecture Rules

**Section 1 of 12 · Always Apply**

> Full rationale for every decision here lives in `research & planning/02-conclusions-and-recommendations.md` and `research & planning/03-phase1-architecture-plan.md`. This file is the enforceable summary — if the two ever disagree, the planning doc's _reasoning_ wins but this file's _rule_ is what code must follow; update this file in the same PR that changes the decision.

---

## 0. The one deployable topology (Phase 1)

```
Agent (Claude/Cursor/ChatGPT/Claude.ai)
   │  Streamable HTTP MCP, Bearer: AuthKit JWT or static key
   ▼
mcp-server  (stateless, N replicas, Fastify + @modelcontextprotocol/sdk)
   │  verify token → SSRF pre-check → quota check (Redis) → enqueue (BullMQ)
   ▼
Redis  (queue + quota + routing memory)
   │
   ▼
worker  (1 process per VPS, warm Patchright browser, render semaphore)
   │  StealthLadder → extractor → sharp image pipeline
   ▼
result envelope → back through mcp-server → MCP content blocks → agent

Async, off the hot path: Bachs (billing) ──webhooks──▶ Postgres ◀──reads── mcp-server
```

There is no separate "API gateway" package. `mcp-server` **is** the internet-facing MCP service. `packages/dashboard` (added 2026-07-10, see `research & planning/02` §17) is a second, deliberate HTTP-facing package for the human-facing surface only — it never speaks MCP and is not a second "API gateway" in the sense this rule warns against. Do not introduce a _third_ HTTP-facing package without updating this file and the plan doc first.

---

## 1. Package boundaries (non-negotiable)

| Package               | Owns                                                                                                                       | Never does                                                                                                         |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `packages/shared`     | Zod schemas, result envelope, `ErrorCode` enum, job payload type, tool contracts                                           | Import from `mcp-server`, `worker`, or `dashboard`. No I/O, no side effects, no `fetch`/`fs`/Redis clients.        |
| `packages/mcp-server` | Token verification, SSRF pre-check, quota check, enqueue, await, MCP protocol mapping                                      | Launch a browser. Talk to a proxy. Run extractors. Serve any non-MCP HTTP route. Anything that touches Patchright. |
| `packages/dashboard`  | AuthKit login, plan status + Bachs checkout/portal links, static API key CRUD, quota display (Next.js, deployed to Vercel) | Speak MCP. Touch the render pipeline, BullMQ queue, or a browser. Duplicate billing logic Bachs already hosts.     |
| `packages/worker`     | BullMQ consumption, `BrowserProvider`, `StealthLadder`, extractors, `sharp` pipeline                                       | Speak MCP. Verify OAuth tokens. Own the public HTTP surface.                                                       |

`shared` is the contract. If a type or schema is needed by two or more of `mcp-server`/`worker`/`dashboard`, it goes in `shared` — never duplicated, never re-exported through one service into another.

**Rule of thumb when unsure where code goes:** if it needs a live browser or proxy, it's `worker`. If it needs to be internet-reachable and speak MCP/OAuth to an agent, it's `mcp-server`. If it's a human clicking buttons in a browser (login, keys, billing links), it's `dashboard`. If it's a pure type/schema/constant more than one of these needs, it's `shared`.

---

## 2. Request lifecycle (the sequence every tool call follows)

1. Agent calls a tool (`view_page`, `inspect_ui`, `extract_assets`, `get_quota`) over Streamable HTTP.
2. `mcp-server`: verify bearer token (AuthKit JWT via JWKS, or static key via Postgres lookup) → **fail closed** on any verification error.
3. `mcp-server`: Zod-validate tool args → SSRF pre-check the URL → atomic quota check in Redis → reject before enqueue if over cap.
4. `mcp-server`: enqueue a BullMQ job `{ tool, args, account, requestId, deadlineMs }` with `attempts: 1`, await completion up to `SERVER_AWAIT_MS`.
5. `worker`: pull job → acquire render semaphore → **authoritative** SSRF re-check (resolve-time, DNS can rebind) → routing-memory lookup for starting rung → `StealthLadder.run()`.
6. `worker`: on `CLEAN` verdict, run the tool-specific extractor → `sharp` image pipeline → build success envelope. On exhausted ladder, build a half-charge failure envelope. Always `finally`: close context/page, release semaphore, bump recycle counter.
7. `mcp-server`: map the envelope to MCP content blocks (image + text) or an MCP error, respond.

A single monotonic deadline (`Date.now() + JOB_DEADLINE_MS`) is threaded through every step from job creation onward. Never start a stage that cannot finish before the deadline — check the budget before, not after.

---

## 3. The `BrowserProvider` abstraction is load-bearing

`worker` never calls Patchright/Playwright APIs directly outside of one file: the `SelfHostedProvider` implementation of `BrowserProvider`. Every other part of the pipeline (`StealthLadder`, extractors, image pipeline) depends only on the `BrowserProvider` interface and the `BrowserContext`/`Page` objects it returns.

```typescript
interface BrowserProvider {
  init(): Promise<void>;
  newContext(profile: RungProfile): Promise<BrowserContext>;
  recycle(): Promise<void>;
  health(): ProviderHealth;
  dispose(): Promise<void>;
}
```

Why this matters: it's the documented exit hatch to a managed-browser backend (`ManagedBrowserProvider`) without touching the pipeline. Any code that imports `patchright` directly outside `providers/self-hosted-provider.ts` is a rule violation — route it through the interface.

Rung-3 (paid unblocker) is **not** a `BrowserProvider` — it's a separate `UnblockerClient` called by the ladder only after browser rungs are exhausted, since it returns rendered HTML/screenshot over HTTP rather than a live page.

---

## 4. Tools are the product surface — keep them separate

Four MCP tools, never collapsed into one tool with a `mode` flag: `view_page`, `inspect_ui`, `extract_assets`, `get_quota`. Each tool has its own Zod input schema and its own handler in `mcp-server`, and its own extractor (where applicable) in `worker`. An agent's token cost should match its intent — a `mode` flag would force every caller to pay for the union of all tools' documentation.

If a fifth tool is ever proposed, it must justify why it isn't better expressed as a parameter on an existing tool (and vice versa) before being added — see `research & planning/04-open-questions.md` for the standing bar.

---

## 5. Deferred / explicitly out of scope for Phase 1

Do not build these without a corresponding update to `research & planning/02` and this file:

- Local stdio MCP packaging (tracked as a fast-follow — see plan §13).
- Cookie/authenticated-page browsing (needs its own threat model first).
- `ManagedBrowserProvider` implementation (interface exists; implementation is a Phase-2+ concern).
- Any second stealth engine (Camoufox) beyond the interface allowing it later.

---

## 6. When architecture and code disagree

If implementing a milestone reveals the locked architecture is wrong (not just inconvenient), stop and update `research & planning/02-conclusions-and-recommendations.md` with the new decision and rationale _before_ writing the code that deviates. Silent architecture drift is the exact failure mode this rules directory exists to prevent.
