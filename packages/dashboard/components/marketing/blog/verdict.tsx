// The answer, given before the argument. Per the product review: withholding
// the verdict to keep someone reading is the article-costume move, and a
// developer who searched a competitor's name is mid-evaluation, not at
// problem-awareness -- they can leave in twenty seconds with what they came
// for, which is correct for them, for SEO, and for GEO alike.
//
// Reuses the FAQ's own divided-list construction (dl, divide-y, border-y,
// [140px_1fr] instead of FAQ's [320px_1fr] -- these labels are three words,
// not a question). Borrowing the vocabulary, not the component, since the
// content shape genuinely differs.
type VerdictItem = { label: string; children: string };

export function Verdict({ items }: { items: VerdictItem[] }) {
  return (
    <dl className="divide-y divide-rule-divider border-y border-rule-divider">
      {items.map((item) => (
        <div
          key={item.label}
          className="grid grid-cols-1 gap-stack-1 py-stack-2 sm:grid-cols-[140px_1fr] sm:gap-6"
        >
          <dt className="font-mono text-[12px] font-medium uppercase leading-[1.4] tracking-[0.08em] text-text-quaternary">
            {item.label}
          </dt>
          <dd className="text-[16px] leading-[1.6] text-text-secondary [text-wrap:pretty]">
            {item.children}
          </dd>
        </div>
      ))}
    </dl>
  );
}
