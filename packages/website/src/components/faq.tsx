// S6 · FAQ. Deliberately static — no reveal, no accordion.
//
// Static because a page that has been moving for four sections should be
// visibly still here; that contrast is what stops the motion reading as
// decoration. Not an accordion because a developer scanning for the one
// question that worries them shouldn't have to click seven times to find it.
//
// The questions are the uncomfortable ones. Ducking any of them would cost
// more trust than the answer does.
const FAQS = [
  {
    q: 'Does it slow my agent down?',
    a: 'The browser warms up when your agent connects, not when it first asks to look — so the wait people usually associate with this is spent before you notice it. A capture of your own dev server after that is a local render with no network round trip. Open-web captures take as long as the site takes to load.',
  },
  {
    q: 'Which clients does it work with?',
    a: "Any MCP client. Claude Code, Cursor, Windsurf, Cline, Zed, Claude Desktop — it's one line in the MCP config and there's nothing client-specific in it. If your client speaks MCP, it works.",
  },
  {
    q: "What happens when it can't see a site?",
    a: 'You get a failure with a reason — the site blocked automated access, or the site itself was down. Those are different problems, and your agent is told which one it hit, so it can decide whether retrying is worth anything. It never hangs, and it never quietly returns a blank page as if it worked. Your own dev server doesn’t fail this way; nothing there is trying to block you.',
  },
  {
    q: 'Is this safe?',
    a: 'Ocular cannot act on your browser — there is no click, type, or navigate to be triggered, by you or by a page. That is a real guarantee and it is the one worth making. Here is what it isn’t: captured page content enters your agent’s context, and a page can contain text written to steer an agent that reads it. That risk is the same as with any tool that reads the web, and read-only doesn’t touch it.',
  },
  {
    q: 'Is something running on my machine all the time?',
    a: 'A small supervisor process — a few megabytes, no window, no dock icon. It starts a browser when your agent connects and shuts that browser down after about half an hour of nothing happening. It listens on loopback only, so you won’t see a firewall prompt. You will find it in Activity Monitor if you go looking; that’s the honest answer, and it’s why the idle footprint is the number that matters.',
  },
  {
    q: 'What about pages I have to be logged into?',
    a: 'On your own machine, that’s coming: you sign into a site once, in Ocular’s own browser profile, and the session stays on your device. Ocular never receives a password and never stores a credential. On the open web it doesn’t do this and won’t — moving someone’s session off the device it was created on is a permanently worse idea, and browsers are actively killing it anyway.',
  },
  {
    q: 'Who built this?',
    a: 'One developer. It does one narrow thing on purpose. If something is broken or missing, there is exactly one person to tell, and he reads it.',
  },
] as const;

export function Faq() {
  return (
    <section
      className="pb-sec-lg pt-sec-sm"
      style={{ paddingLeft: 'var(--page-inset)', paddingRight: 'var(--page-inset)' }}
    >
      <div className="mx-auto max-w-[1240px]">
        <dl className="divide-y divide-rule-divider border-y border-rule-divider">
          {FAQS.map((item) => (
            <div
              key={item.q}
              className="grid grid-cols-1 gap-3 py-8 lg:grid-cols-[320px_1fr] lg:gap-12"
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
