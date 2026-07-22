const LOGIN_URL = "https://lab.squarebidness.com/tax-pass/office/login.html";
const SIGNUP_URL = "mailto:taxpass@squarebidness.com?subject=Tax Pass – Office Sign Up";

function TpLogo({ size = 32 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#e8711a" />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fill="#fff" fontFamily="ui-sans-serif,system-ui,-apple-system,sans-serif" fontSize="15" fontWeight="900" letterSpacing="-0.5">TP</text>
    </svg>
  );
}

export default function HomePage() {
  return (
    <>
      {/* ── Nav ──────────────────────────────────── */}
      <nav className="nav">
        <div className="wrap nav__inner">
          <a href="/" className="nav__brand">
            <TpLogo size={32} />
            <span className="nav__wordmark">Tax Pass<sup className="nav__tm">™</sup></span>
          </a>
          <div className="nav__links">
            <a href={LOGIN_URL} className="nav__login">Tax Office Login</a>
            <a href={SIGNUP_URL} className="btn btn--primary">Get Started</a>
          </div>
        </div>
      </nav>

      <main>
        {/* ── Hero ─────────────────────────────────── */}
        <section className="hero">
          <div className="wrap">
            <div className="hero__eyebrow">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
              Built for independent tax offices
            </div>
            <h1 className="hero__h1">
              Your clients.<br />
              Their documents.<br />
              <em>Delivered.</em>
            </h1>
            <p className="hero__sub">
              Tax Pass gives your office a digital intake link. Clients send W&#8209;2s, IDs,
              and documents from their phone. You get everything organized, secure, and
              ready to file — no paper, no email attachments.
            </p>
            <div className="hero__ctas">
              <a href={SIGNUP_URL} className="btn btn--primary btn--lg">
                Get Your Office Set Up
              </a>
              <a href={LOGIN_URL} className="btn btn--outline btn--lg">
                Tax Office Login
              </a>
            </div>
          </div>
        </section>

        {/* ── How it works ─────────────────────────── */}
        <section className="steps">
          <div className="wrap">
            <div className="steps__header">
              <p className="section__label">How it works</p>
              <h2 className="section__h2">Three steps. Zero paper.</h2>
              <p className="section__sub">From your first client to a full season — the same simple flow every time.</p>
            </div>
            <div className="steps__grid">
              <div className="step">
                <div className="step__num">Step 01</div>
                <div className="step__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <h3 className="step__h3">You share your office code</h3>
                <p className="step__p">We assign your office a unique code. Put it on your flyer, business card, or send it in a text. Clients use it to route their intake directly to you.</p>
              </div>
              <div className="step">
                <div className="step__num">Step 02</div>
                <div className="step__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                </div>
                <h3 className="step__h3">Clients send their documents</h3>
                <p className="step__p">They enter your code, fill in their contact and filing info, then upload W‑2s, IDs, and supporting documents — all from their phone, in minutes.</p>
              </div>
              <div className="step">
                <div className="step__num">Step 03</div>
                <div className="step__icon">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>
                </div>
                <h3 className="step__h3">You get everything organized</h3>
                <p className="step__p">Your dashboard shows each client's submission, their documents ready to download, and their current status. Update them as you move through the return.</p>
              </div>
            </div>
          </div>
        </section>

        {/* ── Features ─────────────────────────────── */}
        <section className="features">
          <div className="wrap">
            <div className="features__header">
              <p className="section__label">Features</p>
              <h2 className="section__h2">Everything your office needs.<br />Nothing you don&#39;t.</h2>
            </div>
            <div className="features__grid">
              <div className="feature">
                <div className="feature__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                </div>
                <div>
                  <h3 className="feature__h3">Organized client queue</h3>
                  <p className="feature__p">Every submission comes in labeled, timestamped, and sorted. No more digging through email threads or missed texts.</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                </div>
                <div>
                  <h3 className="feature__h3">Status tracking clients can check</h3>
                  <p className="feature__p">Each client gets a receipt ID. You update the status as you work — they check it themselves instead of calling your phone.</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div>
                  <h3 className="feature__h3">Secure file storage</h3>
                  <p className="feature__p">Documents are encrypted and stored on private infrastructure — not a third-party marketing platform. Your clients&#39; data stays yours.</p>
                </div>
              </div>
              <div className="feature">
                <div className="feature__icon">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
                </div>
                <div>
                  <h3 className="feature__h3">Phone-first for clients</h3>
                  <p className="feature__p">The intake form is built for mobile. Clients can complete the entire process — including document uploads — without a computer or printer.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Security strip ────────────────────────── */}
        <section className="security">
          <div className="wrap">
            <div className="security__inner">
              <div className="security__icon">
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
              </div>
              <div className="security__text">
                <strong>Private. Encrypted. Independently operated.</strong>
                <span>Your clients&#39; information goes directly to your office — not to any third-party marketing platform. Stored on encrypted, privately operated infrastructure by Square Bidness Tech Lab.</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Pilot ────────────────────────────────── */}
        <section className="pilot">
          <div className="wrap">
            <p className="pilot__label">Live in Louisiana</p>
            <p className="pilot__quote">&#8220;Clients send everything from their phone before they even walk in. It changes how the whole appointment goes.&#8221;</p>
            <p className="pilot__attr">— Pilot office, Alexandria, LA</p>
          </div>
        </section>

        {/* ── CTA ──────────────────────────────────── */}
        <section className="cta-section">
          <div className="wrap">
            <h2 className="cta-section__h2">Ready to go paperless<br />this season?</h2>
            <p className="cta-section__sub">Getting set up takes less than a day. Reach out and we&#39;ll get your office code issued and your dashboard ready.</p>
            <div className="cta-section__ctas">
              <a href={SIGNUP_URL} className="btn btn--primary btn--lg">
                Get Your Office Set Up
              </a>
              <a href={LOGIN_URL} className="btn btn--outline btn--lg">
                Tax Office Login
              </a>
            </div>
          </div>
        </section>
      </main>

      {/* ── Footer ───────────────────────────────── */}
      <footer className="footer">
        <div className="wrap">
          <div className="footer__inner">
            <div className="footer__brand">
              Tax Pass<span>™</span> &nbsp;·&nbsp; A Square Bidness product
            </div>
            <div className="footer__links">
              <a href="https://lab.squarebidness.com/tax-pass/" className="footer__link">Client Intake</a>
              <a href={LOGIN_URL} className="footer__link">Office Login</a>
              <a href="https://squarebidness.com/tax-pass/" className="footer__link">Learn More</a>
            </div>
            <p className="footer__copy">© {new Date().getFullYear()} Square Bidness Holdings, Inc.</p>
          </div>
        </div>
      </footer>
    </>
  );
}
