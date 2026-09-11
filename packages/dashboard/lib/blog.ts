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
});

export type PostFrontmatter = z.infer<typeof frontmatterSchema>;

export type Post = PostFrontmatter & {
  /** Derived from the filename, never from frontmatter -- see readPost. */
  slug: string;
  /** Whole minutes at 220wpm, computed from the body. See readingMinutes. */
  readingMinutes: number;
};

export type PostWithContent = Post & {
  /** The raw Markdown/MDX body, frontmatter already stripped by gray-matter. */
  content: string;
};

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
