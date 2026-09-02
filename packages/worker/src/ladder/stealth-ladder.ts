// Iterates rungs from the routing-memory starting point up to maxRung, capped
// at MAX_ESCALATIONS beyond the start. See docs/rules/05-worker-and-browser-pipeline.md §3.
//
// Full multi-rung escalation (proxy pools, Camoufox, paid unblocker) is M3
// work per DEVLOG.md — only rung 0 (dc-proxy, proxyless) has a real profile
// today (see rung-profiles.ts), so in practice this ladder tries rung 0 and
// reports EXHAUSTED if that's not CLEAN. The loop structure is real so M3
// only needs to add rung profiles/vendor wiring, not rewrite this file.

import { MAX_ESCALATIONS, MAX_REDIRECT_HOPS } from '@ocular/shared';
import { classifyBlock } from './block-classifier.js';
import { getRungProfile, RUNG_NAMES } from './rung-profiles.js';
import { UnblockerClient } from './unblocker-client.js';
import { getStartingRung, recordSuccess } from '../routing-memory/redis-routing-memory.js';
import type {
  SelfHostedProvider,
  Page,
  BrowserContext,
} from '../providers/self-hosted-provider.js';
import { authoritativeSsrfCheck } from '../ssrf/authoritative-check.js';
import { tryReservePaidBudget } from './paid-budget.js';

const unblockerClient = new UnblockerClient();

// Rung index 3 ('paid-unblocker') isn't a BrowserProvider profile — Decodo's
// Site Unblocker (see unblocker-client.ts) hands back raw unblocked HTML via
// a plain synchronous HTTP fetch, not a browser session. To keep the rest of
// the pipeline (screenshot/a11y-tree/asset extraction) working unchanged, the
// returned HTML is loaded into an otherwise-ordinary browser context via
// page.setContent — Decodo did the anti-bot work; our own browser just needs
// somewhere to render the result for capture.
async function tryPaidUnblockerRung(
  provider: SelfHostedProvider,
  url: string,
  deadlineMs: number,
): Promise<{ page: Page; context: BrowserContext } | null> {
  const remainingMs = deadlineMs - Date.now();
  // See docs/rules/06-external-fetching-and-egress.md §2 — don't start a
  // stage that can't plausibly finish in the remaining budget.
  const MIN_VIABLE_UNBLOCKER_MS = 3000;
  if (remainingMs < MIN_VIABLE_UNBLOCKER_MS) return null;

  // Global daily circuit breaker (docs/rules/08-performance.md §0/§3) — a
  // real vendor-cost exposure, not just quota gating, so this check happens
  // regardless of the requesting account's own remaining quota.
  const withinBudget = await tryReservePaidBudget();
  if (!withinBudget) return null;

  let html: string;
  try {
    const result = await unblockerClient.fetch(url, remainingMs);
    html = result.html;
  } catch {
    return null;
  }

  const context = await provider.newContext(getRungProfile('dc-proxy'));
  const page = await context.newPage();
  await page.setContent(html, { waitUntil: 'domcontentloaded' });
  return { page, context };
}

export interface StealthLadderSuccess {
  verdict: 'CLEAN';
  rungReached: number;
  page: Page;
  context: BrowserContext;
}

export interface StealthLadderFailure {
  verdict: 'EXHAUSTED';
  rungReached: number;
}

export type StealthLadderResult = StealthLadderSuccess | StealthLadderFailure;

// Navigates one rung's page, re-checking every redirect hop's resolved
// address (docs/rules/05-worker-and-browser-pipeline.md §1 step 2 — the
// authoritative check is never skipped, including per hop) and capping hop
// count at MAX_REDIRECT_HOPS.
async function navigateAndClassify(
  page: Page,
  url: string,
  deadlineMs: number,
): Promise<ReturnType<typeof classifyBlock>> {
  let hopCount = 0;

  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) {
      hopCount += 1;
      if (hopCount > MAX_REDIRECT_HOPS) {
        await route.abort();
        return;
      }
      const check = await authoritativeSsrfCheck(request.url());
      if (check.blocked) {
        await route.abort();
        return;
      }
    }
    await route.continue();
  });

  const remainingMs = Math.max(deadlineMs - Date.now(), 1000);

  let response;
  try {
    response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: remainingMs });
  } catch {
    return classifyBlock({ httpStatus: 0, responseHeaders: {}, title: '', bodyTextLength: 0 });
  }

  const title = await page.title().catch(() => '');
  const bodyTextLength = await page
    .evaluate(() => document.body?.innerText.length ?? 0)
    .catch(() => 0);

  return classifyBlock({
    httpStatus: response?.status() ?? 0,
    responseHeaders: response?.headers() ?? {},
    title,
    bodyTextLength,
  });
}

// maxRungIndex is the account's plan-tier cap (plans.ts's MAX_RUNG_INDEX_BY_TIER,
// resolved by the caller from job.account.plan) — Basic accounts never reach
// rungs 2-3 even if routing-memory would otherwise escalate there.
export async function runStealthLadder(
  provider: SelfHostedProvider,
  url: string,
  deadlineMs: number,
  maxRungIndex: number,
): Promise<StealthLadderResult> {
  const domain = new URL(url).hostname;
  const startRungName = await getStartingRung(domain);
  const startIndex = RUNG_NAMES.indexOf(startRungName);
  const maxIndex = Math.min(startIndex + MAX_ESCALATIONS, RUNG_NAMES.length - 1, maxRungIndex);

  let rungReached = startIndex;
  for (let index = startIndex; index <= maxIndex; index += 1) {
    rungReached = index;
    const rungName = RUNG_NAMES[index];
    if (!rungName) break;

    if (rungName === 'paid-unblocker') {
      const unblocked = await tryPaidUnblockerRung(provider, url, deadlineMs);
      if (unblocked) {
        await recordSuccess(domain, rungName);
        return {
          verdict: 'CLEAN',
          rungReached: index,
          page: unblocked.page,
          context: unblocked.context,
        };
      }
      break;
    }

    let profile;
    try {
      profile = getRungProfile(rungName);
    } catch {
      // Rung not provisioned (no vendor account yet) or deferred (Camoufox) —
      // nothing further to try; treat as ladder exhaustion, not a crash.
      break;
    }

    const context = await provider.newContext(profile);
    const page = await context.newPage();
    const verdict = await navigateAndClassify(page, url, deadlineMs);

    if (verdict === 'CLEAN') {
      await recordSuccess(domain, rungName);
      return { verdict: 'CLEAN', rungReached: index, page, context };
    }

    await context.close();
  }

  return { verdict: 'EXHAUSTED', rungReached };
}
