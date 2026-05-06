import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "SquareBidness — Booking Platform",
  description:
    "Professional appointment booking for barbershops, beauty salons, nail salons, spas, and lash studios. Get your shop online in minutes.",
  openGraph: {
    title: "SquareBidness — Booking Platform",
    description:
      "Professional appointment booking for barbershops, beauty salons, nail salons, spas, and lash studios.",
    url: "https://booking.squarebidness.com",
    siteName: "SquareBidness",
    images: [
      {
        url: "https://booking.squarebidness.com/og-platform.png",
        width: 1200,
        height: 630,
        alt: "SquareBidness — Booking Platform",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "SquareBidness — Booking Platform",
    description:
      "Professional appointment booking for barbershops, beauty salons, nail salons, spas, and lash studios.",
    images: ["https://booking.squarebidness.com/og-platform.png"],
  },
};

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
