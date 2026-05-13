import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase/server";
import { EVENT_CATEGORIES } from "../../../lib/constants";
import NavLogo from "../../../components/NavLogo";

export const revalidate = 60;

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const { data: org } = await supabaseServer.from("organizers").select("name, bio").eq("slug", slug).single();
  if (!org) return { title: "Organizer Not Found" };
  return {
    title: `${org.name} Events`,
    description: org.bio ?? `See all upcoming events from ${org.name} on Square Bidness Events.`,
  };
}

export default async function OrganizerProfilePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name, bio, logo_url")
    .eq("slug", slug)
    .eq("active", true)
    .single();

  if (!organizer) notFound();

  const { data: events } = await supabaseServer
    .from("events")
    .select(`id, slug, title, category, starts_at, cover_image_url, venue_name, city, state, ticket_tiers ( price, quantity, quantity_sold )`)
    .eq("organizer_id", organizer.id)
    .eq("status", "published")
    .eq("is_public", true)
    .gte("starts_at", new Date().toISOString())
    .order("starts_at", { ascending: true });

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000", position: "sticky", top: 0, zIndex: 50 }}>
        <NavLogo />
        <Link href="/" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← All Events</Link>
      </nav>

      <header style={{ padding: "48px 14px 32px", borderBottom: "1px solid #111", background: "#000" }}>
        <div className="wrap" style={{ display: "flex", alignItems: "center", gap: 20 }}>
          {organizer.logo_url ? (
            <img src={organizer.logo_url} alt={organizer.name} style={{ width: 72, height: 72, borderRadius: 16, objectFit: "cover", flexShrink: 0 }} />
          ) : (
            <div style={{ width: 72, height: 72, borderRadius: 16, background: "#111", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2rem", flexShrink: 0 }}>🎟️</div>
          )}
          <div>
            <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>{organizer.name}</h1>
            {organizer.bio && <p style={{ color: "#a1a1aa", fontSize: "0.95rem", maxWidth: 520 }}>{organizer.bio}</p>}
          </div>
        </div>
      </header>

      <main style={{ padding: "32px 14px 64px" }}>
        <div className="wrap">
          <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>
            Upcoming Events ({events?.length ?? 0})
          </p>

          {!events?.length ? (
            <div style={{ textAlign: "center", padding: "60px 0", color: "#555" }}>
              <p>No upcoming events from this organizer.</p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 16 }}>
              {events.map((event: any) => {
                const tiers = event.ticket_tiers ?? [];
                const minPrice = tiers.length ? Math.min(...tiers.map((t: any) => Number(t.price))) : null;
                const soldOut = tiers.length > 0 && tiers.every((t: any) => t.quantity_sold >= t.quantity);
                return (
                  <Link key={event.id} href={`/events/${event.slug}`} style={{ textDecoration: "none" }}>
                    <article className="card" style={{ padding: 0, overflow: "hidden", cursor: "pointer" }}>
                      <div style={{ height: 170, background: "#0a0a0a", position: "relative" }}>
                        {event.cover_image_url ? (
                          <img src={event.cover_image_url} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        ) : (
                          <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", color: "#333", fontSize: "2rem" }}>🎟️</div>
                        )}
                        {soldOut && <span className="badge badge--red" style={{ position: "absolute", top: 10, right: 10 }}>Sold Out</span>}
                      </div>
                      <div style={{ padding: 16 }}>
                        <p style={{ color: "#22c55e", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 4 }}>
                          {EVENT_CATEGORIES.find(c => c.value === event.category)?.label ?? event.category}
                        </p>
                        <h2 style={{ fontSize: "1.05rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 6, color: "#fff" }}>{event.title}</h2>
                        <p style={{ color: "#a1a1aa", fontSize: "0.82rem", marginBottom: 8 }}>
                          {new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                          {event.city && ` · ${event.city}`}
                        </p>
                        <span style={{ fontWeight: 900, color: "#fff", fontSize: "0.9rem" }}>
                          {minPrice === 0 || minPrice === null ? "Free" : `From $${Number(minPrice).toFixed(2)}`}
                        </span>
                      </div>
                    </article>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </main>

      <footer style={{ borderTop: "1px solid #111", padding: "24px 14px", textAlign: "center", color: "#555", fontSize: "0.85rem" }}>
        <p>© {new Date().getFullYear()} Square Bidness · <Link href="/" style={{ color: "#a1a1aa" }}>All Events</Link></p>
      </footer>
    </div>
  );
}
