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
import { getStartingRung, recordSuccess } from '../routing-memory/redis-routing-memory.js';
import type { SelfHostedProvider, Page, BrowserContext } from '../providers/self-hosted-provider.js';
import { authoritativeSsrfCheck } from '../ssrf/authoritative-check.js';

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

export async function runStealthLadder(
  provider: SelfHostedProvider,
  url: string,
  deadlineMs: number,
): Promise<StealthLadderResult> {
  const domain = new URL(url).hostname;
  const startRungName = await getStartingRung(domain);
  const startIndex = RUNG_NAMES.indexOf(startRungName);
  const maxIndex = Math.min(startIndex + MAX_ESCALATIONS, RUNG_NAMES.length - 1);

  let rungReached = startIndex;
  for (let index = startIndex; index <= maxIndex; index += 1) {
    rungReached = index;
    const rungName = RUNG_NAMES[index];
    if (!rungName) break;

    let profile;
    try {
      profile = getRungProfile(rungName);
    } catch {
      // Rung not provisioned (no vendor account yet, see M3) — nothing
      // further to try; treat as ladder exhaustion, not a crash.
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
