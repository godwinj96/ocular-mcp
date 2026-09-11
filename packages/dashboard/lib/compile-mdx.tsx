import { evaluate } from '@mdx-js/mdx';
import type { MDXComponents } from 'mdx/types';
import type { ComponentType } from 'react';
import * as runtime from 'react/jsx-runtime';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

// Compiles a post body string to a React component, at render time, inside a
// Server Component. This exists instead of @next/mdx or next-mdx-remote/rsc
// because BOTH crashed under React Server Components on this project, and the
// root cause was the same in both: each resolves `react/jsx-runtime` from
// inside its own bundled code (a webpack-loader-generated module for
// @next/mdx, a `require()` inside a shipped .cjs shim for next-mdx-remote)
// rather than from a plain top-level `import` written in a file Next's own
// compiler processes directly. Next's webpack config layers a module for the
// React Server Components condition based on how it is compiled, and neither
// third-party path got tagged correctly -- confirmed by disassembling the
// failing chunk (@next/mdx: TypeError reading ReactCurrentOwner off a `react`
// module missing it) and by next-mdx-remote's own clearer failure ("A React
// Element from an older version of React was rendered... A compiler tries to
// inline JSX instead of using the runtime").
//
// `import * as runtime from 'react/jsx-runtime'` HERE, at the top of a file
// Next's compiler processes normally, is what actually fixes it: it is
// resolved the same way every other Server Component's own JSX resolves,
// because this file's compilation is indistinguishable from any other .tsx
// file's to Next's webpack config. @mdx-js/mdx's `evaluate()` takes
// {Fragment, jsx, jsxs} explicitly as an argument rather than importing them
// itself -- exactly so a caller can hand it a runtime resolved correctly for
// wherever the caller is actually running, which is the API this project
// needed and neither wrapper library exposed.
export async function compileMdx(
  source: string,
  components: MDXComponents,
): Promise<ComponentType> {
  // rehype-slug gives every heading an id. Two things depend on it and both
  // were inert before it was added: prose.css's `.prose :is(h2, h3)[id]`
  // scroll-margin rule, and the article rail's "In this piece" outline, whose
  // anchors have to match ids generated from the same heading text.
  const { default: Content } = await evaluate(source, {
    ...runtime,
    remarkPlugins: [remarkGfm],
    rehypePlugins: [rehypeSlug],
  });

  return () => Content({ components });
}
