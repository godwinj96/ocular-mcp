// PLACEHOLDER. The real homepage is ported from packages/website in the next
// step; this exists so the route-group split can be verified on its own --
// static rendering, middleware exemption, and the /dashboard move -- before
// twenty components land on top of it and make a regression hard to localise.
export const metadata = {
  title: 'Ocular — Real eyes for AI agents',
  description:
    'Read-only visual perception for AI coding agents. Your dev server and the open web, from one connection.',
};

export default function HomePage() {
  return (
    <main className="mx-auto max-w-[1240px] px-6 py-24">
      <h1 className="text-[clamp(2.25rem,1.5rem+2.6vw,4rem)] font-normal leading-[1.0] tracking-[-0.022em] text-text-primary">
        Ocular
      </h1>
      <p className="mt-6 max-w-[52ch] text-[16px] leading-[1.6] text-text-secondary">
        Placeholder homepage. The marketing site is ported in the next step.
      </p>
    </main>
  );
}
