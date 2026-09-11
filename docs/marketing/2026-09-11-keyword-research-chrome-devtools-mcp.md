# Keyword & competitor research — chrome-devtools-mcp

**Run:** 2026-09-11 (Session 38). **Method:** live `WebSearch` + `WebFetch` against primary sources.
**Gate:** this is Phase 3 of the blog plan — the blocking research step that runs _before_ drafting so
findings are not rationalised to fit a pre-written outline.

> **No keyword-volume tool was available and none is assumed here.** Every number below is a
> download count, a star count or a SERP observation — things that were actually fetched. Where a
> volume figure would normally go, this document says so rather than inventing one.

---

## 1. What chrome-devtools-mcp actually is (primary sources, not memory)

| Fact          | Value                                                                                                                                                                                | Source                     |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------- |
| Owner         | Google — `ChromeDevTools/chrome-devtools-mcp`                                                                                                                                        | GitHub repo                |
| Launched      | 2025-09-23                                                                                                                                                                           | Chrome for Developers blog |
| GitHub stars  | **51.6k**                                                                                                                                                                            | repo, fetched 2026-09-11   |
| npm downloads | **1,426,792 / week** (2026-09-04 → 09-10)                                                                                                                                            | `api.npmjs.org`            |
| Price         | Free                                                                                                                                                                                 | —                          |
| Tool count    | **~58 tools** — input automation (10), navigation (6), emulation (2), performance (3), network (2), debugging (9), memory (13), extensions (5), third-party (2), WebMCP (2), PWA (4) | `docs/tool-reference.md`   |

**This is not a scrappy competitor.** It is a Google-official project with 1.4M weekly installs. Any
copy that implies Ocular is the obvious default, or that this thing is a toy, will read as delusional
to a reader who already has it installed. Plan accordingly.

### Its own stated limits, quoted

- Security: it "exposes content of the browser instance to MCP clients allowing them to inspect,
  debug, and modify any data."
- Browser support: "officially supports Google Chrome and Chrome for Testing only."
- Telemetry: usage statistics are **on by default** (`--no-usage-statistics` to opt out); performance
  tools may send trace URLs to Google's CrUX API.
- Locality: "only local Chrome instances are supported… designed to run on the same machine as the
  browser." Remote Chrome is listed as a _possible future direction_, not a feature.

---

## 2. The finding that changes the plan

**Google's own launch framing is the exact sentence CLAUDE.md has rejected twice:**

> "Coding agents face a fundamental problem: they are not able to see what the code they generate
> actually does when it runs in the browser." — Chrome for Developers, 2025-09-23

The incumbent already owns "your agent can't see the UI it just wrote." It has a Google byline,
51.6k stars and 1.4M weekly downloads behind that sentence. A post that opens on the same framing is
not merely too narrow per the scope test — it is **competing on the incumbent's own claim, from
behind**.

This reframes the scope test from an internal style rule into the actual competitive wedge. The one
axis where the comparison genuinely ends is the one CLAUDE.md has been insisting on all along:
**pages the agent did not write.** chrome-devtools-mcp is structurally local-only, by its own
documentation. That is not a gap it forgot to fill — it is what the product is.

**Recommendation: the post's spine is coverage, not speed.** See §3 for why the currently-planned
spine does not survive contact with the source.

---

## 3. The cold-start claim does not survive its own source — FOUNDER DECISION NEEDED

`CLAUDE.md` states: _"Warm the browser on MCP `initialize`, not first capture — converts cold start
from per-call cost (**chrome-devtools-mcp's core problem**) to once-per-session."_ The blog plan's
Phase 4 §3 then makes this "the one legitimate, already-documented differentiation."

The current README says the opposite of that premise:

> "The server will start the browser automatically **once the MCP client uses a tool that requires a
> running browser instance**."

That is a lazy start **once per session**, not per call. The difference Ocular actually has is
warming at `initialize` versus at first tool use — real, but a one-time few-second gap at the start
of a session, not a per-call tax. Whether it was ever per-call, or whether this changed in the year
since launch, is not something this research can establish from the outside.

What _is_ documented on their side is a slower, messier **server** start: an open issue titled "MCP
client for `chrome-devtools` failed to start: request timed out", and a documented Codex-on-Windows
workaround of raising `startup_timeout_ms` to 20000. That is a real friction story, but it is a
reliability anecdote, not a benchmark, and building a headline claim on it would be the same error
in a new coat.

**Three options, and this is the founder's call:**

1. **Drop cold start from the post entirely** and lead on coverage (§2). Safest, and the stronger
   argument anyway.
2. **Keep it, demoted to a minor point, and measure it first** — a real side-by-side timing on one
   machine, published with the method. Honest, and the only version that survives a reader checking.
3. **Keep it as written.** Not recommended: a comparison post's entire value is that it is checkable,
   and this claim is checkable _against the competitor's own README_ in about thirty seconds.

**`CLAUDE.md` itself should be corrected either way** — it currently asserts a competitor fact that
its own cited source does not support, and every future session reads that file as settled.

---

## 4. SERP reality for the four target queries

Observed from live results. No volume data — see the note at the top.

| Query                             | What actually ranks                                                                                                                                                                                  | Read                                                                                                                                                                                                                                                                                                                      |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `chrome devtools mcp alternative` | A DeepYard "Best Chrome DevTools MCP Alternatives 2026" listicle, `huuhka.net` "Chrome DevTools MCP vs agent-browser", a GitHub topic page, an HN thread on WebMCP token efficiency                  | **The query shape is real and already served.** Competition is thin directory content plus one or two genuine posts — beatable with a better document, not a thinner one. Named alternatives in the wild: Playwright MCP, Browser MCP, agent-browser, chrome-debug-mcp, WebMCP, BrowserTools MCP. Ocular appears nowhere. |
| `mcp browser screenshot tool`     | Chrome DevTools MCP explainers dominate; then a long tail of Glama-hosted one-person servers (`mcp-screenshot`, `mcp-browser-agent`, AutoProbeMCP) and hosted APIs (ScreenshotRun, ScreenshotEngine) | **Crowded and low-quality.** This is the "screenshot MCP wrapper" category the plan already identified as follow-on post #2. Little authority to displace.                                                                                                                                                                |
| `ai agent browser vision`         | Mostly Medium/Substack explainers _about chrome-devtools-mcp_, framed as "giving AI agents eyes"                                                                                                     | **The framing term is already colonised by the incumbent.** Note the recurring phrase "AI coding assistants write frontend code they never see rendered" — again the narrow framing.                                                                                                                                      |
| `mcp server for ui testing`       | Applitools Eyes MCP, TestMu/LambdaTest SmartUI, Maestro MCP, Apify's Visual Verification Agent, MCP Inspector                                                                                        | **Wrong neighbourhood — do not target.** This SERP is owned by the QA/visual-regression vendors `.agents/product-marketing.md` names as the anti-persona, and CLAUDE.md rules out a Percy/Chromatic post for the same reason. Ranking here would attract the buyer we intend to say no to.                                |

**Unexpectedly strong adjacent shape:** `playwright mcp vs chrome devtools mcp` returned six
substantial competing posts (Trackingplan, test-lab.ai, Steve Kinney, qtrl.ai, mastalerz.it,
mcp.directory). Developers clearly search "X MCP vs Y MCP". That validates the _format_ of the
planned post even though that specific pairing is contested.

### Primary target

The plan predicted `ocular vs chrome devtools mcp` would be near-zero and should not be primary.
Confirmed — Ocular appears nowhere in any SERP sampled. **Primary target:
`chrome devtools mcp alternative`.** Secondary: the `X vs Y` shape, since that is demonstrably how
this audience searches.

**Honest caveat:** with no volume data, "primary" here means _most plausible given observed SERP
shape and competitor behaviour_ — not a measured decision. Revisit once Search Console has real
impression data, which is a better source than any keyword tool would have been anyway.

---

## 5. What the post can and cannot claim

**Can, sourced to their own docs:**

- chrome-devtools-mcp is local-only by design. Ocular's second half is pages the agent did not write.
- chrome-devtools-mcp can _act_ — 10 input-automation tools plus navigation. Ocular structurally
  cannot. This is the honest concession, and it is also the disqualifier for the anti-persona.
- It is free and Google-official. Say so plainly and early; a reader who has it installed knows.
- ~58 tools versus Ocular's four. Frame as a difference in surface area, not as bloat — the sneer is
  unearned and the reader can count.

**Cannot:**

- Any per-call cold-start claim, pending §3.
- Any safety framing built on their "modify any data" warning or their default-on telemetry. It is
  tempting and it is checkable, but CLAUDE.md forbids Ocular's side of that sentence (never "safe to
  use with sensitive data"), and a security argument that only runs one way is what gets a vendor
  post correctly dismissed. Capability boundary only.
- Any mechanism-based superiority — no engine, no stealth ladder, no caching, no diffing. CLAUDE.md
  lists all of it as already-public practice.

---

## Sources

- [ChromeDevTools/chrome-devtools-mcp (GitHub)](https://github.com/ChromeDevTools/chrome-devtools-mcp)
- [Tool reference](https://raw.githubusercontent.com/ChromeDevTools/chrome-devtools-mcp/main/docs/tool-reference.md)
- [Chrome DevTools (MCP) for your AI agent — Chrome for Developers, 2025-09-23](https://developer.chrome.com/blog/chrome-devtools-mcp)
- [npm download counts](https://api.npmjs.org/downloads/point/last-week/chrome-devtools-mcp)
- [Best Chrome DevTools MCP Alternatives 2026 — DeepYard](https://deepyard.dev/mcp-servers/chrome-devtools-mcp/alternatives)
- [Browser verification for coding agents: Chrome DevTools MCP vs agent-browser](https://www.huuhka.net/browser-verification-for-coding-agents-chrome-devtools-mcp-vs-agent-browser/)
- [Playwright vs. Chrome DevTools MCP: Driving vs. Debugging — Steve Kinney](https://stevekinney.com/writing/driving-vs-debugging-the-browser)
- [Chrome DevTools MCP vs Playwright MCP — Trackingplan](https://www.trackingplan.com/blog/chrome-devtools-mcp-vs-playwright-mcp-digital-analysts)
- [Show HN: WebMCP token efficiency](https://news.ycombinator.com/item?id=46223714)
