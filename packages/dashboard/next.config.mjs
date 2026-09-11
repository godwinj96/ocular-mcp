/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  experimental: {
    // THE FIX FOR "it takes a whole second to switch tabs" (founder's report,
    // Session 34 brief §4). Every dashboard route is `ƒ (Dynamic)`, and Next
    // 15 defaults staleTimes.dynamic to 0 -- the client Router Cache holds a
    // dynamic route's prefetched RSC payload for ZERO time. <Link> already
    // prefetches every link the moment it enters the viewport (App Router's
    // default, not something this file needs to opt into), and every nav
    // link in components/app-bar.tsx sits in the always-visible sticky top
    // bar, so that prefetch was already firing for all five-to-six
    // destinations on every page load -- it just wasn't being KEPT. With
    // staleTimes=0 the prefetched payload is discarded before a click could
    // ever use it, so every navigation paid a full server round-trip
    // (withAuth() + Postgres + Redis) regardless. This gives the client
    // cache a real, short TTL instead: a click within 30s of the page
    // loading is served from the already-warm prefetch, instantly; past 30s
    // it refetches, same as today.
    //
    // 30s, not longer, on purpose -- see webhooks/bachs/route.ts's header
    // for the invalidation half of this trade. That route is the one place
    // in the app where account state changes without a Next.js Server
    // Action in the loop to call revalidatePath from, so it's also the one
    // place a stale client cache can't be helped by server-side
    // invalidation alone (an already-open tab has no push channel telling
    // it to drop its cache early). 30s bounds how long that specific gap
    // can show a stale plan or subscription status, while still being long
    // enough to make same-session tab-hopping feel instant.
    staleTimes: {
      dynamic: 30,
    },
  },

  // /quota became /usage and /keys became /access when the dashboard grew a
  // real information architecture. Permanent redirects rather than nothing:
  // both paths were linked from the old root's card grid and are plausibly
  // bookmarked, and a 404 on a path that worked yesterday is the kind of
  // small breakage that makes a product feel unmaintained.
  async redirects() {
    return [
      { source: '/quota', destination: '/usage', permanent: true },
      { source: '/keys', destination: '/access', permanent: true },
    ];
  },
};

// NO @next/mdx HERE. It was here, wired with both the default @mdx-js/loader
// pipeline and later Next's Rust mdxRs compiler, and BOTH crashed every
// single .mdx page at build time -- including a frontmatter-only file with
// two plain paragraphs and no imports, which is what ruled out post content
// as the cause. Disassembling the failing chunk traced the crash to
// node_modules/react/cjs/react-jsx-runtime.development.js reading
// `__SECRET_INTERNALS_DO_NOT_USE_OR_YOU_WILL_BE_FIRED.ReactCurrentOwner` off
// a `react` module that didn't have it -- consistent with the compiled MDX
// module's own `require("react/jsx-runtime")` resolving to the wrong build
// for the React Server Components layer it was actually running in. Both
// compiler backends emit that same bare specifier, so switching backends
// changed nothing; the mismatch tracks back to how Next's webpack config
// layers a dynamically-built context module (this app's
// `import(\`.../content/blog/${slug}.mdx\`)`) rather than to the compiler.
//
// blog/[slug]/page.tsx instead compiles each post's MDX body at RENDER time
// with next-mdx-remote/rsc's `compileMDX`, which takes its `jsx`/`jsxs`/
// `Fragment` implementations as explicit arguments from the calling Server
// Component rather than having the compiled module resolve its own
// `react/jsx-runtime` import -- the documented, RSC-safe way to render MDX
// content that isn't a static route file. Content is still 100%
// git-committed and read via lib/blog.ts's fs.readFileSync; nothing here
// introduces a runtime content source or a CMS.
export default nextConfig;
