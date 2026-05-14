import Link from "next/link";
import { supabaseServer } from "../lib/supabase/server";
import { EVENT_CATEGORIES } from "../lib/constants";

export const revalidate = 60;

const jsonLd = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      url: "https://events.squarebidness.com",
      name: "Square Bidness Events",
      description: "Find and buy tickets to events in Louisiana — concerts, comedy shows, trail rides, pop-ups, and community events.",
      potentialAction: {
        "@type": "SearchAction",
        target: "https://events.squarebidness.com/?q={search_term_string}",
        "query-input": "required name=search_term_string",
      },
    },
    {
      "@type": "Organization",
      name: "Square Bidness Events",
      url: "https://events.squarebidness.com",
      logo: "https://events.squarebidness.com/events-192.png",
      sameAs: ["https://squarebidness.com"],
    },
    {
      "@type": "EventSeries",
      name: "Louisiana Events",
      url: "https://events.squarebidness.com",
      location: { "@type": "State", name: "Louisiana", address: { "@type": "PostalAddress", addressRegion: "LA", addressCountry: "US" } },
      description: "Concerts, comedy shows, trail rides, pop-up markets, and community events across Louisiana.",
    },
  ],
};

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; q?: string; date?: string }>;
}) {
  const { category, q, date } = await searchParams;

  const now = new Date();

  // Date range bounds
  let dateFrom = now.toISOString();
  let dateTo: string | null = null;

  if (date === "week") {
    const end = new Date(now); end.setDate(now.getDate() + 7);
    dateTo = end.toISOString();
  } else if (date === "weekend") {
    const day = now.getDay();
    const fri = new Date(now); fri.setDate(now.getDate() + ((5 - day + 7) % 7));
    fri.setHours(0, 0, 0, 0);
    const sun = new Date(fri); sun.setDate(fri.getDate() + 2); sun.setHours(23, 59, 59, 999);
    dateFrom = fri < now ? now.toISOString() : fri.toISOString();
    dateTo = sun.toISOString();
  } else if (date === "month") {
    const end = new Date(now); end.setDate(now.getDate() + 30);
    dateTo = end.toISOString();
  }

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
    .gte("starts_at", dateFrom)
    .order("starts_at", { ascending: true })
    .limit(40);

  if (dateTo) query = query.lte("starts_at", dateTo);
  if (category) query = query.eq("category", category);
  if (q) query = query.ilike("title", `%${q}%`);

  const [{ data: events }, { data: featuredEvents }] = await Promise.all([
    query,
    // Featured only shown on unfiltered homepage
    (!category && !q && !date)
      ? supabaseServer
          .from("events")
          .select(`id, slug, title, category, starts_at, venue_name, city, cover_image_url, ticket_tiers ( price, quantity, quantity_sold )`)
          .eq("status", "published")
          .eq("is_public", true)
          .eq("is_featured", true)
          .gte("starts_at", now.toISOString())
          .order("starts_at", { ascending: true })
          .limit(6)
      : Promise.resolve({ data: [] }),
  ]);

  return (
    <div style={{ minHeight: "100vh" }}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
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
        <Link href="/" style={{ textDecoration: "none" }}>
          <img src="/events-192.png" alt="SB Events" style={{ height: 40, width: 40, display: "block", borderRadius: 10 }} />
        </Link>
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/my-tickets" style={{ color: "#a1a1aa", fontSize: "0.85rem", textDecoration: "none" }}>
            My Tickets
          </Link>
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
            Louisiana events, tickets & more.
          </h1>
          <p style={{ color: "#a1a1aa", fontSize: "clamp(1rem, 2vw, 1.2rem)", maxWidth: 520, margin: "0 auto 28px" }}>
            Concerts, comedy shows, trail rides, pop-ups, and community events across Louisiana. Buy tickets in seconds.
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

          {/* FEATURED STRIP */}
          {featuredEvents && featuredEvents.length > 0 && (
            <div style={{ marginBottom: 36 }}>
              <p style={{ fontSize: 11, fontWeight: 900, letterSpacing: "0.13em", textTransform: "uppercase", color: "#ef4444", marginBottom: 12 }}>
                ⭐ Featured
              </p>
              <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 8, scrollbarWidth: "none" }}>
                {featuredEvents.map((ev: any) => {
                  const tiers = ev.ticket_tiers ?? [];
                  const minPrice = tiers.length ? Math.min(...tiers.map((t: any) => Number(t.price))) : null;
                  const soldOut = tiers.length > 0 && tiers.every((t: any) => t.quantity_sold >= t.quantity);
                  return (
                    <Link key={ev.id} href={`/events/${ev.slug}`} style={{ textDecoration: "none", flexShrink: 0, width: 220 }}>
                      <div style={{ borderRadius: 14, overflow: "hidden", border: "1px solid #ef444440", background: "#080808" }}>
                        <div style={{ height: 130, background: "#0a0a0a", position: "relative" }}>
                          {ev.cover_image_url
                            ? <img src={ev.cover_image_url} alt={ev.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                            : <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem" }}>🎟️</div>
                          }
                          {soldOut && (
                            <span className="badge badge--red" style={{ position: "absolute", top: 8, right: 8, fontSize: "0.6rem" }}>Sold Out</span>
                          )}
                        </div>
                        <div style={{ padding: "12px 12px 14px" }}>
                          <p style={{ fontWeight: 900, fontSize: "0.9rem", color: "#fff", marginBottom: 4, lineHeight: 1.2 }}>{ev.title}</p>
                          <p style={{ color: "#a1a1aa", fontSize: "0.75rem", marginBottom: 2 }}>
                            {new Date(ev.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                          {ev.city && <p style={{ color: "#555", fontSize: "0.72rem" }}>{ev.city}</p>}
                          <p style={{ fontWeight: 900, color: "#ef4444", fontSize: "0.85rem", marginTop: 6 }}>
                            {soldOut ? "Sold Out" : (minPrice === 0 || minPrice === null ? "Free" : `From $${Number(minPrice).toFixed(0)}`)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          )}

          {/* DATE FILTERS */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
            {[
              { label: "Any Date", value: undefined },
              { label: "This Week", value: "week" },
              { label: "This Weekend", value: "weekend" },
              { label: "This Month", value: "month" },
            ].map(({ label, value }) => {
              const active = date === value;
              const params = new URLSearchParams();
              if (value) params.set("date", value);
              if (category) params.set("category", category);
              if (q) params.set("q", q);
              const href = `/?${params.toString()}`;
              return (
                <Link
                  key={label}
                  href={href}
                  style={{
                    padding: "5px 13px", borderRadius: 999, fontSize: 12, fontWeight: 800,
                    background: active ? "#ef4444" : "#0b0b0b",
                    color: active ? "#fff" : "#a1a1aa",
                    border: "1px solid " + (active ? "#ef4444" : "#242427"),
                  }}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* CATEGORY FILTERS */}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 28 }}>
            <Link
              href={`/?${new URLSearchParams({ ...(q ? { q } : {}), ...(date ? { date } : {}) }).toString()}`}
              style={{
                padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 800,
                background: !category ? "#fff" : "#0b0b0b",
                color: !category ? "#000" : "#fff",
                border: "1px solid " + (!category ? "#fff" : "#242427"),
              }}
            >
              All
            </Link>
            {EVENT_CATEGORIES.map((cat) => {
              const params = new URLSearchParams({ category: cat.value });
              if (q) params.set("q", q);
              if (date) params.set("date", date);
              return (
                <Link
                  key={cat.value}
                  href={`/?${params.toString()}`}
                  style={{
                    padding: "6px 14px", borderRadius: 999, fontSize: 13, fontWeight: 800,
                    background: category === cat.value ? "#fff" : "#0b0b0b",
                    color: category === cat.value ? "#000" : "#fff",
                    border: "1px solid " + (category === cat.value ? "#fff" : "#242427"),
                  }}
                >
                  {cat.label}
                </Link>
              );
            })}
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
