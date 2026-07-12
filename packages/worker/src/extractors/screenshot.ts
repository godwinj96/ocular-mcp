// view_page extractor. See docs/rules/02-repo-structure.md §6 bootstrap template
// and docs/rules/05-worker-and-browser-pipeline.md §4.

import type { Page } from '../providers/self-hosted-provider.js';

export async function extractScreenshot(page: Page, opts: { fullPage: boolean }): Promise<Buffer> {
  return page.screenshot({ fullPage: opts.fullPage, type: 'png' });
}
