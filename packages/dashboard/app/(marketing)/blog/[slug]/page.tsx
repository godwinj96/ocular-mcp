import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ArticleHeader } from '../../../../components/marketing/blog/article-header';
import { Disclosure } from '../../../../components/marketing/blog/disclosure';
import { PostJsonLd } from '../../../../components/marketing/blog/json-ld';
import { Verdict } from '../../../../components/marketing/blog/verdict';
import { BleedRule } from '../../../../components/marketing/section-header';
import { WaitlistCta } from '../../../../components/marketing/waitlist-cta';
import { getAllPosts, getPostWithContent } from '../../../../lib/blog';
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
        <div className="mx-auto max-w-prose">
          <ArticleHeader post={post} kind="Comparison" />
        </div>

        <div className="prose mt-stack-4">
          <Body />
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
        <div className="mx-auto mt-group max-w-prose">
          <BleedRule />
          <div className="mt-stack-4">
            <WaitlistCta />
          </div>

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
