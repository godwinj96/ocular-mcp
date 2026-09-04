// The product name, set in the brand silver.
//
// The founder's call: silver should "be used strategically like the brand
// colour it is, both in text and UI." This is the one text placement where
// silver means IDENTITY rather than importance — the wordmark in the nav is
// silver, and the word "Ocular" in a sentence is that wordmark rendered as
// text. It is the colour-domain equivalent of setting the CTAs in the
// wordmark's typeface.
//
// FIRST MENTION PER SECTION ONLY. Every instance would read as a highlighter,
// which is the failure mode the design agent flagged when it ranked this the
// first thing to cut. At 11.83:1 on the page ground and only ~15 L* off white,
// it lands as a small lift inside the sentence rather than as a pop.
export function BrandName() {
  return <span className="text-accent">Ocular</span>;
}
