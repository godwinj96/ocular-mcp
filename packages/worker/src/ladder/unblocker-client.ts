// Rung 3 — paid unblocker (Decodo Web Unlocker), plain HTTP client, NOT a
// BrowserProvider. See docs/rules/05-worker-and-browser-pipeline.md §3 and
// research & planning/02-conclusions-and-recommendations.md §16.

export interface UnblockerResult {
  html: string;
  finalUrl: string;
}

export class UnblockerClient {
  async fetch(url: string): Promise<UnblockerResult> {
    void url;
    // TODO(M3): call Decodo Web Unlocker via `undici` with fine-grained
    // timeout/dispatcher control. Requires a Decodo account, not yet provisioned.
    throw new Error('UnblockerClient not implemented — see M3 in DEVLOG.md');
  }
}
