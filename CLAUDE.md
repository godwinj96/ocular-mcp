# Ocular

Cloud-backed stealth-browser MCP server that gives AI agents web vision ($1/mo).

**Before doing anything else in this repo, read `DEVLOG.md` at the repo root.** It has the status board, every locked architecture decision, and the session log. Update it before ending any session that changes plans or ships code.

Full research and architecture plan: `research & planning/00-INDEX.md` (read in numeric order: `01` research → `02` conclusions/decisions → `03` build plan → `04` open questions → `05` user flows).

**Before writing any code, read `docs/rules/`.** It's the enforceable ruleset (one file per area — architecture, repo structure, shared contracts, MCP/auth, worker pipeline, external fetching, security, performance, error handling, testing, billing, environment/secrets) distilled from the planning docs above, meant to prevent drift as the codebase grows. `.cursor/rules/*.mdc` mirrors these for Cursor but is not the source of truth — `docs/rules/*.md` is canonical; edit there.
