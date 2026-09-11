import fs from 'node:fs';
import path from 'node:path';

import matter from 'gray-matter';
import { z } from 'zod';

// Blog post metadata, read straight off disk at build time.
//
// WHY METADATA AND RENDERING TAKE DIFFERENT PATHS. The post body is an .mdx
// module compiled by the bundler and imported by blog/[slug]/page.tsx; the
// metadata is this YAML block, parsed here with gray-matter without compiling
// anything. They could have been unified -- remark-mdx-frontmatter would turn
// the same block into a module export -- and that was rejected on purpose:
// the blog index, the sitemap and generateStaticParams all need every post's
// metadata and none of their bodies. Going through the MDX pipeline for that
// means compiling every post to answer "what posts exist", on every build.
// remark-frontmatter (see next.config.mjs) is therefore doing exactly one
// job: stopping the YAML rendering as a paragraph of text.
//
// Server-only by construction. node:fs cannot be bundled into a client
// component, so importing this file from one is a build error rather than a
// runtime surprise -- which is the outcome a 'server-only' import would buy,
// without the dependency.
const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');

// A slug is a filename, so it has to survive being one, and it ends up in a
// URL and in a dynamic import specifier. Constraining it here means
// getPostBySlug cannot be walked out of CONTENT_DIR by a crafted param even
// if dynamicParams is ever turned back on.
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
};

function readPost(fileName: string): Post {
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
  const parsed = frontmatterSchema.safeParse(matter(raw).data);

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

  return { ...parsed.data, slug };
}

/**
 * Every post, newest first. Used by the blog index, the sitemap and
 * generateStaticParams.
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
 * to turn null into a 404.
 */
export function getPostBySlug(slug: string): Post | null {
  if (!SLUG_PATTERN.test(slug)) return null;

  const fileName = `${slug}.mdx`;
  if (!fs.existsSync(path.join(CONTENT_DIR, fileName))) return null;

  return readPost(fileName);
}
