// Specimen page A — a fictional storefront checkout, rendered as DOM at a
// notional 1440x900 and scaled into a demo frame.
//
// WHY THIS EXISTS. Every demo on this page used to be a skeleton — grey bars
// standing in for content. Research across linear.app, stripe.com, warp.dev
// and chromatic.com found not one marketing demo on any of them using a
// skeleton: Linear's hero is a complete app screen down to a real sentence in
// the activity feed, and Stripe mocks payments with invented brands carrying
// real product names and odd prices (Powdur, "Pure set", $65.00). A viewer
// has nothing to recognise in a grey bar, so the demo cannot carry its
// section's meaning on its own — which was the founder's exact note.
//
// Invented brand, deliberately: screenshots of real sites would put other
// companies' trademarks on our marketing page. Stripe is the precedent for
// solving it this way.
//
// WHY DOM AND NOT A SCREENSHOT. The overlay boxes and the tree readout's
// coordinate strings can be derived from real geometry, so they stay honest
// when this page is edited. It also costs no image weight, which matters on
// a page whose premise is not being heavier than the product it sells.
//
// WHY IT LOOKS NOTHING LIKE US. It has to read as a DIFFERENT page being
// observed, not as more of our own site. Light ground against our near-black,
// a warm terracotta accent (our violet and — especially — the teal overlay
// colour stay ours alone, or the boxes stop reading as the instrument), a
// plain UI type stack with no mono anywhere, and 8px/4px radii against our
// single 6px. Founder ruled on the rule tension explicitly: the no-shadow,
// no-gradient rules govern OUR chrome, and a specimen is quoted material.
//
// The legible strings are chosen, not incidental. At this scale body text
// renders around 7px — word shapes read as a real page while only what we
// deliberately size up is readable. `Checkout`, `Place order`, `Order
// summary` and `3 items · $184.00` are exactly the strings demo-tree-readout
// names in its accessibility tree, so picture and tree describe one thing.
const ITEMS = [
  { name: 'Merino crew', variant: 'Fog · M', price: '$92.00' },
  { name: 'Oxford shirt', variant: 'Ecru · M', price: '$68.00' },
  { name: 'Cotton socks, 2-pack', variant: 'Slate', price: '$24.00' },
] as const;

export function NorthsoundCheckout() {
  return (
    <div className="specimen" style={{ width: 1440, height: 900 }}>
      <header className="specimen-bar">
        <span className="specimen-wordmark">Northsound</span>
        <nav className="specimen-steps">
          <span>Cart</span>
          <span className="specimen-step-on">Delivery</span>
          <span>Payment</span>
        </nav>
        <span className="specimen-help">Need help?</span>
      </header>

      <div className="specimen-body">
        <main className="specimen-main">
          {/* The h1 the tree names. Sized up so it is legible at scale. */}
          <h1 className="specimen-h1">Checkout</h1>
          <p className="specimen-sub">
            Delivering to United Kingdom · Est. delivery Sep 8&ndash;10
          </p>

          <section className="specimen-block">
            <h2 className="specimen-h2">Delivery route</h2>
            <canvas width={640} height={150} className="specimen-canvas" />
          </section>

          <section className="specimen-block">
            <h2 className="specimen-h2">Contact</h2>
            <div className="specimen-field">rowan.pike@fastmail.com</div>
          </section>

          <section className="specimen-block">
            <h2 className="specimen-h2">Shipping address</h2>
            <div className="specimen-grid-2">
              <div className="specimen-field">Rowan Pike</div>
              <div className="specimen-field">+44 7700 900412</div>
            </div>
            <div className="specimen-field">14 Wallace Terrace, Flat 2</div>
            <div className="specimen-grid-3">
              <div className="specimen-field">Edinburgh</div>
              <div className="specimen-field">EH8 9LN</div>
              <div className="specimen-field">United Kingdom</div>
            </div>
          </section>

          <section className="specimen-block">
            <h2 className="specimen-h2">Payment</h2>
            <div className="specimen-field specimen-card">
              <span className="specimen-brand-dot" aria-hidden="true" />
              <span>
                &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; &bull;&bull;&bull;&bull; 4242
              </span>
              <span className="specimen-muted">09 / 28</span>
            </div>
            <p className="specimen-micro">
              By placing this order you agree to the Terms of Sale and the Returns Policy.
            </p>
          </section>

          <section className="specimen-block">
            <h2 className="specimen-h2">Returns &amp; exchanges</h2>
            <p className="specimen-returns">
              Free returns within 30 days, in the original packaging. Exchanges are processed as a
              refund and a new order.
            </p>
          </section>
        </main>

        <aside className="specimen-aside">
          {/* The section name the tree reports as below-fold. */}
          <h2 className="specimen-h2 specimen-summary-title">Order summary</h2>

          <ul className="specimen-items">
            {ITEMS.map((item) => (
              <li key={item.name} className="specimen-item">
                <span className="specimen-thumb" aria-hidden="true" />
                <span className="specimen-item-text">
                  <span className="specimen-item-name">{item.name}</span>
                  <span className="specimen-muted">{item.variant}</span>
                </span>
                <span className="specimen-price">{item.price}</span>
              </li>
            ))}
          </ul>

          <dl className="specimen-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>$184.00</dd>
            </div>
            <div>
              <dt>Shipping</dt>
              <dd>$12.50</dd>
            </div>
            <div>
              <dt>Estimated tax</dt>
              <dd>$0.00</dd>
            </div>
          </dl>

          {/* The paragraph the tree quotes verbatim. */}
          <p className="specimen-total-line">3 items &middot; $184.00</p>

          <button type="button" className="specimen-cta">
            Place order
          </button>
          <p className="specimen-micro specimen-center">
            You won&rsquo;t be charged until your order ships.
          </p>
        </aside>
      </div>
    </div>
  );
}
