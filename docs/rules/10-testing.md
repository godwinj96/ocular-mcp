# Ocular — Testing Rules

**Section 10 of 13 · Always Apply**

---

## 0. Test types (all required, minimum 80% coverage per package)

1. **Unit tests** — Zod schemas, `ErrorCode` mapping, image pipeline sizing logic, `BlockClassifier` verdict logic, quota math, extractor DOM-parsing helpers (run against fixture HTML, not live sites).
2. **Integration tests** — `mcp-server`'s full per-request pipeline (§3 of `04-mcp-server-and-auth.md`) against a real Redis/Postgres test instance; `worker`'s job pipeline against a real (but sandboxed) browser instance.
3. **E2E tests** — a small basket of real target sites (mix of easy + Cloudflare-protected) run through the full `mcp-server` → Redis → `worker` → response loop, gating the stealth ladder's actual success rate. Framework: Playwright test runner (already a dependency via Patchright's compatibility surface) driving the MCP client side, or the official MCP inspector tool.

Framework: **Vitest** for unit/integration (fast, native ESM/TS, works well in an npm-workspaces monorepo). Do not introduce Jest alongside it.

---

## 1. What to mock vs. what not to mock

```
NEVER mock:
  - Zod schema validation itself — test against real schemas
  - The SSRF check logic — this is exactly the kind of security-critical path
    that must be tested against real DNS resolution behavior (use a local
    test server bound to a private-range IP to prove the block fires)
  - The result envelope shape — assert against the real ResultEnvelope type

MOCK / stub for unit tests:
  - Redis (ioredis-mock or a local test Redis via docker-compose.dev.yml)
  - Proxy providers (Webshare/DataImpulse/Decodo) — stub RungProfile generation,
    never make real proxy network calls in unit tests
  - Bachs webhooks — replay recorded fixture payloads, never call the real API
  - The target site itself for unit-level extractor tests — serve fixture HTML
    from a local static server, not a live URL

REAL, sandboxed, for integration/E2E:
  - Actual Patchright browser instance (headless)
  - Actual Redis + Postgres (docker-compose.dev.yml services)
  - A small fixed basket of real target URLs for the E2E stealth-ladder suite
```

---

## 2. SSRF test cases (mandatory, security-critical — see `07-security.md` §2)

Every PR touching either SSRF check layer must keep these passing:

```
[ ] Rejects file://, data://, ftp://, javascript: schemes
[ ] Rejects a hostname resolving to 127.0.0.1 / ::1
[ ] Rejects a hostname resolving to an RFC1918 range (10/8, 172.16/12, 192.168/16)
[ ] Rejects 169.254.169.254 (cloud metadata) specifically
[ ] Rejects a hostname resolving to fc00::/7 (ULA)
[ ] Rejects a redirect chain where hop 2 resolves to a private IP even though hop 1 was public
[ ] Rejects a DNS-rebinding scenario (mock resolver returns public IP at pre-check,
    private IP at authoritative check) — proves the worker-side check isn't skippable
[ ] Accepts a normal public HTTPS URL with no redirects
[ ] Correctly normalizes an IDN/punycode URL before checking it
```

---

## 3. Charge-policy test cases

```
[ ] CLEAN render at any rung -> full charge (1.0)
[ ] Exhausted ladder (including attempted Rung 3) -> half charge (0.5)
[ ] Rejected before enqueue (UNAUTHORIZED, INVALID_URL, SSRF_BLOCKED, QUOTA_EXCEEDED) -> no charge
[ ] Quota check under concurrent near-limit requests is atomic, not read-then-write
    (this is a race-condition test — spin up N parallel requests near the cap and assert
    the account never goes negative or over by more than one in-flight request's worth)
```

---

## 4. Fixture-based extractor testing

Design-token and asset extractors are tested against a small library of fixture HTML pages (checked into `packages/worker/src/extractors/__fixtures__/`) covering: a page with CSS custom properties, a page using only inline styles, an SPA with a deeply nested DOM (proving the element-walk cap holds), and a page with relative asset URLs requiring rewriting. Do not write extractor tests that depend on a live third-party site's current markup — it will break the suite when that site redesigns.

---

## 5. Load/soak testing (M8, not every PR)

A multi-hour soak test of a single worker process validates the recycle logic (§4 of `08-performance.md`) and catches unbounded RSS growth before it reaches production. This is a milestone gate (`research & planning/03` §10, M8), not a per-PR CI requirement — track results in `DEVLOG.md` when run.

---

_Rules v1.0 · 2026-07-10 · Ocular Phase 1_
