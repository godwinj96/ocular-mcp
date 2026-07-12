# 04 — Open Questions & Baked-in Assumptions

Decisions that still need the founder's input, plus assumptions the plan currently makes so they're visible and challengeable. None of these block starting M0–M2; several should be answered before M5 (guardrails) and M7 (paid fallback).

> **Resolved 2026-07-10:** transport/auth (remote HTTP + OAuth via WorkOS AuthKit, static-key fallback, local stdio deferred), charge policy (full charge on success / half on exhausted failure), billing backend (Bachs + Postgres), hosting (Hetzner EU), full vendor stack — Upstash (Redis), Neon (Postgres), Webshare (datacenter proxy), DataImpulse (residential proxy), Decodo Web Unlocker (Rung-3 paid fallback). See `02` §12–16. **Also resolved:** dashboard scope — minimal self-serve (AuthKit login, plan status + Bachs checkout/portal links, static API key CRUD, quota display), new `packages/dashboard` on Vercel, built as part of M5. See `02` §17 and `05-user-flows.md` Flows 2 & 4.

**Still open, surfaced by `05-user-flows.md` (add before M5/M9 as noted):**
- Lapsed-vs-never-subscribed `UNAUTHORIZED` messaging distinction (Flow 9) — nice-to-have, not MVP-blocking.
- Known-good MCP client list (Flow 8) — needs real-world OAuth+remote-MCP testing before M9.
- ~~Confirm Bachs exposes a hosted customer portal~~ — **Resolved 2026-07-10**: no hosted portal confirmed (only hosted checkout + API-driven lifecycle); `dashboard` builds a minimal in-house cancel-subscription action against Bachs's API. See `02` §17. Re-verify against Bachs's actual docs at M5.

## Needs a decision

1. **Default `detail` level.** `balanced` is assumed. Confirm the default fidelity/token tradeoff you want new users to experience out of the box.

2. **Full-page vs. viewport default for `view_page`.** Assumed viewport-with-smart-scroll capped in height. Confirm whether the default should attempt full-page or fold-height only (impacts token cost and latency).

3. **AuthKit pricing tier at scale.** Free tier covers MVP-scale MCP OAuth; confirm you're comfortable revisiting pricing once user count grows past the free tier's limits (not yet researched — do before M9 launch if user growth looks steep).

4. **Upstash/Neon paid-tier trigger points.** Both chosen vendors are usage-based with no monthly floor, which is ideal at launch but means cost is a moving target — worth a light dashboard alert (e.g., "80% of free-tier commands/CU-hours used this month") before M9 so a growth spike doesn't surprise the budget.

## Assumptions baked into the plan (flag if wrong)

- **Phase 1 targets public web only.** Authenticated/cookie browsing is explicitly deferred (see `02` §10).
- **The developer's LLM client renders `image` content blocks.** Cursor/Claude Desktop/Cline do; if a target client can't display MCP images, `view_page` degrades to metadata-only for that client. Worth verifying against your launch client list.
- **One managed Redis instance in Phase 1**, accepted as a single point of failure with graceful-degradation rules. Fine for launch scale; revisit for Phase 2.
- **`attempts: 1` at the BullMQ layer** — all retry logic lives inside the worker's stealth ladder under the 10s deadline, so the queue never silently re-runs an expensive job.
- **Node LTS everywhere** (workers especially) for native-addon stability; Bun not used.
- **Metrics can start as Redis counters + a lightweight dashboard**; no heavy observability stack required for Phase 1.
- **The per-domain routing memory keys on registrable domain** (eTLD+1), not full URL — assumes anti-bot posture is domain-wide, which is true for the vast majority of Cloudflare/DataDome deployments.

## Things to validate empirically during the build (not guesses to trust)

- Real `RENDER_CONCURRENCY` ceiling on the chosen VPS (start 4; measure RSS under load).
- Real happy-path per-run cost vs. the $0.002 target (proxy bytes dominate; measure on a representative site basket).
- Actual Patchright block rate on a curated basket of Cloudflare/DataDome sites → sets how often Rung 3 fires → validates the daily paid-budget ceiling.
- WebP quality vs. legibility for design-cloning use — confirm q75/1568px keeps text and layout readable enough for the agent to reproduce.
