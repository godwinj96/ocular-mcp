import { BleedRule } from '../section-header';
import type { Post } from '../../../lib/blog';

// The block above every post.
//
// DELIBERATELY NOT SectionHeader, and this divergence needs to survive someone
// later deciding to "unify" them. SectionHeader is a lg:grid-cols-[5fr_7fr]
// split, and its own file argues at length that the split IS the point --
// stacking it left the right half of a 1240px measure empty, which is where
// the "our whitespace is wrong" complaint actually came from. None of that
// applies in a 536px reading column: there is no width to split. A split
// header would also put the title and deck on a shared optical top edge, which
// is the exact problem that forced the Outfit/Geist face separation over
// there -- and which evaporates when they are stacked.
//
// What it DOES keep is the mono eyebrow, verbatim. That eyebrow is what makes
// an article read as this site inside the first twenty pixels, and it costs
// nothing.

// The deck is in Geist, NOT font-brand, which is the other deliberate
// divergence. hero.tsx and section-header.tsx set their decks in Outfit
// because each sits BESIDE a Geist heading in a split and needs
// differentiating from a face it shares a top edge with. Here the description
// sits directly under the title and directly above two thousand words of
// Geist: a face switch for one paragraph and back is a stutter, and
// section-header.tsx's own warning -- two near-identical sans faces in direct
// adjacency read as a font-loading bug -- applies with more force stacked than
// split. Outfit is also wrong on mechanics for anything approaching prose:
// geometric, lower x-height, wide round counters, and no italic at any weight.
// Outfit appears NOWHERE in an article.

function formatDate(iso: string): string {
  // Day-month-year, spelled month, so 09/11 can never be read two ways. UTC
  // because the input is a calendar date with no timezone and parsing it as
  // local would shift it a day west of Greenwich.
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function ArticleHeader({ post, kind }: { post: Post; kind: string }) {
  return (
    <header>
      <p className="font-mono text-[11px] font-medium uppercase leading-none tracking-[0.16em] text-text-quaternary">
        {kind}
      </p>

      <h1 className="mt-stack-2 text-[clamp(2rem,1.15rem+2.9vw,3rem)] font-medium leading-[1.08] tracking-[-0.022em] text-text-primary [text-wrap:balance]">
        {post.title}
      </h1>

      {/* 1.08 and not SectionHeader's 1.0. That heading is capped at
          max-w-[12ch] -- one or two words. An article title has no such cap
          and will run two or three lines at this measure, where 1.0 collides
          line two's ascenders with line one's descenders. */}
      <p className="mt-stack-2 text-[18px] leading-[1.5] tracking-[-0.012em] text-text-secondary [text-wrap:pretty] sm:text-[20px]">
        {post.description}
      </p>

      {/* ONE string, used as both the on-page deck and the meta description.
          Two strings drift, and the one nobody looks at is the one search
          results show. */}

      <p className="mt-stack-3 flex flex-wrap gap-x-2 font-mono text-[12px] leading-none tracking-[0.02em] text-text-tertiary">
        <span>Godwin James</span>
        <span aria-hidden="true">·</span>
        <span>
          <time dateTime={post.publishedAt}>{formatDate(post.publishedAt)}</time>
        </span>
        {post.updatedAt ? (
          <>
            <span aria-hidden="true">·</span>
            <span>
              Updated <time dateTime={post.updatedAt}>{formatDate(post.updatedAt)}</time>
            </span>
          </>
        ) : null}
        <span aria-hidden="true">·</span>
        <span>{post.readingMinutes} min read</span>
      </p>

      {/* The byline is a single mono line separated by middots because that is
          already this site's metadata idiom -- structurally identical to
          hero.tsx's "from $2.50/mo · unmetered on localhost · cancel any time".
          Zero new ideas.

          The DATE lives here at --text-tertiary (5.50:1, clears AA) rather
          than in the eyebrow at --text-quaternary (3.81:1), because
          quaternary's own token comment scopes it to NON-ESSENTIAL metadata
          and a publish date on a comparison post is the provenance claim --
          the first thing a sceptical reader checks. The eyebrow gets the kind
          instead, which genuinely is non-essential.

          No author avatar: a photograph introduces colour and texture to a
          page that has neither, and a circular crop is either a third radius
          or a pill pretending to be a portrait. */}

      <BleedRule />
    </header>
  );
}
