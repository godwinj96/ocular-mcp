import { ImageResponse } from 'next/og';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { getAllPosts, getPostBySlug } from '../../../../lib/blog';

export const alt = 'Ocular';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

// Per-post OG card via next/og's ImageResponse, replacing the site-wide
// og-image.png for every post. scripts/gen-og-image.mjs (the wordmark-only
// card used everywhere else) is deliberately text-free: it renders through
// sharp, which could not load the self-hosted font. ImageResponse runs
// through Satori/resvg instead, which can, so a post's card can finally carry
// its own title -- the actual reason to build this rather than share the
// static image.
export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

// Satori (the renderer behind ImageResponse) accepts TTF/OTF/WOFF font data,
// NOT woff2 -- so this reads a .woff, not the .woff2 the rest of the app
// loads via @fontsource's CSS. Colocated in this route directory rather than
// referenced into node_modules by a relative path: @fontsource is hoisted to
// the monorepo root, and a path reaching up through several ../ segments to
// find it is exactly the kind of thing that resolves locally and breaks on a
// build server with a different hoist layout.
async function loadGeist500(): Promise<ArrayBuffer> {
  const buffer = await readFile(
    path.join(process.cwd(), 'app/(marketing)/blog/[slug]/geist-500.woff'),
  );
  return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
}

export default async function OpengraphImage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  const title = post?.title ?? 'Ocular';
  const font = await loadGeist500();

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '80px',
        backgroundColor: '#09090B',
        fontFamily: 'Geist Sans',
      }}
    >
      <div
        style={{
          display: 'flex',
          fontSize: 22,
          letterSpacing: '0.16em',
          textTransform: 'uppercase',
          color: '#6C6C72',
        }}
      >
        Ocular
      </div>

      <div
        style={{
          display: 'flex',
          fontSize: 56,
          lineHeight: 1.15,
          letterSpacing: '-0.02em',
          color: '#F4F4F2',
          maxWidth: '1000px',
        }}
      >
        {title}
      </div>

      <div
        style={{
          display: 'flex',
          fontSize: 22,
          letterSpacing: '0.02em',
          color: '#86868C',
        }}
      >
        useocular.dev
      </div>
    </div>,
    {
      ...size,
      fonts: [{ name: 'Geist Sans', data: font, weight: 500, style: 'normal' }],
    },
  );
}
