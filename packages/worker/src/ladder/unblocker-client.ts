// Rung 3 — paid unblocker. The founder-provisioned Decodo account is their
// **Site Unblocker** product (confirmed against Decodo's own docs —
// help.decodo.com/docs/site-unblocker-quick-start, github.com/Decodo/Site-Unblocker
// — not the separate scraper-api.decodo.com REST product). Site Unblocker is
// accessed as a plain forward HTTP proxy at unblock.decodo.com:60000 with
// username:password Basic-style proxy auth — a single synchronous request
// per target, NOT a job-submission/poll API. That matters here: it means
// this call is bounded by JOB_DEADLINE_MS like any other rung, not something
// that can run past the deadline in the background.
import { ProxyAgent, request as undiciRequest } from 'undici';

export interface UnblockerResult {
  html: string;
  finalUrl: string;
}

const UNBLOCKER_PROXY_HOST = 'unblock.decodo.com:60000';

export class UnblockerClient {
  async fetch(url: string, remainingMs: number): Promise<UnblockerResult> {
    const username = process.env.DECODO_UNBLOCKER_USERNAME;
    const password = process.env.DECODO_UNBLOCKER_PASSWORD;
    if (!username || !password) {
      throw new Error(
        'UnblockerClient not configured — DECODO_UNBLOCKER_USERNAME/PASSWORD missing',
      );
    }

    // See docs/rules/06-external-fetching-and-egress.md §2 — never start a
    // stage without enough budget left to plausibly finish; the caller
    // (stealth-ladder.ts) is responsible for not calling this at all once
    // remainingMs can't cover it, but this is the hard backstop.
    if (remainingMs <= 0) {
      throw new Error('UnblockerClient: no deadline budget remaining');
    }

    const agent = new ProxyAgent({
      uri: `http://${UNBLOCKER_PROXY_HOST}`,
      token: `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}`,
    });

    try {
      const response = await undiciRequest(url, {
        dispatcher: agent,
        method: 'GET',
        bodyTimeout: remainingMs,
        headersTimeout: remainingMs,
      });
      const html = await response.body.text();
      // Site Unblocker proxies the request transparently — the final URL
      // after any redirects is only observable via its response headers,
      // not returned separately; fall back to the requested URL if absent.
      const finalUrl = (response.headers['x-su-final-url'] as string | undefined) ?? url;
      return { html, finalUrl };
    } finally {
      await agent.close();
    }
  }
}
