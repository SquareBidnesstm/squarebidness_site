import Link from "next/link";
import { supabaseServer } from "../../lib/supabase/server";
import { EVENT_CATEGORIES } from "../../lib/constants";
import type { Metadata } from "next";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Square Bidness Events",
  description: "Louisiana events — concerts, comedy, trail rides, pop-ups and more. Buy tickets in seconds.",
  openGraph: {
    images: [{ url: "https://events.squarebidness.com/events-192.png" }],
  },
};

export default async function LinkInBioPage() {
  const now = new Date().toISOString();

  const { data: events } = await supabaseServer
    .from("events")
    .select(`
      id, slug, title, category, starts_at,
      venue_name, city, state, cover_image_url,
      ticket_tiers ( price, quantity, quantity_sold )
    `)
    .eq("status", "published")
    .eq("is_public", true)
    .gte("starts_at", now)
    .order("starts_at", { ascending: true })
    .limit(8);

  const eventList = events ?? [];

  return (
    <div style={{ minHeight: "100vh", background: "#000", fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif" }}>
      {/* Hero */}
      <div style={{
        background: "radial-gradient(circle at 50% 0%, rgba(239,68,68,.12), transparent 55%), #000",
        padding: "48px 20px 36px",
        textAlign: "center",
        borderBottom: "1px solid #111",
      }}>
        <img
          src="/events-192.png"
          alt="SB Events"
          width={72}
          height={72}
          style={{ borderRadius: 18, display: "block", margin: "0 auto 14px" }}
        />
        <h1 style={{ fontSize: "1.5rem", fontWeight: 950, letterSpacing: "-0.04em", color: "#fff", margin: "0 0 6px" }}>
          Square Bidness Events
        </h1>
        <p style={{ color: "#a1a1aa", fontSize: "0.9rem", margin: "0 0 20px" }}>
          Louisiana events — buy tickets in seconds
        </p>

        {/* Primary CTA */}
        <Link
          href="/"
          style={{
            display: "inline-block",
            background: "#ef4444",
            color: "#fff",
            fontWeight: 900,
            fontSize: "0.95rem",
            padding: "12px 28px",
            borderRadius: 999,
            textDecoration: "none",
            marginBottom: 10,
          }}
        >
          Browse All Events →
        </Link>
      </div>

      {/* Events list */}
      <div style={{ padding: "24px 16px 64px", maxWidth: 480, margin: "0 auto" }}>
        {eventList.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 0", color: "#555" }}>
            <p>More events coming soon.</p>
            <Link href="/" style={{ color: "#ef4444", fontWeight: 700, textDecoration: "none" }}>View all events</Link>
          </div>
        ) : (
          <div style={{ display: "grid", gap: 12 }}>
            {eventList.map((event: any) => {
              const tiers = event.ticket_tiers ?? [];
              const minPrice = tiers.length
                ? Math.min(...tiers.map((t: any) => Number(t.price)))
                : null;
              const soldOut = tiers.length > 0 && tiers.every(
                (t: any) => t.quantity_sold >= t.quantity
              );
              const label = EVENT_CATEGORIES.find(c => c.value === event.category)?.label ?? event.category;
              const eventDate = new Date(event.starts_at).toLocaleDateString("en-US", {
                weekday: "short", month: "short", day: "numeric",
              });
              const location = [event.venue_name, event.city].filter(Boolean).join(", ");

              return (
                <Link
                  key={event.id}
                  href={`/events/${event.slug}`}
                  style={{ textDecoration: "none" }}
                >
                  <div style={{
                    display: "flex",
                    gap: 14,
                    background: "#080808",
                    border: "1px solid #1d1d1f",
                    borderRadius: 14,
                    overflow: "hidden",
                    alignItems: "stretch",
                    minHeight: 88,
                  }}>
                    {/* Cover */}
                    <div style={{
                      width: 88,
                      flexShrink: 0,
                      background: "#111",
                      position: "relative",
                    }}>
                      {event.cover_image_url ? (
                        <img
                          src={event.cover_image_url}
                          alt={event.title}
                          style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
                        />
                      ) : (
                        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.6rem" }}>
                          🎟️
                        </div>
                      )}
                      {soldOut && (
                        <div style={{
                          position: "absolute", inset: 0,
                          background: "rgba(0,0,0,0.65)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                        }}>
                          <span style={{ color: "#ef4444", fontSize: "0.6rem", fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase" }}>Sold Out</span>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div style={{ padding: "14px 14px 14px 0", flex: 1, minWidth: 0 }}>
                      <p style={{ color: "#ef4444", fontSize: "0.65rem", fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", margin: "0 0 4px" }}>
                        {label}
                      </p>
                      <p style={{ color: "#fff", fontWeight: 900, fontSize: "0.95rem", letterSpacing: "-0.02em", margin: "0 0 5px", lineHeight: 1.2 }}>
                        {event.title}
                      </p>
                      <p style={{ color: "#a1a1aa", fontSize: "0.75rem", margin: "0 0 2px" }}>{eventDate}</p>
                      {location && <p style={{ color: "#555", fontSize: "0.72rem", margin: 0 }}>{location}</p>}
                    </div>

                    {/* Price */}
                    <div style={{
                      padding: "14px 14px 14px 0",
                      display: "flex", alignItems: "center", flexShrink: 0,
                    }}>
                      <span style={{ fontWeight: 900, color: "#fff", fontSize: "0.9rem", whiteSpace: "nowrap" }}>
                        {soldOut ? <span style={{ color: "#555" }}>—</span> : (minPrice === 0 || minPrice === null ? "Free" : `$${Number(minPrice).toFixed(0)}`)}
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Footer links */}
        <div style={{ marginTop: 32, display: "flex", flexDirection: "column", gap: 10 }}>
          <Link
            href="/organizer/signup"
            style={{
              display: "block", textAlign: "center",
              border: "1px solid #242427", borderRadius: 12,
              padding: "13px 0", color: "#a1a1aa", fontWeight: 700,
              fontSize: "0.85rem", textDecoration: "none",
              background: "#050505",
            }}
          >
            🎤 List Your Event
          </Link>
          <Link
            href="/my-tickets"
            style={{
              display: "block", textAlign: "center",
              border: "1px solid #242427", borderRadius: 12,
              padding: "13px 0", color: "#a1a1aa", fontWeight: 700,
              fontSize: "0.85rem", textDecoration: "none",
              background: "#050505",
            }}
          >
            🎟️ Find My Tickets
          </Link>
        </div>

        <p style={{ textAlign: "center", color: "#333", fontSize: "0.75rem", marginTop: 32 }}>
          © {new Date().getFullYear()} Square Bidness
        </p>
      </div>
    </div>
  );
}
