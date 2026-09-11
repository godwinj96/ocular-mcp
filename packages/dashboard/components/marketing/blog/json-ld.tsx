import { SITE_URL } from '../../../lib/site';
import type { Post } from '../../../lib/blog';

// Structured data for posts: BlogPosting + BreadcrumbList.
//
// ON dangerouslySetInnerHTML, documented at the call site as the security
// rules require. The string handed to it is JSON.stringify of an object this
// module builds from a zod-validated frontmatter record read off a
// git-committed file at build time. There is no user input anywhere in the
// path -- no request data, no database, no CMS -- and the only way to change
// what lands here is to commit a file to this repo, which is the same trust
// boundary as the code itself.
//
// JSON.stringify is nonetheless not sufficient on its own: a literal "</script>"
// inside any string field would close the script element early, which is an
// injection even from trusted content. The escape below is the standard
// mitigation and is applied unconditionally rather than "when needed", because
// "when needed" is a judgement someone editing a post will not make.
function serialize(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}

// author is a PERSON, not the Organization. Founder's decision, and the right
// one for E-E-A-T: a named human with a track record carries "Experience" in a
// way a faceless brand cannot, and a vendor comparison post needs every point
// of credibility it can honestly claim.
const AUTHOR = {
  '@type': 'Person',
  name: 'Godwin James',
} as const;

export function PostJsonLd({ post }: { post: Post }) {
  const url = `${SITE_URL}/blog/${post.slug}`;

  const graph = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'BlogPosting',
        '@id': url,
        headline: post.title,
        description: post.description,
        datePublished: post.publishedAt,
        // dateModified falls back to publishedAt because the property is what
        // consumers read for freshness, and omitting it entirely is treated as
        // unknown rather than as unmodified. It is never a DIFFERENT invented
        // date -- see lib/blog.ts on why updatedAt is absent until a post is
        // genuinely revised.
        dateModified: post.updatedAt ?? post.publishedAt,
        author: AUTHOR,
        publisher: {
          '@type': 'Organization',
          name: 'Ocular',
          url: SITE_URL,
        },
        mainEntityOfPage: { '@type': 'WebPage', '@id': url },
        image: `${url}/opengraph-image`,
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Ocular', item: SITE_URL },
          { '@type': 'ListItem', position: 2, name: 'Writing', item: `${SITE_URL}/blog` },
          { '@type': 'ListItem', position: 3, name: post.title, item: url },
        ],
      },
    ],
  };

  // dangerouslySetInnerHTML here: see the module header. The payload is
  // machine-generated from build-time, zod-validated, repo-committed data --
  // never a request, a database, or a CMS -- and is escaped against early
  // script termination regardless.
  return (
    <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serialize(graph) }} />
  );
}
