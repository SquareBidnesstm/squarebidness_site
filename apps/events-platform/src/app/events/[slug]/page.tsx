import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase/server";
import { EVENT_CATEGORIES } from "../../../lib/constants";
import NavLogo from "../../../components/NavLogo";
import FreeRSVPForm from "../../../components/FreeRSVPForm";
import ShareButton from "../../../components/ShareButton";
import WaitlistForm from "../../../components/WaitlistForm";
import CheckoutForm from "../../../components/CheckoutForm";

export const revalidate = 30;

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const { data: event } = await supabaseServer
    .from("events")
    .select("title, description, starts_at, venue_name, city, state, cover_image_url, category")
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!event) return { title: "Event Not Found" };

  const dateStr = new Date(event.starts_at).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric",
  });
  const location = [event.venue_name, event.city, event.state].filter(Boolean).join(", ");
  const description = event.description
    ? `${event.description.slice(0, 140)}…`
    : `${dateStr}${location ? ` · ${location}` : ""} — Get your tickets on Square Bidness Events.`;

  const image = event.cover_image_url ?? "/events-meta-1200x630.png";

  return {
    title: `${event.title} | Square Bidness Events`,
    description,
    openGraph: {
      title: event.title,
      description,
      type: "website",
      images: [{ url: image, width: 1200, height: 630 }],
      siteName: "Square Bidness Events",
    },
    twitter: {
      card: "summary_large_image",
      title: event.title,
      description,
      images: [image],
    },
  };
}

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
      organizers ( name, logo_url, bio, slug ),
      ticket_tiers ( * )
    `)
    .eq("slug", slug)
    .eq("status", "published")
    .single();

  if (!event) notFound();

  const tiers = (event.ticket_tiers ?? []).filter((t: any) => t.active).sort((a: any, b: any) => a.sort_order - b.sort_order);
  const isFreeEvent = tiers.length > 0 && tiers.every((t: any) => Number(t.price) === 0);
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
            <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
              <h1 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 950, letterSpacing: "-0.05em", lineHeight: 0.95, margin: 0 }}>
                {event.title}
              </h1>
              <ShareButton title={event.title} url={`https://events.squarebidness.com/events/${slug}`} />
            </div>

            {/* Date & Location */}
            <div className="card" style={{ marginBottom: 24, display: "grid", gap: 16 }}>
              <div>
                <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 4 }}>Date & Time</p>
                {eventDate.toDateString() === eventEnd.toDateString() ? (
                  <>
                    <p style={{ fontWeight: 800 }}>
                      {eventDate.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                    </p>
                    <p style={{ color: "#a1a1aa" }}>
                      {eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} – {eventEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </>
                ) : (
                  <>
                    <p style={{ fontWeight: 800 }}>
                      {eventDate.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} – {eventEnd.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                    </p>
                    <p style={{ color: "#a1a1aa" }}>
                      Starts {eventDate.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })} · Ends {eventEnd.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </>
                )}
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

            {/* Refund Policy */}
            {event.refund_policy && (
              <div className="card" style={{ marginBottom: 24 }}>
                <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>Refund Policy</p>
                <p style={{ fontWeight: 800, fontSize: "0.9rem", marginBottom: event.refund_policy_notes ? 4 : 0 }}>
                  {{
                    no_refunds: "No Refunds",
                    up_to_24h: "Refunds up to 24 hours before the event",
                    up_to_48h: "Refunds up to 48 hours before the event",
                    up_to_7d: "Refunds up to 7 days before the event",
                    custom: "Custom Policy",
                  }[event.refund_policy as string] ?? event.refund_policy}
                </p>
                {event.refund_policy_notes && <p style={{ color: "#71717a", fontSize: "0.85rem" }}>{event.refund_policy_notes}</p>}
              </div>
            )}

            {/* Organizer */}
            <div className="card">
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Organizer</p>
              <Link href={`/organizer/${(event.organizers as any)?.slug ?? ""}`} style={{ textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 10 }}>
                {(event.organizers as any)?.logo_url && (
                  <img src={(event.organizers as any).logo_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: "cover" }} />
                )}
                <p style={{ fontWeight: 800, color: "#fff" }}>{(event.organizers as any)?.name}</p>
              </Link>
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
                isFreeEvent ? (
                  <FreeRSVPForm
                    eventId={event.id}
                    tiers={tiers.filter((t: any) => (t.quantity - t.quantity_sold) > 0).map((t: any) => ({
                      id: t.id,
                      name: t.name,
                      description: t.description,
                      quantity: t.quantity,
                      quantity_sold: t.quantity_sold,
                    }))}
                  />
                ) : (
                  <div style={{ marginTop: 16 }}>
                    <CheckoutForm
                      eventSlug={event.slug}
                      eventId={event.id}
                      tiers={tiers.filter((t: any) => (t.quantity - t.quantity_sold) > 0).map((t: any) => ({
                        id: t.id,
                        name: t.name,
                        description: t.description,
                        price: Number(t.price),
                        quantity: t.quantity,
                        quantity_sold: t.quantity_sold,
                      }))}
                    />
                  </div>
                )
              )}
            </div>

            {/* Waitlist — shown when ALL tiers are sold out */}
            {tiers.length > 0 && tiers.every((t: any) => t.quantity - t.quantity_sold <= 0) && (
              <div style={{ marginTop: 16 }}>
                <WaitlistForm eventId={event.id} />
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
