import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase/server";
import { EVENT_CATEGORIES } from "../../../lib/constants";
import NavLogo from "../../../components/NavLogo";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ groupId: string }> }): Promise<Metadata> {
  const { groupId } = await params;
  const { data } = await supabaseServer
    .from("events")
    .select("title")
    .eq("recurrence_group_id", groupId)
    .order("starts_at", { ascending: true })
    .limit(1)
    .single();
  if (!data) return { title: "Event Series" };
  const base = data.title.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
  return {
    title: `${base} — All Dates`,
    description: `See all dates for the ${base} event series on Square Bidness Events.`,
  };
}

export default async function SeriesPage({ params }: { params: Promise<{ groupId: string }> }) {
  const { groupId } = await params;

  const { data: events } = await supabaseServer
    .from("events")
    .select(`
      id, slug, title, status, starts_at, ends_at,
      venue_name, city, state, cover_image_url, category,
      organizers ( name, slug, logo_url ),
      ticket_tiers ( price, quantity, quantity_sold )
    `)
    .eq("recurrence_group_id", groupId)
    .order("starts_at", { ascending: true });

  if (!events?.length) notFound();

  const now = new Date();
  const baseName = events[0].title.replace(/\s*\(\d+\/\d+\)\s*$/, "").trim();
  const organizer = (events[0].organizers as any);
  const categoryLabel = EVENT_CATEGORIES.find(c => c.value === events[0].category)?.label ?? events[0].category;

  const upcoming = events.filter(e => new Date(e.starts_at) >= now && e.status === "published");
  const past = events.filter(e => new Date(e.starts_at) < now || e.status !== "published");

  function EventRow({ event }: { event: typeof events[0] }) {
    const tiers = (event.ticket_tiers ?? []) as any[];
    const minPrice = tiers.length ? Math.min(...tiers.map((t: any) => Number(t.price))) : null;
    const soldOut = tiers.length > 0 && tiers.every((t: any) => t.quantity_sold >= t.quantity);
    const isPast = new Date(event.starts_at) < now;
    const isCancelled = event.status === "cancelled";
    const location = [event.venue_name, event.city, event.state].filter(Boolean).join(", ");

    return (
      <Link
        href={isCancelled || isPast ? "#" : `/events/${event.slug}`}
        style={{ textDecoration: "none", pointerEvents: isCancelled ? "none" : "auto" }}
      >
        <div style={{
          display: "flex", gap: 16, alignItems: "center",
          padding: "16px", background: "#050505",
          border: `1px solid ${isCancelled ? "#7f1d1d" : "#1d1d1f"}`,
          borderRadius: 12, opacity: isPast || isCancelled ? 0.55 : 1,
          transition: "border-color 0.15s",
        }}>
          {/* Date block */}
          <div style={{ flexShrink: 0, width: 52, textAlign: "center" }}>
            <p style={{ fontSize: 11, fontWeight: 900, color: "#ef4444", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              {new Date(event.starts_at).toLocaleDateString("en-US", { month: "short" })}
            </p>
            <p style={{ fontSize: "1.8rem", fontWeight: 950, lineHeight: 1, color: "#fff" }}>
              {new Date(event.starts_at).getDate()}
            </p>
            <p style={{ fontSize: 11, color: "#555", marginTop: 2 }}>
              {new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short" })}
            </p>
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
              <p style={{ fontWeight: 900, fontSize: "0.95rem", color: "#fff" }}>{event.title}</p>
              {isCancelled && (
                <span style={{ fontSize: "0.7rem", fontWeight: 900, padding: "2px 8px", borderRadius: 99, background: "#1a0a0a", color: "#ef4444", border: "1px solid #7f1d1d", textTransform: "uppercase" }}>Cancelled</span>
              )}
              {soldOut && !isCancelled && (
                <span style={{ fontSize: "0.7rem", fontWeight: 900, padding: "2px 8px", borderRadius: 99, background: "#1a0a0a", color: "#ef4444", border: "1px solid #7f1d1d", textTransform: "uppercase" }}>Sold Out</span>
              )}
            </div>
            <p style={{ color: "#a1a1aa", fontSize: "0.82rem" }}>
              {new Date(event.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
              {location ? ` · ${location}` : ""}
            </p>
          </div>

          {/* Price */}
          {!isCancelled && (
            <div style={{ flexShrink: 0, textAlign: "right" }}>
              <p style={{ fontWeight: 900, color: isPast ? "#555" : "#fff" }}>
                {minPrice === 0 || minPrice === null ? "Free" : `From $${Number(minPrice).toFixed(2)}`}
              </p>
              {!isPast && !soldOut && (
                <p style={{ color: "#ef4444", fontSize: "0.78rem", fontWeight: 800 }}>Get tickets →</p>
              )}
            </div>
          )}
        </div>
      </Link>
    );
  }

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000", position: "sticky", top: 0, zIndex: 50 }}>
        <NavLogo />
        <Link href="/" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← All Events</Link>
      </nav>

      {/* Cover image from first event */}
      {events[0].cover_image_url && (
        <div style={{ height: 220, overflow: "hidden", position: "relative" }}>
          <img src={events[0].cover_image_url} alt={baseName} style={{ width: "100%", height: "100%", objectFit: "cover", filter: "brightness(0.4)" }} />
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to top, #000 30%, transparent)" }} />
        </div>
      )}

      <header style={{ padding: "32px 14px 24px", borderBottom: "1px solid #111", background: "#000" }}>
        <div className="wrap">
          <p style={{ color: "#22c55e", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 8 }}>
            {categoryLabel} · Event Series
          </p>
          <h1 style={{ fontSize: "clamp(1.8rem, 5vw, 3rem)", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 12 }}>
            {baseName}
          </h1>
          {organizer && (
            <Link href={`/organizer/${organizer.slug}`} style={{ display: "inline-flex", alignItems: "center", gap: 8, textDecoration: "none" }}>
              {organizer.logo_url && <img src={organizer.logo_url} alt={organizer.name} style={{ width: 28, height: 28, borderRadius: 6, objectFit: "cover" }} />}
              <span style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>by <strong style={{ color: "#fff" }}>{organizer.name}</strong></span>
            </Link>
          )}
          <div style={{ display: "flex", gap: 16, marginTop: 16, fontSize: "0.85rem", color: "#555" }}>
            <span>{events.length} date{events.length !== 1 ? "s" : ""} total</span>
            {upcoming.length > 0 && <span style={{ color: "#22c55e" }}>{upcoming.length} upcoming</span>}
          </div>
        </div>
      </header>

      <main style={{ padding: "32px 14px 64px" }}>
        <div className="wrap" style={{ maxWidth: 680, margin: "0 auto" }}>

          {upcoming.length > 0 && (
            <>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                Upcoming ({upcoming.length})
              </p>
              <div style={{ display: "grid", gap: 10, marginBottom: 32 }}>
                {upcoming.map((ev: any) => <EventRow key={ev.id} event={ev} />)}
              </div>
            </>
          )}

          {past.length > 0 && (
            <>
              <p style={{ color: "#555", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                Past ({past.length})
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {past.map((ev: any) => <EventRow key={ev.id} event={ev} />)}
              </div>
            </>
          )}

        </div>
      </main>
    </div>
  );
}
