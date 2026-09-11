import Link from 'next/link';

import { getAllPosts } from '../../../lib/blog';

const TITLE = 'Writing — Ocular';
const DESCRIPTION =
  'Notes on giving AI agents working vision: what the tools in this space actually do, where each one stops, and how to tell which you need.';

export const metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: '/blog' },
  openGraph: {
    type: 'website',
    url: '/blog',
    title: TITLE,
    description: DESCRIPTION,
    images: '/og-image.png',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
    images: '/og-image.png',
  },
};

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

// A DIVIDED LIST, NOT A CARD GRID, and that is a decision rather than a
// shortcut. One card in a grid reads as a broken empty state; three read as
// the canonical just-launched-a-blog template, which the anti-template rule
// names outright ("default card grids with uniform spacing and no hierarchy").
//
// A one-row LIST, by contrast, is simply a list with one entry. It degrades
// from 1 to 5 to 30 with no redesign, it carries real scale contrast instead
// of flattening everything to uniform card emphasis, and the structure is
// already this site's own -- faq.tsx ships exactly this divided
// [320px_1fr] split. Borrowing the structure rather than the component,
// because the two will diverge as posts gain a kind and a reading time.
//
// Deliberately absent at this size: pagination, a featured-post hero, an RSS
// badge row, per-post thumbnails. At five posts the entire index is one
// screen.
export default function BlogIndexPage() {
  const posts = getAllPosts();

  return (
    <div
      className="pb-sec-tail pt-[136px]"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <p className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-text-quaternary">
          Writing
        </p>

        {/* One sentence saying what the writing is FOR. At n=1 a title over a
            single row reads unfinished, and the sentence is doing GEO work
            besides -- it tells a model what this section is.

            Scope-tested: it is about agent vision and the ways of getting it,
            NOT about an agent checking the UI it just wrote. That narrower
            framing is the incumbent's own launch sentence, and writing it here
            would put this page behind them on their claim. */}
        <h1 className="mt-stack-2 max-w-[16ch] text-[clamp(2rem,1.15rem+2.9vw,3rem)] font-medium leading-[1.0] tracking-[-0.022em] text-text-primary [text-wrap:balance]">
          Agents that can see
        </h1>

        <p className="mt-stack-3 max-w-answer text-[16px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
          {DESCRIPTION}
        </p>

        {posts.length === 0 ? (
          <p className="mt-group font-mono text-[14px] text-text-tertiary">
            Nothing published yet.
          </p>
        ) : (
          <ul className="mt-group divide-y divide-rule-divider border-y border-rule-divider">
            {posts.map((post) => (
              <li key={post.slug}>
                <Link
                  href={`/blog/${post.slug}`}
                  className="group grid grid-cols-1 gap-stack-1 py-stack-3 lg:grid-cols-[320px_1fr] lg:gap-12"
                >
                  <p className="flex flex-wrap gap-x-2 font-mono text-[12px] leading-none tracking-[0.02em] text-text-quaternary">
                    <span>
                      <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>{post.readingMinutes} min</span>
                  </p>

                  <div>
                    <p className="text-[19px] font-medium leading-[1.35] tracking-[-0.014em] text-text-primary [text-wrap:balance]">
                      {post.title}
                    </p>
                    <p className="mt-stack-1 max-w-answer text-[16px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
                      {post.description}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
