// See docs/rules/05-worker-and-browser-pipeline.md §3. Never infer a verdict
// from a single weak signal alone (e.g. HTTP 200 does not by itself mean CLEAN).

export type BlockVerdict = 'CLEAN' | 'CHALLENGE' | 'HARD_BLOCK' | 'EMPTY';

export interface ClassifierInput {
  httpStatus: number;
  responseHeaders: Record<string, string>;
  title: string;
  bodyTextLength: number;
}

const CHALLENGE_TITLE_PATTERNS = [/just a moment/i, /attention required/i, /checking your browser/i, /captcha/i];
const HARD_BLOCK_TITLE_PATTERNS = [/access denied/i, /forbidden/i, /blocked/i];
const MIN_BODY_TEXT_LENGTH = 40; // below this, treat the page as an emptiness signal, not real content.

function headerIndicatesChallenge(headers: Record<string, string>): boolean {
  const lowered = Object.fromEntries(Object.entries(headers).map(([k, v]) => [k.toLowerCase(), v.toLowerCase()]));
  // `cf-mitigated` is set specifically when Cloudflare actually served a
  // challenge for this response — unlike `server: cloudflare`, which is
  // present on the vast majority of the web (including plain, unblocked
  // sites like example.com) and is not itself a block signal.
  return lowered['cf-mitigated'] !== undefined;
}

export function classifyBlock(input: ClassifierInput): BlockVerdict {
  const { httpStatus, responseHeaders, title, bodyTextLength } = input;

  if (httpStatus === 403 || HARD_BLOCK_TITLE_PATTERNS.some((pattern) => pattern.test(title))) {
    return 'HARD_BLOCK';
  }

  if (
    httpStatus === 429 ||
    headerIndicatesChallenge(responseHeaders) ||
    CHALLENGE_TITLE_PATTERNS.some((pattern) => pattern.test(title))
  ) {
    return 'CHALLENGE';
  }

  if (httpStatus >= 500) {
    return 'HARD_BLOCK';
  }

  // A 2xx/3xx with an empty-looking body is a weak signal on its own, but
  // combined with the absence of any challenge/block markers above, it's the
  // strongest remaining explanation for "nothing useful came back."
  if (bodyTextLength < MIN_BODY_TEXT_LENGTH) {
    return 'EMPTY';
  }

  return 'CLEAN';
}
