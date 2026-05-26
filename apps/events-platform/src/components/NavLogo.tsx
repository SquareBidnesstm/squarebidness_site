import Link from "next/link";

export default function NavLogo() {
  return (
    <Link
      href="/"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textDecoration: "none" }}
    >
      <img
        src="/events-192.png"
        alt="SB Events"
        style={{ height: 40, width: 40, display: "block", borderRadius: 10 }}
      />
    </Link>
  );
}
