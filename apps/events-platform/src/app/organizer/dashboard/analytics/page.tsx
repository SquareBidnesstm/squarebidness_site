import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../lib/auth";
import NavLogo from "../../../../components/NavLogo";

export const revalidate = 0;

function getWeekLabel(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function startOfWeek(d: Date): Date {
  const date = new Date(d);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  date.setHours(0, 0, 0, 0);
  return date;
}

export default async function AnalyticsPage() {
  // Auth
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
  if (!sessionCookie) redirect("/organizer/login");

  const organizerSlug = sessionCookie.name.replace("org_session_", "");
  const expectedToken = await computeOrganizerSessionToken(organizerSlug);
  if (sessionCookie.value !== expectedToken) redirect("/organizer/login");

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name")
    .eq("slug", organizerSlug)
    .single();

  if (!organizer) redirect("/organizer/login");

  // Fetch all events for this organizer
  const { data: events } = await supabaseServer
    .from("events")
    .select("id, title, slug, starts_at, status, ticket_tiers ( name, price, quantity, quantity_sold )")
    .eq("organizer_id", organizer.id)
    .order("starts_at", { ascending: false });

  const eventList = (events ?? []) as any[];
  const eventIds = eventList.map((e: any) => e.id);

  // Fetch all paid orders for this organizer
  const { data: orders } = eventIds.length > 0
    ? await supabaseServer
        .from("orders")
        .select("id, order_code, buyer_name, buyer_email, total, created_at, event_id, events ( title )")
        .in("event_id", eventIds)
        .eq("status", "paid")
        .order("created_at", { ascending: false })
    : { data: [] };

  const orderList = (orders ?? []) as any[];

  // ── Summary stats ──────────────────────────────────────
  const totalRevenue = orderList.reduce((s: number, o: any) => s + Number(o.total), 0);
  const totalTickets = eventList.reduce((s: number, e: any) =>
    s + (e.ticket_tiers ?? []).reduce((ts: number, t: any) => ts + t.quantity_sold, 0), 0);
  const totalEvents = eventList.length;
  const publishedEvents = eventList.filter((e: any) => e.status === "published").length;

  // ── Weekly revenue chart (last 8 weeks) ────────────────
  const now = new Date();
  const weeks: { label: string; revenue: number; orders: number }[] = [];
  for (let i = 7; i >= 0; i--) {
    const weekStart = startOfWeek(new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000));
    const weekEnd = new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000);
    const weekOrders = orderList.filter((o: any) => {
      const d = new Date(o.created_at);
      return d >= weekStart && d < weekEnd;
    });
    weeks.push({
      label: getWeekLabel(weekStart),
      revenue: weekOrders.reduce((s: number, o: any) => s + Number(o.total), 0),
      orders: weekOrders.length,
    });
  }
  const maxRevenue = Math.max(...weeks.map((w) => w.revenue), 1);

  // ── Tier breakdown across all events ───────────────────
  const tierMap: Record<string, { name: string; sold: number; revenue: number }> = {};
  for (const event of eventList) {
    for (const tier of event.ticket_tiers ?? []) {
      const key = tier.name;
      if (!tierMap[key]) tierMap[key] = { name: tier.name, sold: 0, revenue: 0 };
      tierMap[key].sold += tier.quantity_sold;
      tierMap[key].revenue += Number(tier.price) * tier.quantity_sold;
    }
  }
  const tiers = Object.values(tierMap).sort((a, b) => b.revenue - a.revenue);

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000" }}>
        <NavLogo />
        <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
          <Link href="/organizer/dashboard" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← Dashboard</Link>
          <a href="/api/organizer/logout" className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>Sign Out</a>
        </div>
      </nav>

      <main style={{ padding: "32px 14px 80px" }}>
        <div className="wrap">

          <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>Analytics</h1>
          <p style={{ color: "#a1a1aa", marginBottom: 28, fontSize: "0.9rem" }}>{organizer.name} · all-time</p>

          {/* Summary stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 12, marginBottom: 32 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Gross Revenue</p>
              <p style={{ fontSize: "1.8rem", fontWeight: 950, color: "#22c55e" }}>${totalRevenue.toFixed(2)}</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Tickets Sold</p>
              <p style={{ fontSize: "1.8rem", fontWeight: 950 }}>{totalTickets}</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Orders</p>
              <p style={{ fontSize: "1.8rem", fontWeight: 950 }}>{orderList.length}</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Events</p>
              <p style={{ fontSize: "1.8rem", fontWeight: 950 }}>{totalEvents}</p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>{publishedEvents} live</p>
            </div>
          </div>

          {/* Weekly revenue bar chart */}
          <div className="card" style={{ marginBottom: 28 }}>
            <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 20 }}>
              Revenue — Last 8 Weeks
            </p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 140 }}>
              {weeks.map((week, i) => {
                const height = maxRevenue > 0 ? Math.max((week.revenue / maxRevenue) * 120, week.revenue > 0 ? 4 : 0) : 0;
                const isCurrentWeek = i === weeks.length - 1;
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
                    {week.revenue > 0 && (
                      <p style={{ fontSize: "0.65rem", color: "#22c55e", fontWeight: 800, whiteSpace: "nowrap" }}>
                        ${week.revenue % 1 === 0 ? week.revenue : week.revenue.toFixed(0)}
                      </p>
                    )}
                    <div style={{ flex: 1, display: "flex", alignItems: "flex-end", width: "100%" }}>
                      <div style={{
                        width: "100%",
                        height: height,
                        background: isCurrentWeek
                          ? "linear-gradient(180deg, #22c55e, #16a34a)"
                          : "linear-gradient(180deg, #1d4ed8, #1e3a8a)",
                        borderRadius: "4px 4px 0 0",
                        minHeight: week.revenue > 0 ? 4 : 0,
                        transition: "height 0.3s ease",
                      }} />
                    </div>
                    <p style={{ fontSize: "0.65rem", color: isCurrentWeek ? "#a1a1aa" : "#555", whiteSpace: "nowrap" }}>
                      {week.label}
                    </p>
                  </div>
                );
              })}
            </div>
            {orderList.length === 0 && (
              <p style={{ textAlign: "center", color: "#555", fontSize: "0.85rem", marginTop: 12 }}>No sales yet</p>
            )}
          </div>

          {/* Tier breakdown */}
          {tiers.length > 0 && (
            <div className="card" style={{ marginBottom: 28 }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                Tickets by Tier
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {tiers.map((tier) => {
                  const pct = totalTickets > 0 ? (tier.sold / totalTickets) * 100 : 0;
                  return (
                    <div key={tier.name}>
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6, fontSize: "0.85rem" }}>
                        <span style={{ fontWeight: 700 }}>{tier.name}</span>
                        <span style={{ color: "#a1a1aa" }}>{tier.sold} sold · <span style={{ color: "#22c55e" }}>${tier.revenue.toFixed(2)}</span></span>
                      </div>
                      <div style={{ height: 6, background: "#111", borderRadius: 99, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: `${pct}%`, background: "#22c55e", borderRadius: 99, transition: "width 0.3s ease" }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Per-event breakdown */}
          {eventList.length > 0 && (
            <div className="card" style={{ marginBottom: 28 }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
                Revenue by Event
              </p>
              <div style={{ display: "grid", gap: 10 }}>
                {eventList.map((event: any) => {
                  const eventTiers = event.ticket_tiers ?? [];
                  const sold = eventTiers.reduce((s: number, t: any) => s + t.quantity_sold, 0);
                  const rev = eventTiers.reduce((s: number, t: any) => s + Number(t.price) * t.quantity_sold, 0);
                  return (
                    <div key={event.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", background: "#050505", borderRadius: 10, border: "1px solid #1d1d1f" }}>
                      <div>
                        <p style={{ fontWeight: 800, fontSize: "0.9rem" }}>{event.title}</p>
                        <p style={{ color: "#555", fontSize: "0.75rem" }}>
                          {new Date(event.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                          {" · "}
                          <span className={event.status === "published" ? "" : ""} style={{ color: event.status === "published" ? "#22c55e" : "#a1a1aa" }}>
                            {event.status}
                          </span>
                        </p>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <p style={{ fontWeight: 900, color: "#22c55e" }}>${rev.toFixed(2)}</p>
                        <p style={{ color: "#555", fontSize: "0.75rem" }}>{sold} tickets</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Recent orders feed */}
          <div className="card">
            <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
              Recent Orders
            </p>
            {orderList.length === 0 ? (
              <p style={{ color: "#555", fontSize: "0.9rem" }}>No orders yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {orderList.slice(0, 25).map((order: any) => (
                  <div key={order.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: "1px solid #0d0d0d" }}>
                    <div>
                      <p style={{ fontWeight: 800, fontSize: "0.85rem" }}>{order.buyer_name}</p>
                      <p style={{ color: "#555", fontSize: "0.75rem" }}>
                        {(order.events as any)?.title} · {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </p>
                    </div>
                    <p style={{ fontWeight: 900, color: "#22c55e", fontSize: "0.9rem" }}>${Number(order.total).toFixed(2)}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}
