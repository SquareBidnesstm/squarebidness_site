import Link from "next/link";
import { supabaseServer } from "../lib/supabase/server";
import { EVENT_CATEGORIES } from "../lib/constants";

export const revalidate = 60;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string }>;
}) {
  const { category, q } = await searchParams;

  let query = supabaseServer
    .from("events")
    .select(`
      id, slug, title, category, starts_at, ends_at,
      venue_name, city, state, cover_image_url, status,
      organizers ( name ),
      ticket_tiers ( price, quantity, quantity_sold )
    `)
    .eq("status", "published")
    .eq("is_public", true)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true })
    .limit(40);

  if (category) query = query.eq("category", category);
  if (q) query = query.ilike("title", `%${q}%`);

  const { data: events } = await query;

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* NAV */}
      <nav style={{
        borderBottom: "1px solid #111",
        padding: "0 14px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        height: 64,
        background: "#000",
        position: "sticky",
        top: 0,
        zIndex: 50,
      }}>
        <Link href="/" style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, textDecoration: "none" }}>
          <img src="/sb-mark.png" alt="Square Bidness" style={{ height: 38, width: "auto", display: "block" }} />
          <span style={{ color: "#fff", fontSize: "0.65rem", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>Events</span>
        </Link>
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <Link href="/organizer/login" className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>
            Organizer Login
          </Link>
          <Link href="/organizer/signup" className="btn btn--primary" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>
            List an Event
          </Link>
        </div>
      </nav>

      {/* HERO */}
      <header style={{
        padding: "clamp(40px, 8vw, 80px) 14px clamp(30px, 5vw, 50px)",
        background: "radial-gradient(circle at 20% 0%, rgba(34,197,94,.08), transparent 40%), #000",
        borderBottom: "1px solid #111",
        textAlign: "center",
      }}>
        <div className="wrap">
          <p style={{
            display: "inline-flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: 999, border: "1px solid #202020",
            background: "#080808", color: "#d4d4d8", fontSize: 11,
            fontWeight: 900, letterSpacing: "0.13em", textTransform: "uppercase",
            marginBottom: 18,
          }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: "#22c55e", boxShadow: "0 0 18px rgba(34,197,94,.65)", display: "inline-block" }} />
            Louisiana Events
          </p>
          <h1 style={{ fontSize: "clamp(2.5rem, 8vw, 5rem)", fontWeight: 950, letterSpacing: "-0.07em", lineHeight: 0.92, marginBottom: 16 }}>
            Find your next event.
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "clamp(1rem, 2vw, 1.2rem)", maxWidth: 520, margin: "0 auto 28px" }}>
            Comedy shows, trail rides, concerts, pop-ups and community events across Louisiana.
          </p>

          {/* SEARCH */}
          <form method="GET" style={{ display: "flex", gap: 10, maxWidth: 480, margin: "0 auto" }}>
            <input
              name="q"
              defaultValue={q}
              placeholder="Search events..."
              className="input"
              style={{ flex: 1 }}
            />
            <button type="submit" className="btn btn--primary" style={{ minHeight: 48, padding: "0 20px" }}>
              Search
            </button>
          </form>
        </div>
      </header>

      <main style={{ padding: "32px 14px 64px" }}>
        <div className="wrap">

          {/* CATEGORY FILTERS */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            <Link
              href="/"
              style={{
                padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 800,
                background: !category ? "#fff" : "#0b0b0b",
                color: !category ? "#000" : "#fff",
                border: "1px solid " + (!category ? "#fff" : "#242427"),
              }}
            >
              All
            </Link>
            {EVENT_CATEGORIES.map((cat) => (
              <Link
                key={cat.value}
                href={`/?category=${cat.value}`}
                style={{
                  padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 800,
                  background: category === cat.value ? "#fff" : "#0b0b0b",
                  color: category === cat.value ? "#000" : "#fff",
                  border: "1px solid " + (category === cat.value ? "#fff" : "#242427"),
                }}
              >
                {cat.label}
              </Link>
            ))}
          </div>

          {/* EVENT GRID */}
          {!events?.length ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#a1a1aa" }}>
              <p style={{ fontSize: "1.1rem" }}>No events found.</p>
              <p style={{ marginTop: 8, fontSize: "0.9rem" }}>Check back soon or list your own event.</p>
            </div>
          ) : (
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
              gap: 16,
            }}>
              {events.map((event: any) => {
                const tiers = event.ticket_tiers ?? [];
                const minPrice = tiers.length
                  ? Math.min(...tiers.map((t: any) => Number(t.price)))
                  : null;
                const soldOut = tiers.length > 0 && tiers.every(
                  (t: any) => t.quantity_sold >= t.quantity
                );

                return (
                  <Link key={event.id} href={`/events/${event.slug}`} style={{ textDecoration: "none" }}>
                    <article className="card" style={{ padding: 0, overflow: "hidden", cursor: "pointer", transition: "border-color 0.14s" }}>
                      {/* Cover image */}
                      <div style={{ height: 180, background: "#0a0a0a", position: "relative" }}>
                        {event.cover_image_url ? (
                          <img src={event.cover_image_url} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: "2rem" }}>
                            🎟️
                          </div>
                        )}
                        {soldOut && (
                          <span className="badge badge--red" style={{ position: "absolute", top: 10, right: 10 }}>Sold Out</span>
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ padding: 16 }}>
                        <p style={{ color: "#22c55e", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 6 }}>
                          {EVENT_CATEGORIES.find(c => c.value === event.category)?.label ?? event.category}
                        </p>
                        <h2 style={{ fontSize: "1.05rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 8, color: "#fff" }}>
                          {event.title}
                        </h2>
                        <p style={{ color: "#a1a1aa", fontSize: "0.85rem", marginBottom: 4 }}>
                          {new Date(event.starts_at).toLocaleDateString("en-US", {
                            weekday: "short", month: "short", day: "numeric",
                          })} · {new Date(event.starts_at).toLocaleTimeString("en-US", {
                            hour: "numeric", minute: "2-digit",
                          })}
                        </p>
                        <p style={{ color: "#a1a1aa", fontSize: "0.85rem", marginBottom: 12 }}>
                          {[event.venue_name, event.city, event.state].filter(Boolean).join(" · ")}
                        </p>
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <span style={{ fontWeight: 900, color: "#fff" }}>
                            {minPrice === 0 || minPrice === null ? "Free" : `From $${Number(minPrice).toFixed(2)}`}
                          </span>
                          <span style={{ color: "#a1a1aa", fontSize: "0.8rem" }}>
                            {(event.organizers as any)?.name}
                          </span>
                        </div>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* FOOTER */}
      <footer style={{ borderTop: "1px solid #111", padding: "24px 14px", textAlign: "center", color: "#555", fontSize: "0.85rem" }}>
        <p>© {new Date().getFullYear()} Square Bidness · <Link href="/organizer/signup" style={{ color: "#a1a1aa" }}>List an Event</Link></p>
      </footer>
    </div>
  );
}
