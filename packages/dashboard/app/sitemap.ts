import type { MetadataRoute } from 'next';

import { PUBLIC_PATHS, SITE_URL } from '../lib/site';

// The sitemap the old robots.txt has been pointing at since it was written,
// and which never existed until now.
//
// No `lastModified`. Next makes it easy to pass `new Date()` and every
// example does, but that stamps build time onto every URL -- so a deploy that
// touched one component would tell Google the homepage, /setup and every blog
// post all changed simultaneously. A lastModified that is wrong on every
// entry is worse than none: crawlers discount the signal for the whole site
// once it stops correlating with real edits. When the blog lands, posts carry
// a real date from their own frontmatter and can set it honestly.
//
// File-convention route at the app root, so (app)/(marketing) route groups do
// not affect its URL and it serves at /sitemap.xml. Listed in middleware.ts's
// unauthenticatedPaths -- an unlisted one 307s to AuthKit and Search Console
// reports "couldn't fetch".
export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({
    url: new URL(path, SITE_URL).toString(),
  }));
}
