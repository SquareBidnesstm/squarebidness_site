import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About",
  description: "About SB Network — the content platform from Square Bidness Holdings.",
};

const PARISHES = [
  "Tangipahoa",
  "Rapides",
  "Washington",
  "St. Helena",
  "Livingston",
  "St. Landry",
  "Avoyelles",
];

const VERTICALS = [
  { name: "SB Booking", desc: "Online appointment booking for barbers, nail techs, and beauty professionals.", url: "https://booking.squarebidness.com" },
  { name: "SB Events", desc: "Ticket sales and event management for local organizers.", url: "https://events.squarebidness.com" },
  { name: "SB Health", desc: "CNA staffing platform serving the 7-parish Louisiana region.", url: "https://health.squarebidness.com" },
  { name: "SB FleetLog", desc: "Fleet and trucking operations management.", url: "https://trucking.squarebidness.com" },
  { name: "Tax Pass", desc: "Digital tax intake and preparation for individuals and small businesses.", url: "https://taxpass.squarebidness.com" },
  { name: "SB Studio", desc: "Creator tools and content production platform.", url: "https://studio.squarebidness.com" },
];

export default function AboutPage() {
  return (
    <main>
      <div className="wrap--narrow">
        <div style={{ padding: "56px 0 48px", borderBottom: "1px solid var(--border)" }}>
          <div style={{ fontSize: "0.72rem", fontWeight: 800, letterSpacing: "0.14em", textTransform: "uppercase", color: "var(--gold)", marginBottom: 16 }}>
            About the Network
          </div>
          <h1 style={{ fontSize: "clamp(2rem, 4vw, 3rem)", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 20 }}>
            Louisiana&apos;s platform for community, business, and culture.
          </h1>
          <p style={{ color: "var(--muted)", fontSize: "1rem", lineHeight: 1.7, marginBottom: 16 }}>
            SB Network is the content and publishing arm of Square Bidness Holdings, Inc. We cover the people, businesses, and stories driving the region forward — with a focus on the 7 Louisiana parishes we serve directly.
          </p>
          <p style={{ color: "var(--muted)", fontSize: "1rem", lineHeight: 1.7 }}>
            Square Bidness Holdings is an independent technology company headquartered in Tangipahoa Parish, Louisiana, building infrastructure and platforms for small businesses across the region.
          </p>
        </div>

        {/* Coverage area */}
        <div style={{ padding: "48px 0", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 20 }}>Coverage Area</h2>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {PARISHES.map((p) => (
              <span
                key={p}
                style={{
                  padding: "8px 18px",
                  borderRadius: 999,
                  border: "1px solid var(--gold-border)",
                  background: "var(--gold-dim)",
                  color: "var(--gold)",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                }}
              >
                {p}
              </span>
            ))}
          </div>
        </div>

        {/* Platform verticals */}
        <div style={{ padding: "48px 0", borderBottom: "1px solid var(--border)" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 24 }}>The Platform</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {VERTICALS.map((v) => (
              <a
                key={v.name}
                href={v.url}
                target="_blank"
                rel="noopener noreferrer"
                className="vertical-card"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "18px 20px",
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--radius)",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ fontWeight: 800, marginBottom: 4 }}>{v.name}</div>
                  <div style={{ fontSize: "0.82rem", color: "var(--muted)" }}>{v.desc}</div>
                </div>
                <span style={{ color: "var(--muted)", fontSize: "0.8rem", flexShrink: 0 }}>&rarr;</span>
              </a>
            ))}
          </div>
        </div>

        {/* Contact */}
        <div style={{ padding: "48px 0 80px" }}>
          <h2 style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-0.02em", marginBottom: 16 }}>Contact</h2>
          <p style={{ color: "var(--muted)", fontSize: "0.9rem", marginBottom: 20 }}>
            For editorial inquiries, content submissions, or partnership opportunities:
          </p>
          <a href="mailto:network@squarebidness.com" className="btn btn--gold">
            network@squarebidness.com
          </a>
        </div>
      </div>
    </main>
  );
}
