import Link from "next/link";

export default function PlatformLanding() {
  return (
    <main
      style={{
        minHeight: "100vh",
        background: "#050505",
        color: "#ffffff",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "56px 24px",
        textAlign: "center",
      }}
    >
      <div
        style={{
          color: "#d4af37",
          fontSize: 12,
          letterSpacing: "0.22em",
          textTransform: "uppercase",
          marginBottom: 16,
        }}
      >
        SquareBidness
      </div>

      <h1 style={{ fontSize: 48, fontWeight: 900, margin: "0 0 16px" }}>
        Booking Platform
      </h1>

      <p style={{ color: "#555", fontSize: 16, marginBottom: 40, maxWidth: 440 }}>
        Professional booking for barbers and beauty shops.
      </p>

      <Link
        href="/onboard"
        style={{
          display: "inline-block",
          padding: "16px 32px",
          background: "#d4af37",
          color: "#000",
          fontWeight: 800,
          borderRadius: 12,
          fontSize: 16,
          textDecoration: "none",
        }}
      >
        Get Your Shop Online
      </Link>

      <p style={{ color: "#333", fontSize: 13, marginTop: 24 }}>
        Already set up?{" "}
        <span style={{ color: "#555" }}>Go to booking.squarebidness.com/your-shop-name</span>
      </p>
    </main>
  );
}
