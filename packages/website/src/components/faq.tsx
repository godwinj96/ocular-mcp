import type { ReactNode } from 'react';
import { BrandName } from './brand-name.js';
// S6 · FAQ. Deliberately static — no reveal, no accordion.
//
// Static because a page that has been moving for four sections should be
// visibly still here; that contrast is what stops the motion reading as
// decoration. Not an accordion because a developer scanning for the one
// question that worries them shouldn't have to click seven times to find it.
//
// The questions are the uncomfortable ones. Ducking any of them would cost
// more trust than the answer does.
// `a` is ReactNode, not string: the first mention of the product name in this
// section carries the brand silver (see brand-name.tsx). Everything else stays
// plain text.
const FAQS: { q: string; a: ReactNode }[] = [
  {
    q: 'Does it slow my agent down?',
    a: (
      <>
        <BrandName /> comes up when your agent connects, not when it first asks to look, so the wait
        people usually associate with this is spent before you notice it. A capture of your own dev
        server after that is a local render with no network round trip. Open-web captures take as
        long as the site takes to load.
      </>
    ),
  },
  {
    // The one place on the page where naming the do-it-yourself alternative is
    // correct. A survey of fourteen developer-tool sites found thirteen never
    // name it in their own voice, and the one that does uses a customer's
    // mouth. A FAQ heading is the same device: the question is in the READER's
    // voice, so the site is answering rather than attacking.
    //
    // The last sentence is not a hedge, it is the credibility. A page claiming
    // to beat every possible alternative reads as a page that has never met
    // one, and the population it disqualifies is small: per PRD 8.2, "most DIY
    // setups never finish or maintain past first-working-version."
    q: 'I already have something that takes screenshots. What does this add?',
    a: 'Reach, and not thinking about it. The same connection covers your dev server and pages on the open web, so your agent never has to hand the job back to you because the target was on the wrong side of a line. It comes up with the session rather than on the call that needs it, and it sits at ten-odd megabytes when nothing is happening. If what you have does all of that and you haven’t touched it in six months, you don’t need this.',
  },
  {
    q: 'Which clients does it work with?',
    a: "Any MCP client. Claude Code, Cursor, Windsurf, Cline, Zed, Claude Desktop — it's one line in the MCP config and there's nothing client-specific in it. If your client speaks MCP, it works.",
  },
  {
    q: "What happens when a site can't be reached?",
    a: 'You get a failure with a reason: the site blocked automated access, or the site itself was down. Those are different problems, and your agent is told which one it hit, so it can decide whether retrying is worth anything. It never hangs, and it never quietly returns a blank page as if it worked. Your own dev server doesn’t fail this way; nothing there is trying to block you.',
  },
  {
    q: 'Is this safe?',
    a: 'Ocular cannot act on your browser — there is no click, type, or navigate to be triggered, by you or by a page. That is a real guarantee and it is the one worth making. Here is what it isn’t: captured page content enters your agent’s context, and a page can contain text written to steer an agent that reads it. That risk is the same as with any tool that reads the web, and read-only doesn’t touch it.',
  },
  {
    q: 'Is something running on my machine all the time?',
    a: 'Yes, and it is meant to be dull. Ten to fifteen megabytes, no window, no dock icon. It starts a browser when your agent connects and shuts that browser down after about half an hour of nothing happening, so the part sitting there between sessions is the small part. It listens on loopback only, so you won’t see a firewall prompt. You will find it in Activity Monitor if you go looking; that’s the honest answer, and it’s why the idle number is the one worth quoting.',
  },
  {
    q: 'What about pages I have to be logged into?',
    a: 'On your own machine, that’s coming: you sign into a site once, in Ocular’s own browser profile, and the session stays on your device. Ocular never receives a password and never stores a credential. On the open web Ocular doesn’t do this, and it isn’t planned. Moving someone’s session off the device it was created on is a permanently worse idea, and browsers are actively killing it anyway.',
  },
  {
    q: 'Who built this?',
    a: 'One developer. It does one narrow thing on purpose. If something is broken or missing, there is exactly one person to tell, and he reads it.',
  },
];

export function Faq() {
  return (
    <section
      id="faq"
      className="pb-sec-tail pt-sec"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <dl className="divide-y divide-rule-divider border-y border-rule-divider">
          {FAQS.map((item) => (
            <div
              key={item.q}
              className="grid grid-cols-1 gap-stack-1 py-stack-3 lg:grid-cols-[320px_1fr] lg:gap-12"
            >
              <dt className="text-[19px] font-medium leading-[1.35] tracking-[-0.014em] text-text-primary [text-wrap:balance]">
                {item.q}
              </dt>
              <dd className="max-w-[62ch] text-[16px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
                {item.a}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
}
