import Link from "next/link";

export default function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="footer">
      <div className="wrap">
        <div className="footer__grid">
          <div>
            <div className="footer__brand-name">SB Network</div>
            <p className="footer__brand-desc">
              Louisiana-rooted. Community-first. The Square Bidness content platform covering business, culture, and community across the region.
            </p>
          </div>
          <div>
            <div className="footer__col-title">Content</div>
            <ul className="footer__links">
              <li><Link href="/news">News</Link></li>
              <li><Link href="/shows">Shows</Link></li>
            </ul>
          </div>
          <div>
            <div className="footer__col-title">Platform</div>
            <ul className="footer__links">
              <li><a href="https://squarebidness.com">Square Bidness</a></li>
              <li><a href="https://booking.squarebidness.com">Booking</a></li>
              <li><a href="https://events.squarebidness.com">Events</a></li>
              <li><a href="https://health.squarebidness.com">Health</a></li>
            </ul>
          </div>
          <div>
            <div className="footer__col-title">Company</div>
            <ul className="footer__links">
              <li><Link href="/about">About</Link></li>
              <li><a href="mailto:network@squarebidness.com">Contact</a></li>
            </ul>
          </div>
        </div>
        <div className="footer__bottom">
          <span>&copy; {year} Square Bidness Holdings, Inc. All rights reserved.</span>
          <span>network.squarebidness.com</span>
        </div>
      </div>
    </footer>
  );
}
