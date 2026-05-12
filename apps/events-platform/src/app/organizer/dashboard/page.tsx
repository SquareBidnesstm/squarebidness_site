import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../lib/supabase/server";
import NavLogo from "../../../components/NavLogo";

export const revalidate = 0;

export default async function OrganizerDashboardPage() {
  const cookieStore = await cookies();

  // Find organizer session
  const allCookies = cookieStore.getAll();
  const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
  if (!sessionCookie) redirect("/organizer/login");

  const organizerSlug = sessionCookie.name.replace("org_session_", "");

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("*")
    .eq("slug", organizerSlug)
    .single();

  if (!organizer) redirect("/organizer/login");

  const { data: events } = await supabaseServer
    .from("events")
    .select("*, ticket_tiers ( price, quantity, quantity_sold )")
    .eq("organizer_id", organizer.id)
    .order("starts_at", { ascending: false });

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000" }}>
        <NavLogo />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ color: "#a1a1aa", fontSize: "0.9rem" }}>{organizer.name}</span>
          <a href="/api/organizer/logout" className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>Sign Out</a>
        </div>
      </nav>

      <main style={{ padding: "32px 14px 64px" }}>
        <div className="wrap">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
            <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em" }}>Your Events</h1>
            <Link href="/organizer/dashboard/new-event" className="btn btn--primary">
              + New Event
            </Link>
          </div>

          {/* Stripe Connect Banner */}
          {!organizer.stripe_onboarding_complete && (
            <div style={{ background: "#1a1500", border: "1px solid #713f12", borderRadius: 12, padding: 16, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <p style={{ fontWeight: 900, color: "#facc15" }}>Connect Stripe to receive payouts</p>
                <p style={{ color: "#a1a1aa", fontSize: "0.85rem", marginTop: 4 }}>You need a Stripe account to sell tickets and get paid.</p>
              </div>
              <a href="/api/organizer/stripe-connect" className="btn btn--outline" style={{ whiteSpace: "nowrap", marginLeft: 16 }}>
                Connect Stripe
              </a>
            </div>
          )}

          {!events?.length ? (
            <div className="card" style={{ textAlign: "center", padding: 48 }}>
              <p style={{ color: "#a1a1aa", marginBottom: 16 }}>No events yet.</p>
              <Link href="/organizer/dashboard/new-event" className="btn btn--primary">Create your first event</Link>
            </div>
          ) : (
            <div style={{ display: "grid", gap: 12 }}>
              {events.map((event: any) => {
                const tiers = event.ticket_tiers ?? [];
                const totalSold = tiers.reduce((s: number, t: any) => s + t.quantity_sold, 0);
                const totalCapacity = tiers.reduce((s: number, t: any) => s + t.quantity, 0);
                const revenue = tiers.reduce((s: number, t: any) => s + (Number(t.price) * t.quantity_sold), 0);

                return (
                  <div key={event.id} className="card" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                        <h2 style={{ fontWeight: 900, fontSize: "1rem" }}>{event.title}</h2>
                        <span className={`badge ${event.status === "published" ? "badge--green" : event.status === "cancelled" ? "badge--red" : "badge--gray"}`}>
                          {event.status}
                        </span>
                      </div>
                      <p style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                        {new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · {event.city}, {event.state}
                      </p>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <p style={{ fontWeight: 900 }}>{totalSold} / {totalCapacity} sold</p>
                      <p style={{ color: "#22c55e", fontSize: "0.85rem" }}>${revenue.toFixed(2)}</p>
                    </div>
                    <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
                      <Link href={`/organizer/dashboard/events/${event.id}`} className="btn btn--ghost" style={{ minHeight: 36, padding: "0 12px", fontSize: "0.85rem" }}>
                        Manage
                      </Link>
                      <Link href={`/scan/${event.slug}`} className="btn btn--outline" style={{ minHeight: 36, padding: "0 12px", fontSize: "0.85rem" }}>
                        Scanner
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
