import Link from "next/link";

export default function NavLogo() {
  return (
    <Link
      href="/"
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textDecoration: "none" }}
    >
      <img
        src="/sb-mark.png"
        alt="Square Bidness"
        style={{ height: 36, width: "auto", display: "block" }}
      />
      <span style={{
        color: "#fff",
        fontSize: "0.6rem",
        fontWeight: 900,
        letterSpacing: "0.18em",
        textTransform: "uppercase",
        lineHeight: 1,
      }}>
        Events
      </span>
    </Link>
  );
}
