# First-run auth and payment — one browser trip

**Status:** designed, not implemented. Founder decision 2026-09-05 (Session 32).
**Closes:** Session 31 addendum items **A** (pricing copy) and **D** (auth rework), which the
addendum correctly insisted be designed together.

> **Founder's call, verbatim shape:**
>
> ```
> $ npx useocular
>
>   Opening your browser to finish setup...
>   → sign in
>   → $2.50/mo, cancel any time
>   ✓ This machine is connected.
>
> (no key, no config file, one visit)
> ```

---

## 1. Why these were one decision

Item A asked what the site should say about "do I pay before I try?". Item D asked how to
replace `OCULAR_API_KEY`. They are the same question asked twice: **the sentence the site
needs is just a description of what happens when someone runs `npx useocular`.** Writing A
first would have described a flow that does not exist; building D first would have let the
implementation decide the pricing story by accident.

The decision: **sign-in and payment are one browser visit, and the machine is not connected
until payment succeeds.** No trial, no free tier, no inert install.

---

## 2. What already exists (and what the addendum underestimated)

The addendum framed D as "the top engineering item", implying a large build. **The cloud
server side is already done.** Verified in Session 32:

| Piece                                                       | State                                                                                                 |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `mcp-server/src/auth/verify-authkit-token.ts`               | Real AuthKit JWKS verification (signature, `aud`, expiry), cached JWKS                                |
| `mcp-server/src/auth/verify-jwt.ts` → `createJwtVerifier`   | Verifies the token, then `findByOauthSubject(claims.sub)`, requires `subscriptionStatus === 'active'` |
| `mcp-server/src/auth/resolve-account.ts` → `resolveAccount` | Tries the AuthKit JWT **first**, falls back to static key                                             |
| `VerifiedAuth.authMethod`                                   | Already a `'oauth' \| 'static_key'` discriminator                                                     |
| `dashboard/lib/bachs.ts` → `createCheckoutSession`          | Bachs checkout already wired                                                                          |
| Dashboard AuthKit session                                   | Already live (the dashboard signs users in today)                                                     |

**Consequence: an access token from the flow below already authenticates against the deployed
cloud server with no server-side change.** `verifyJwt` will verify it, resolve the account by
OAuth subject, and enforce the active-subscription rule that is already written.

What is actually missing is confined to the local worker and one new dashboard route.

---

## 3. The three seams in the local worker

The credential is read in exactly three places. This is the whole blast radius on the client.

1. **`packages/local-worker/src/config.ts:29`** — `apiKey: process.env.OCULAR_API_KEY`
2. **`packages/local-worker/src/http/cloud-client.ts:30-37`** — throws `NoApiKeyError`, else
   sets `authorization: Bearer ${config.apiKey}`
3. **`packages/local-worker/src/subscription/validate.ts` → `createCloudSubscriptionCheck`** —
   reads `process.env.OCULAR_API_KEY` **directly**

> **Pre-existing smell to fix in the same pass:** seam 3 bypasses `config.ts` and re-reads the
> env var itself. Two sources of truth for one credential. It happens to agree today only
> because both read the same variable. Route it through the credential store like the others.

---

## 4. Flow: PKCE with a loopback redirect, orchestrated by the dashboard

### 4.1 Why PKCE and not device code

WorkOS's `authkit/cli-auth` page leads with the Device Authorization Grant, but WorkOS's own
guidance is **"ship both, default to PKCE, and document the `--device` escape hatch"**, and it
reserves device flow for _"headless environments where no local browser is available: SSH
sessions, containers, cloud IDEs, dev VMs."_

Ocular's entire premise is a developer at a machine with a browser and a dev server. PKCE with
a loopback redirect is the right default:

- **No code to type.** Device flow makes the user read a code off a terminal and type it into a
  browser. That is two surfaces and a transcription step, which contradicts the founder's
  "one visit".
- **The callback lands back on the machine**, so the credential is delivered automatically.
- Loopback redirects are supported with a wildcard port (`http://localhost:*/…`), per RFC 8252,
  so the worker can bind a free port at runtime.

**Device flow is the documented fallback**, not the default — see §8.

### 4.2 The sequence

The subtlety: payment must happen **before** a credential is issued, but the user must only
visit the browser once. Solved by making the **dashboard** the redirect target the browser
visits first, and AuthKit's loopback bounce the last hop.

```
local worker                    browser                     dashboard / AuthKit
─────────────────────────────────────────────────────────────────────────────────
1. generate code_verifier
   + S256 code_challenge
   + random `state`
2. bind 127.0.0.1:<free port>
3. open ─────────────────────▶  /connect?redirect_uri=http://127.0.0.1:PORT/callback
                                        &code_challenge=…&state=…
                                                            4. AuthKit session?
                                                               no → sign in
                                                               (screen_hint=sign-up)
                                                            5. subscription active?
                                                               no → Bachs checkout
                                                                    $2.50/mo
                                                               ← returns to /connect
                                                            6. active → 302 to AuthKit
                                                               /user_management/authorize
                                                               response_type=code
                                                               client_id=…
                                                               redirect_uri=http://127.0.0.1:PORT/callback
                                                               code_challenge=…
                                                               code_challenge_method=S256
                                                               state=…
                                                            7. user already has an AuthKit
                                                               session → silent bounce,
                                                               no second login prompt
8. ◀── GET /callback?code=…&state=…
9. verify `state` matches
10. POST /user_management/authenticate
    grant_type=authorization_code
    code, code_verifier, client_id,
    redirect_uri
    → access_token + refresh_token
11. write ~/.ocular/credentials.json
12. serve "You're connected —
    close this tab", shut the
    loopback server down
```

**One visit from the user's point of view.** Steps 4–7 are the same browser tab moving through
sign-in, payment, and a silent redirect.

**PKCE integrity is preserved:** the `code_verifier` never leaves the local worker. The
dashboard only ever sees the `code_challenge`, which is the hash — it cannot mint tokens.

### 4.2a Middleware ordering — a real production failure, fixed

The first live run of this flow failed with `Invalid connect request: code_challenge is
required`, and the cause is worth recording because it is invisible from the sequence above.

The dashboard's `middleware.ts` runs `authkitMiddleware` with `middlewareAuth.enabled: true`,
so **every** route is auth-gated before its handler runs. `/connect` was therefore bounced to
AuthKit sign-in first, and the PKCE parameters had to survive that round trip inside AuthKit's
`returnPathname` state — which carries a **pathname, not a query string**. They did not
survive, so the handler eventually ran with no `code_challenge`.

It also meant the validate-before-anything ordering §4.3 specifies was silently not happening:
the bounce came first. There was no open-redirect exposure — the bounce target is AuthKit, and
a hostile `redirect_uri` was only ever carried as opaque state and then rejected on return —
but the guarantee in force was not the one written down, which is its own problem.

Two changes fix it, and both are load-bearing:

1. `/connect` is added to the middleware's `unauthenticatedPaths`. It is **not** public — the
   handler still calls `getCurrentAccount()`, which requires a session. What changes is
   ordering: the route now validates and persists the request _before_ any redirect.
2. The request is written to the resume cookie _before_ `getCurrentAccount()`, and read back
   when the query string is absent. The cookie was introduced for the checkout round-trip; it
   turns out to be needed for the sign-in round-trip too.

**Generalisable lesson:** any flow carrying state through a third-party auth redirect must own
that state itself. `returnPathname` is a navigation convenience, not a state channel.

### 4.3 The new dashboard route

`/connect` (Next.js, `packages/dashboard`). It is pure orchestration and issues no credential
itself:

- Validates `redirect_uri` is loopback (`127.0.0.1`/`localhost`) with a port. **Reject anything
  else outright** — this is an open-redirect sink otherwise.
- Requires an AuthKit session; `screen_hint=sign-up` on first contact.
- Reads subscription status for the signed-in user; if not `active`, sends them to Bachs
  checkout and returns here on success.
- Only then 302s to AuthKit `/authorize` with the caller's `code_challenge`, `state`, and
  loopback `redirect_uri` passed through untouched.

---

## 5. Credential storage

`~/.ocular/credentials.json` — `{ access_token, refresh_token, expires_at, sub }`.

- **POSIX:** file mode `0600`, directory `0700`.
- **Windows: `chmod` is a no-op.** `fs.chmod` on Windows only toggles the read-only bit and
  gives no per-user ACL. This must be handled explicitly — either a restrictive ACL via
  `icacls`, or DPAPI (`CryptProtectData`) for the token blob. **Do not ship the POSIX path and
  assume Windows inherited it.** Windows is a first-class target here (`win32-x64` is a shipped
  supervisor platform).
- Silent refresh: when `expires_at` is within a skew window, exchange the refresh token at the
  same `/user_management/authenticate` endpoint. Handle **refresh-token rotation** — assume the
  refresh token may be replaced on every exchange and persist the new one atomically
  (write-temp-then-rename, so a crash mid-write cannot leave a truncated credentials file).
- On a definitive refresh failure (revoked, subscription cancelled): clear the store and
  re-enter the §4.2 flow. Do **not** treat it as offline grace — `validate.ts` already draws
  that distinction correctly and it must be preserved.

---

## 6. Interaction with the existing subscription gate

`SubscriptionValidator` in `subscription/validate.ts` is well built and its semantics must not
be weakened. Specifically it already distinguishes:

- `definitive` (server answered — trust and cache it, never grace-extend a definitive "no")
- `network_error` (offline — bounded grace window applies)
- `everConfirmed` (an entry seeded only by a network error never grants grace)

**Mapping the new states onto it:**

| New state                                   | Outcome                                      |
| ------------------------------------------- | -------------------------------------------- |
| No credentials file at all                  | `definitive: false` (same as today's no-key) |
| Access token expired, refresh **succeeded** | proceed; normal check                        |
| Refresh got a definitive rejection          | `definitive: false` — clear store, re-auth   |
| Refresh failed on DNS/timeout               | `network_error` — grace window applies       |

That last row matters: **a failed refresh due to dropped wifi must not read as a cancelled
subscription.** It is the same trap `validate.ts`'s comments already call out for `get_quota`.

---

## 7. Migration and the static key

`resolveAccount` tries JWT first and falls back to static key, so both work during migration —
no flag day.

1. Ship the flow; local worker prefers credentials, still honours `OCULAR_API_KEY` if set.
2. Once the flow is proven, drop `OCULAR_API_KEY` from `config.ts` and `cloud-client.ts`.
3. Then resolve the standing `TODO(M1)` in `resolve-account.ts` — it wants tokens routed by
   prefix/format instead of "try both and catch". Today a static-key request costs a failed
   JWT verification first.
4. Retire `dashboard/lib/keys.ts` issuance (`createApiKey`/`listApiKeys`/`revokeApiKey`) only
   after step 2, and check whether the keys UI is still reachable.

**Only after step 2 does the live site's copy become true.** Until then the gap the founder
knowingly accepted on 2026-09-05 is still open.

---

## 8. Headless fallback

A developer on an SSH box or in a container has no browser for step 3. Ship
`useocular login --device` using the Device Authorization Grant WorkOS documents
(`/user_management/authorize/device`, then `/user_management/authenticate` with
`grant_type=urn:ietf:params:oauth:grant-type:device_code`).

This is a documented escape hatch, not the default path, and **it does not change the pricing
story** — the same subscription check gates it.

---

## 9. The copy that falls out (item A)

The flow makes the copy nearly mechanical. Guardrail from `CLAUDE.md`: ambient pricing, never
premium, never defensive. The argument for pay-first is _the price is too low for a trial to be
worth anyone's time_ — a cheap-product argument, written confidently.

- **`setup-page.tsx` step 02** currently reads "Sign in once". After this ships that is
  literally true — but it must also say payment happens there, or a visitor reads it as free
  sign-up and discovers a paywall. Something in the register of _"Sign in once. $2.50/mo starts
  here — cancel any time."_
- **The CTAs** already carry `from $2.50/mo · unmetered on localhost · cancel any time`.
  "Cancel any time" is honest and is doing the risk-reversal work a trial would do. With the
  paywall stated plainly at step 02, that is probably sufficient — but this needs the real
  copy pass, not a decision made here.
- **`.agents/product-marketing.md` §Goals still records this as unresolved.** Update it in the
  same pass; every marketing skill reads it, and a stale "unresolved" will send the next copy
  agent hunting for a trial that does not exist.
- **Scope test still applies** (`CLAUDE.md`): would the sentence still be the point if the page
  being looked at were one the agent did not write? Pricing copy is not exempt.

---

## 10. Build order

> **STATUS 2026-09-06:** steps 1-4 are **built, tested and committed**. Step 5 (end-to-end on
> a real machine) is blocked only on `OCULAR_AUTH_CLIENT_ID` / a WorkOS redirect-URI
> registration — no code is missing. Steps 6-7 remain.

1. ~~Credential store + refresh + **Windows ACL/DPAPI** (§5)~~ **DONE** — `auth/credential-store.ts`, `auth/access-token.ts`.
2. ~~Loopback callback server + PKCE generation~~ **DONE** — `auth/loopback-server.ts`, `auth/pkce.ts`, `auth/token-client.ts`, orchestrated by `auth/login.ts`.
3. ~~Dashboard `/connect` route, starting with the loopback-only validation~~ **DONE** —
   `dashboard/lib/loopback-redirect.ts` (14 tests) built first, then `app/connect/route.ts`,
   plus `lib/connect-resume.ts` for the post-checkout hop Bachs' fixed `success_url` forces.
4. ~~Swap the three seams (§3), keeping `OCULAR_API_KEY` working~~ **DONE** — via `auth/bearer.ts`. Plus `cli/command.ts` + `main.ts`, which the original order omitted: the flow was unreachable until something invoked it.
5. End-to-end proof on a real machine: fresh install → browser → pay → capture. **BLOCKED on config only** — needs `OCULAR_AUTH_CLIENT_ID` and the loopback redirect URI (`http://localhost:*/callback`) registered in WorkOS.
6. Copy pass (§9).
7. Remove the static key (§7 steps 2–4).

---

## 11. Security checklist

- [ ] Loopback server binds **127.0.0.1 only**, never `0.0.0.0` — a firewall prompt directly
      contradicts the invisibility promise in `CLAUDE.md`.
- [ ] `state` generated with a CSPRNG and compared strictly; reject mismatch.
- [ ] `/connect` rejects any non-loopback `redirect_uri` (open-redirect sink).
- [ ] `code_verifier` never transmitted anywhere except the token exchange.
- [ ] Credentials file `0600` on POSIX **and** genuinely restricted on Windows.
- [ ] Atomic credential writes (temp + rename).
- [ ] Loopback server has a hard timeout and shuts down after one callback.
- [ ] Tokens never logged, never in error messages, never in the a11y tree or capture output.
- [ ] Refresh-token rotation persisted.
