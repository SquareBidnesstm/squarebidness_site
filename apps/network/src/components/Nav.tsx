import Link from "next/link";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="wrap nav__inner">
        <Link href="/" className="nav__logo">
          <img
            src="https://squarebidness.com/assets/cleantextlogo.png"
            alt="Square Bidness"
            height={22}
            style={{ height: 22, width: "auto" }}
          />
          <span className="nav__logo-badge">Network</span>
        </Link>
        <ul className="nav__links">
          <li><Link href="/news">News</Link></li>
          <li><Link href="/shows">Shows</Link></li>
          <li><Link href="/about">About</Link></li>
        </ul>
      </div>
    </nav>
  );
}
