import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleHeader } from '../../../../components/marketing/blog/article-header';
import { Disclosure } from '../../../../components/marketing/blog/disclosure';
import { PostJsonLd } from '../../../../components/marketing/blog/json-ld';
import { Verdict } from '../../../../components/marketing/blog/verdict';
import { BleedRule } from '../../../../components/marketing/section-header';
import { WaitlistCta } from '../../../../components/marketing/waitlist-cta';
import { formatPostDate, getAllPosts, getPostWithContent } from '../../../../lib/blog';
import { compileMdx } from '../../../../lib/compile-mdx';

// Every post is prerendered, and an unknown slug 404s rather than being
// rendered on demand. dynamicParams = false is what makes that true: without
// it Next would try to render /blog/anything at request time, which both opts
// the route out of the static guarantee this whole migration exists for and
// hands a crawler a soft-404.
export const dynamicParams = false;

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostWithContent(slug);
  if (!post) return {};

  const url = `/blog/${post.slug}`;

  return {
    title: `${post.title} — Ocular`,
    description: post.description,
    alternates: { canonical: url },
    openGraph: {
      type: 'article',
      url,
      title: post.title,
      description: post.description,
      publishedTime: post.publishedAt,
      modifiedTime: post.updatedAt ?? post.publishedAt,
      authors: ['Godwin James'],
      // No `images` here on purpose: opengraph-image.tsx sits beside this file
      // and Next wires it in automatically. Naming an image here would
      // override the generated one with the site-wide card, which is the
      // failure this whole per-post OG exercise exists to avoid.
    },
    twitter: {
      card: 'summary_large_image',
      title: post.title,
      description: post.description,
    },
  };
}

// Components available to every post's MDX body WITHOUT an inline `import`.
// compileMdx (lib/compile-mdx.tsx) compiles the raw source string at render
// time rather than importing a bundled .mdx module, and a runtime compiler
// has no bundler graph to resolve a local relative import against -- so
// components are wired here instead. Disclosure and Verdict differ per post
// in their CONTENT, not their availability, so they are registered once
// rather than per-post.
const MDX_COMPONENTS = { Disclosure, Verdict };

export default async function PostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostWithContent(slug);
  if (!post) notFound();

  const Body = await compileMdx(post.content, MDX_COMPONENTS);

  return (
    <article
      className="pb-sec-tail pt-[136px]"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <PostJsonLd post={post} />

      <div className="mx-auto max-w-[1240px]">
        {/* 720px, not the 536px reading measure, and flush left rather than
            centered. At 536 a clamp(2rem,...,3rem) headline wraps after two or
            three words and reads as a cramped sentence; at 720 it holds a
            clause per line and [text-wrap:balance] has something to work with.
            720 is --prose-bleed, already declared -- not a new width. */}
        <div className="max-w-prose-bleed">
          <ArticleHeader post={post} kind="Comparison" />
        </div>

        {/* THE FIX FOR "one narrow pillar with oceans of empty space either
            side" (founder, on the first shipped version). Every block on this
            page was max-w-prose + mx-auto, so a 536px column sat centered in a
            1240px container with 300px of dead air on both sides for the whole
            scroll. The reading measure was never the problem -- an unpopulated
            grid track was. The left track now carries the article's metadata
            and outline for the full length of the piece, and the remaining
            margin sits on one side only, which reads as a deliberate margin
            rather than as a page that failed to load.

            320px is faq.tsx's own rail width and the 48px gap its own gap --
            both reused rather than invented. .prose keeps max-width: 536px, so
            its auto-centering inside a 536px track is a no-op and the measure
            is untouched to the pixel. */}
        <div className="mt-stack-4 grid grid-cols-1 lg:grid-cols-[320px_536px] lg:gap-x-12">
          <aside className="hidden lg:block" aria-label="Article details">
            {/* 136px matches the article's own pt-[136px] nav clearance. */}
            <div className="sticky top-[136px]">
              <p className="font-mono text-[12px] leading-none tracking-[0.02em] text-text-tertiary">
                <time dateTime={post.publishedAt}>{formatPostDate(post.publishedAt)}</time>
              </p>
              <p className="mt-stack-1 font-mono text-[12px] leading-none tracking-[0.02em] text-text-quaternary">
                {post.readingMinutes} min read
              </p>

              {/* A rail holding only a date is the same empty-space problem at
                  a smaller scale. The outline gives it a job: on a piece this
                  long it is the only element that lets a reader scanning for
                  one axis jump straight to it. Ids come from rehype-slug (see
                  lib/compile-mdx.tsx); the text comes from the same headings
                  via lib/blog.ts's extractOutline, so the two cannot drift. */}
              {post.outline.length > 0 ? (
                <nav className="mt-group" aria-label="In this piece">
                  <p className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-text-quaternary">
                    In this piece
                  </p>
                  <ul className="mt-stack-2 flex flex-col gap-stack-1">
                    {post.outline.map((entry) => (
                      <li key={entry.id} className="flex gap-2">
                        <span
                          aria-hidden="true"
                          className="font-mono text-[13px] text-text-inactive"
                        >
                          –
                        </span>
                        <a
                          href={`#${entry.id}`}
                          className="text-[13px] leading-[1.5] text-text-tertiary transition-colors duration-fast hover:text-text-primary"
                        >
                          {entry.text}
                        </a>
                      </li>
                    ))}
                  </ul>
                </nav>
              ) : null}
            </div>
          </aside>

          <div className="prose">
            <Body />
          </div>
        </div>

        {/* ONE conversion unit, at the end, and it renders the real form
            rather than linking to one. WaitlistCta is the only CTA on this
            site that works unmodified off the homepage -- ConnectCta and the
            nav's pill both point at #pricing, which is a section of a
            different document. A reader who is convinced by the argument
            converts in place instead of being bounced to /#pricing to hunt for
            a field.

            Deliberately NOT CtaFooter: importing the homepage's close turns
            an article into a landing page, and a comparison post that reads as
            an ad loses the reader at the exact moment it starts selling. The
            post's credibility IS the conversion mechanism. */}
        {/* Flush left like everything above it, and offset to sit under the
            prose column rather than under the rail. */}
        <div className="mt-group max-w-prose lg:ml-[368px]">
          <BleedRule />
          <div className="mt-stack-4">
            <WaitlistCta />
          </div>

          {/* The concession, and it sits BELOW the ask on purpose -- see
              lib/blog.ts's closingNote field for why. Quiet register: this is
              an aside that signals the piece isn't hiding its disqualifying
              case, not a second argument. */}
          {post.closingNote ? (
            <p className="mt-stack-3 max-w-answer text-[14px] leading-[1.6] text-text-tertiary [text-wrap:pretty]">
              {post.closingNote}
            </p>
          ) : null}

          <p className="mt-group font-mono text-[12px] leading-none tracking-[0.02em] text-text-quaternary">
            <Link
              href="/blog"
              className="underline decoration-rule-mark underline-offset-4 transition-colors duration-fast hover:text-text-primary hover:decoration-accent"
            >
              All writing
            </Link>
          </p>
        </div>
      </div>
    </article>
  );
}
