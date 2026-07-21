import Link from "next/link";

export default function Nav() {
  return (
    <nav className="nav">
      <div className="wrap nav__inner">
        <Link href="/" className="nav__logo">
          <img
            src="/gold-network-48.png"
            alt="SB Network"
            height={36}
            style={{ height: 36, width: "auto" }}
          />
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
