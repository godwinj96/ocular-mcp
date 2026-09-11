import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';
import { z } from 'zod';

// Blog post metadata AND body, read straight off disk.
//
// Both come from ONE parse of the same file (gray-matter's `matter()`
// separates the YAML frontmatter from the Markdown body in a single pass) --
// there is no second, MDX-specific read. blog/[slug]/page.tsx compiles the
// body string this module returns via next-mdx-remote/rsc's `compileMDX` at
// render time; see next.config.mjs for why that replaced a webpack-level
// `import()` of the .mdx file (it crashed every single .mdx page under React
// Server Components, unrelated to anything in this file).
//
// getAllPosts() and the sitemap only need the metadata half, so readPost
// still returns the body separately as `content` rather than folding
// compilation in here -- compiling a post nobody asked to read, just to
// answer "what posts exist", is exactly the wasted work this split avoids.
//
// Server-only by construction. node:fs cannot be bundled into a client
// component, so importing this file from one is a build error rather than a
// runtime surprise -- which is the outcome a 'server-only' import would buy,
// without the dependency.
const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');

// A slug is a filename, so it has to survive being one, and it ends up in a
// URL. Constraining it here means getPostBySlug cannot be walked out of
// CONTENT_DIR by a crafted param even if dynamicParams is ever turned back on.
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

// ISO calendar dates, not timestamps. A post is published on a day; giving it
// a time implies a precision the editorial process does not have, and the
// JSON-LD and <time> elements both read better for it.
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'expected an ISO calendar date, e.g. 2026-09-11');

const frontmatterSchema = z.object({
  title: z.string().min(1),
  description: z.string().min(1),
  publishedAt: isoDate,
  // Only set once a post has actually been revised. Absent is the honest
  // default; stamping every post with an updatedAt equal to publishedAt is
  // the freshness theatre that makes the signal worthless.
  updatedAt: isoDate.optional(),
  // Not rendered anywhere. It exists so the post's target query is committed
  // alongside the post and reviewable in the same diff, rather than living in
  // someone's memory of a research session.
  targetKeyword: z.string().min(1),
  // Rendered BELOW the call to action, never above it, and that position is
  // the whole point. A comparison post has to name the case where the reader
  // shouldn't buy -- the concession is what makes every other claim credible.
  // But whatever sits immediately before the ask is what's still in working
  // memory at the decision point, and the first version of this post put a
  // full "you probably don't need this" section in exactly that slot. Below
  // the CTA it does its credibility job without costing the conversion.
  closingNote: z.string().min(1).optional(),
});

export type PostFrontmatter = z.infer<typeof frontmatterSchema>;

export type Post = PostFrontmatter & {
  /** Derived from the filename, never from frontmatter -- see readPost. */
  slug: string;
  /** Whole minutes at 220wpm, computed from the body. See readingMinutes. */
  readingMinutes: number;
};

export type OutlineEntry = {
  /** The heading's own text. */
  text: string;
  /** The id rehype-slug will generate for it -- see slugifyHeading. */
  id: string;
};

export type PostWithContent = Post & {
  /** The raw Markdown/MDX body, frontmatter already stripped by gray-matter. */
  content: string;
  /** Top-level (##) headings, in document order, for the article rail. */
  outline: OutlineEntry[];
};

// Must produce the same ids rehype-slug does, because the rail's anchors have
// to match the headings it generated. rehype-slug uses github-slugger:
// lowercase, strip anything that isn't a word character/space/hyphen, spaces
// to hyphens. The curly apostrophes this site's copy uses are stripped
// entirely (so "can’t" becomes "cant"), which is exactly what github-slugger
// does and is the reason this cannot be a naive toLowerCase().replace().
function slugifyHeading(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N} -]/gu, '')
    .trim()
    .replace(/\s+/g, '-');
}

// Only `##`. An article rail listing every h3 as well stops being a wayfinding
// aid and becomes a second copy of the article.
function extractOutline(body: string): OutlineEntry[] {
  const entries: OutlineEntry[] = [];

  for (const line of body.split('\n')) {
    const match = /^##\s+(.+?)\s*$/.exec(line);
    if (!match) continue;

    // Strip inline markdown emphasis/code marks so the rail shows the words,
    // not the syntax.
    const text = (match[1] ?? '').replace(/[*_`]/g, '').trim();
    if (text) entries.push({ text, id: slugifyHeading(text) });
  }

  return entries;
}

// Day-month-year with a spelled month, so 09/11 can never be read two ways.
// UTC because the input is a calendar date with no timezone, and parsing it as
// local would shift it a day west of Greenwich. Lives here rather than in
// article-header.tsx because the article rail renders the same date.
export function formatPostDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// 220 words per minute. A measurement, not a hook -- which is the only reason
// it earns a place in the byline of a site with this voice. It is also the
// cheapest honest signal of cost-before-commitment a long comparison post can
// give a reader who is deciding whether to start.
const WORDS_PER_MINUTE = 220;

function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / WORDS_PER_MINUTE));
}

function readPost(fileName: string): PostWithContent {
  const slug = fileName.replace(/\.mdx$/, '');

  // The slug is the filename and nothing else. The original plan had it as a
  // frontmatter field; a file whose name and declared slug disagree is a
  // silent 404 waiting to happen, and there is no version of that
  // disagreement worth supporting.
  if (!SLUG_PATTERN.test(slug)) {
    throw new Error(
      `Blog post "${fileName}": filename must be a lowercase hyphenated slug, e.g. ocular-vs-something.mdx`,
    );
  }

  const raw = fs.readFileSync(path.join(CONTENT_DIR, fileName), 'utf8');
  const file = matter(raw);
  const parsed = frontmatterSchema.safeParse(file.data);

  // Thrown, not swallowed to a placeholder. This runs at build time, so a
  // malformed post fails the deploy instead of shipping a page with an empty
  // <title> that nobody notices until it is indexed that way.
  if (!parsed.success) {
    throw new Error(
      `Blog post "${fileName}" has invalid frontmatter:\n${parsed.error.issues
        .map((issue) => `  - ${issue.path.join('.') || '(root)'}: ${issue.message}`)
        .join('\n')}`,
    );
  }

  return {
    ...parsed.data,
    slug,
    readingMinutes: readingMinutes(file.content),
    content: file.content,
    outline: extractOutline(file.content),
  };
}

/**
 * Every post, newest first. Used by the blog index, the sitemap and
 * generateStaticParams. Metadata only -- callers that need to render a post's
 * body should use getPostWithContent instead.
 */
export function getAllPosts(): Post[] {
  // An absent directory is not an error -- it is the state of a blog with no
  // posts in it, which is exactly where this starts.
  if (!fs.existsSync(CONTENT_DIR)) return [];

  return fs
    .readdirSync(CONTENT_DIR)
    .filter((fileName) => fileName.endsWith('.mdx'))
    .map(readPost)
    .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
}

/**
 * One post's metadata, or null if no such file exists. The caller is expected
 * to turn null into a 404. Metadata only -- see getPostWithContent to render
 * the body.
 */
export function getPostBySlug(slug: string): Post | null {
  return getPostWithContent(slug);
}

/**
 * One post's metadata AND its raw body, or null if no such file exists.
 * Callers that render the post pass `.content` to next-mdx-remote/rsc's
 * `compileMDX`; callers that only need metadata (the index, the sitemap) can
 * keep using getPostBySlug/getAllPosts, which are the same read minus the
 * body already sitting unused in memory.
 */
export function getPostWithContent(slug: string): PostWithContent | null {
  if (!SLUG_PATTERN.test(slug)) return null;

  const fileName = `${slug}.mdx`;
  if (!fs.existsSync(path.join(CONTENT_DIR, fileName))) return null;

  return readPost(fileName);
}
