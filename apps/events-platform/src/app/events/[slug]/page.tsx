import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase/server";
import { EVENT_CATEGORIES } from "../../../lib/constants";
import NavLogo from "../../../components/NavLogo";

export const revalidate = 30;

export default async function EventPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  const { data: event } = await supabaseServer
    .from("events")
    .select(`
      *,
      organizers ( name, logo_url, bio ),
      ticket_tiers ( * )
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!event) notFound();

  const tiers = (event.ticket_tiers ?? []).filter((t: any) => t.active).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const categoryLabel = EVENT_CATEGORIES.find(c => c.value === event.category)?.label ?? event.category;

  const eventDate = new Date(event.starts_at);
  const eventEnd = new Date(event.ends_at);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* NAV */}
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000", position: "sticky", top: 0, zIndex: 50 }}>
        <NavLogo />
        <Link href="/" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← All Events</Link>
      </nav>

      {/* COVER */}
      <div style={{ height: "clamp(200px, 35vw, 380px)", background: "#0a0a0a", overflow: "hidden" }}>
        {event.cover_image_url ? (
          <img src={event.cover_image_url} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem" }}>🎟️</div>
        )}
      </div>

      <main style={{ padding: "32px 14px 64px" }}>
        <div className="wrap" style={{ display: "grid", gridTemplateColumns: "1fr min(380px, 100%)", gap: 32, alignItems: "start" }}>

          {/* LEFT — Event Info */}
          <div>
            <span style={{ display: "inline-block", padding: "4px 10px", borderRadius: 999, background: "#0a1a0a", color: "#22c55e", border: "1px solid #166534", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 14 }}>
              {categoryLabel}
            </span>
            <h1 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 950, letterSpacing: "-0.05em", lineHeight: 0.95, marginBottom: 20 }}>
              {event.title}
            </h1>

            {/* Date & Location */}
            <div className="card" style={{ marginBottom: 24, display: "grid", gap: 16 }}>
              <div>
                <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Date & Time</p>
                <p style={{ fontWeight: 800 }}>
                  {eventDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                </p>
                <p style={{ color: "#a1a1aa" }}>
                  {eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – {eventEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              {(event.venue_name || event.address || event.city) && (
                <div>
                  <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Location</p>
                  {event.venue_name && <p style={{ fontWeight: 800 }}>{event.venue_name}</p>}
                  {event.address && <p style={{ color: "#a1a1aa" }}>{event.address}</p>}
                  {(event.city || event.state) && <p style={{ color: "#a1a1aa" }}>{[event.city, event.state].filter(Boolean).join(", ")}</p>}
                  {event.location_notes && <p style={{ color: "#a1a1aa", fontSize: "0.85rem", marginTop: 4 }}>{event.location_notes}</p>}
                </div>
              )}
            </div>

            {/* Description */}
            {event.description && (
              <div className="card" style={{ marginBottom: 24 }}>
                <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>About This Event</p>
                <p style={{ lineHeight: 1.65, color: "#d4d4d8" }}>{event.description}</p>
              </div>
            )}

            {/* Organizer */}
            <div className="card">
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Organizer</p>
              <p style={{ fontWeight: 800 }}>{(event.organizers as any)?.name}</p>
              {(event.organizers as any)?.bio && (
                <p style={{ color: "#a1a1aa", fontSize: "0.9rem", marginTop: 6 }}>{(event.organizers as any).bio}</p>
              )}
            </div>
          </div>

          {/* RIGHT — Ticket Tiers */}
          <div style={{ position: "sticky", top: 72 }}>
            <div className="card">
              <h2 style={{ fontSize: "1.1rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 16 }}>Get Tickets</h2>
              {tiers.length === 0 ? (
                <p style={{ color: "#a1a1aa" }}>No tickets available.</p>
              ) : (
                <div style={{ display: "grid", gap: 10 }}>
                  {tiers.map((tier: any) => {
                    const available = tier.quantity - tier.quantity_sold;
                    const soldOut = available <= 0;
                    return (
                      <div key={tier.id} style={{
                        padding: 14, borderRadius: 12, border: "1px solid #2a2a2d",
                        background: "#050505", opacity: soldOut ? 0.5 : 1,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 4 }}>
                          <div>
                            <p style={{ fontWeight: 900 }}>{tier.name}</p>
                            {tier.description && <p style={{ color: "#a1a1aa", fontSize: "0.85rem", marginTop: 2 }}>{tier.description}</p>}
                          </div>
                          <p style={{ fontWeight: 900, color: "#fff", whiteSpace: "nowrap", marginLeft: 12 }}>
                            {Number(tier.price) === 0 ? "Free" : `$${Number(tier.price).toFixed(2)}`}
                          </p>
                        </div>
                        {soldOut ? (
                          <span className="badge badge--red" style={{ marginTop: 8 }}>Sold Out</span>
                        ) : (
                          <p style={{ color: "#a1a1aa", fontSize: "0.8rem", marginTop: 4 }}>{available} remaining</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {tiers.some((t: any) => (t.quantity - t.quantity_sold) > 0) && (
                <form action="/api/checkout" method="POST" style={{ marginTop: 16 }}>
                  <input type="hidden" name="eventSlug" value={event.slug} />
                  <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
                    {tiers.filter((t: any) => (t.quantity - t.quantity_sold) > 0).map((tier: any) => (
                      <div key={tier.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <label htmlFor={`qty_${tier.id}`} style={{ fontSize: "0.9rem", fontWeight: 700 }}>{tier.name}</label>
                        <select
                          id={`qty_${tier.id}`}
                          name={`tier_${tier.id}`}
                          className="input"
                          style={{ width: 80 }}
                        >
                          {Array.from({ length: Math.min(tier.quantity - tier.quantity_sold, 10) + 1 }, (_, i) => (
                            <option key={i} value={i}>{i}</option>
                          ))}
                        </select>
                      </div>
                    ))}
                    <input name="buyerName" placeholder="Your Name" className="input" required />
                    <input name="buyerEmail" type="email" placeholder="Your Email" className="input" required />
                    <input name="buyerPhone" type="tel" placeholder="Phone (optional)" className="input" />
                  </div>
                  <button type="submit" className="btn btn--primary btn--wide">
                    Get Tickets
                  </button>
                  <p style={{ color: "#555", fontSize: "0.78rem", textAlign: "center", marginTop: 10 }}>
                    $1.00 platform fee per paid ticket · Secure checkout
                  </p>
                </form>
              )}
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}
