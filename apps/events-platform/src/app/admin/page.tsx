import { redirect } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "../../lib/supabase/server";
import { verifyAdminSession } from "../../lib/auth";
import NavLogo from "../../components/NavLogo";
import { FeaturedToggle, OrganizerActiveToggle, RefulfillButton } from "../../components/AdminToggles";

export const revalidate = 0;

export default async function AdminDashboardPage() {
  // Auth
  const cookieStore = await cookies();
  const cookieHeader = cookieStore.getAll()
    .map((c) => `${c.name}=${c.value}`)
    .join("; ");
  const req = new Request("https://placeholder", {
    headers: { cookie: cookieHeader },
  });
  const isAdmin = await verifyAdminSession(req);
  if (!isAdmin) redirect("/admin/login");

  // Fetch platform stats
  const [
    { data: organizers },
    { data: events },
    { data: orders },
    { data: payouts },
    { data: ticketCounts },
  ] = await Promise.all([
    supabaseServer
      .from("organizers")
      .select("id, name, email, slug, stripe_onboarding_complete, active, created_at")
      .order("created_at", { ascending: false }),
    supabaseServer
      .from("events")
      .select("id, title, slug, status, starts_at, city, state, is_featured, organizer_id, organizers ( name )")
      .order("starts_at", { ascending: false })
      .limit(50),
    supabaseServer
      .from("orders")
      .select("id, order_code, status, total, platform_fee, buyer_name, buyer_email, created_at, ref_code, events ( title )")
      .order("created_at", { ascending: false })
      .limit(200),
    supabaseServer
      .from("platform_payouts")
      .select("amount_cents, created_at"),
    supabaseServer
      .from("tickets")
      .select("order_id")
      .not("status", "eq", "cancelled"),
  ]);

  // Build set of order IDs that have at least one active ticket
  const ordersWithTickets = new Set((ticketCounts ?? []).map((t: any) => t.order_id));

  // Paid orders with no tickets issued = stuck (webhook may have dropped)
  const stuckOrders = (orders ?? []).filter(
    (o: any) => o.status === "paid" && !ordersWithTickets.has(o.id)
  );

  // ── Analytics ─────────────────────────────────────────────
  const paidOrders = (orders ?? []).filter((o: any) => o.status === "paid");

  // Daily revenue — last 14 days
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const dailyRevenue: { label: string; total: number }[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(d.getDate() - (13 - i));
    return { label: d.toLocaleDateString("en-US", { month: "short", day: "numeric" }), total: 0 };
  });
  for (const o of paidOrders) {
    const od = new Date(o.created_at);
    od.setHours(0, 0, 0, 0);
    const diffDays = Math.round((today.getTime() - od.getTime()) / 86400000);
    if (diffDays >= 0 && diffDays < 14) {
      dailyRevenue[13 - diffDays].total += Number(o.total);
    }
  }
  const maxDayRevenue = Math.max(...dailyRevenue.map(d => d.total), 1);

  // Referral breakdown
  const refMap = new Map<string, { count: number; revenue: number }>();
  for (const o of paidOrders) {
    if (o.ref_code) {
      const existing = refMap.get(o.ref_code) ?? { count: 0, revenue: 0 };
      refMap.set(o.ref_code, { count: existing.count + 1, revenue: existing.revenue + Number(o.total) });
    }
  }
  const refRows = Array.from(refMap.entries())
    .map(([code, stats]) => ({ code, ...stats }))
    .sort((a, b) => b.revenue - a.revenue);

  // Top buyers
  const buyerMap = new Map<string, { name: string; count: number; revenue: number }>();
  for (const o of paidOrders) {
    const existing = buyerMap.get(o.buyer_email) ?? { name: o.buyer_name, count: 0, revenue: 0 };
    buyerMap.set(o.buyer_email, { name: o.buyer_name, count: existing.count + 1, revenue: existing.revenue + Number(o.total) });
  }
  const topBuyers = Array.from(buyerMap.entries())
    .map(([email, stats]) => ({ email, ...stats }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  const totalRevenue = (payouts ?? []).reduce((s, p) => s + p.amount_cents, 0) / 100;
  const completedOrders = (orders ?? []).filter(o => o.status === "paid");
  const totalOrderRevenue = completedOrders.reduce((s, o) => s + Number(o.total), 0);

  return (
    <div style={{ minHeight: "100vh" }}>
      {/* NAV */}
      <nav style={{ borderBottom: "1px solid #111", padding: "0 20px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000", position: "sticky", top: 0, zIndex: 50 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <NavLogo />
          <span style={{ padding: "2px 8px", background: "#1a1a00", border: "1px solid #713f12", borderRadius: 999, color: "#facc15", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>Admin</span>
        </div>
        <a href="/api/admin/logout" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>Sign Out</a>
      </nav>

      <main style={{ padding: "32px 20px 80px" }}>
        <div className="wrap">

          {/* PLATFORM STATS */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 12, marginBottom: 36 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Platform Revenue</p>
              <p style={{ fontSize: "2rem", fontWeight: 950, color: "#22c55e" }}>${totalRevenue.toFixed(2)}</p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>$1 / paid ticket</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Gross GMV</p>
              <p style={{ fontSize: "2rem", fontWeight: 950 }}>${totalOrderRevenue.toFixed(2)}</p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>all ticket sales</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Organizers</p>
              <p style={{ fontSize: "2rem", fontWeight: 950 }}>{organizers?.length ?? 0}</p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>registered</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Events</p>
              <p style={{ fontSize: "2rem", fontWeight: 950 }}>{events?.length ?? 0}</p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>
                {events?.filter(e => e.status === "published").length ?? 0} published
              </p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Orders</p>
              <p style={{ fontSize: "2rem", fontWeight: 950 }}>{completedOrders.length}</p>
              <p style={{ color: "#555", fontSize: "0.75rem" }}>completed</p>
            </div>
          </div>

          {/* ANALYTICS */}
          <h2 style={{ fontSize: "1.1rem", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 16 }}>Analytics</h2>

          {/* Daily Revenue Chart */}
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 16 }}>Daily Revenue — Last 14 Days</p>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 6, height: 100 }}>
              {dailyRevenue.map((d, i) => {
                const barH = Math.max(4, Math.round((d.total / maxDayRevenue) * 88));
                return (
                  <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                    {d.total > 0 && (
                      <span style={{ fontSize: 9, color: "#22c55e", fontWeight: 800 }}>${d.total.toFixed(0)}</span>
                    )}
                    <div style={{
                      width: "100%", height: barH, borderRadius: "3px 3px 0 0",
                      background: d.total > 0 ? "#166534" : "#111",
                      minHeight: 4,
                    }} />
                    <span style={{ fontSize: 8, color: "#555", whiteSpace: "nowrap", transform: "rotate(-40deg)", transformOrigin: "top right", marginTop: 2 }}>
                      {d.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Referrals + Top Buyers */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 32 }}>
            {/* Referral Breakdown */}
            <div className="card">
              <p style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Referral Codes</p>
              {refRows.length === 0 ? (
                <p style={{ color: "#555", fontSize: "0.85rem" }}>No referral orders yet.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Code", "Orders", "Revenue"].map(h => (
                        <th key={h} style={{ textAlign: "left", color: "#555", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", paddingBottom: 8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {refRows.map(r => (
                      <tr key={r.code} style={{ borderTop: "1px solid #111" }}>
                        <td style={{ padding: "8px 0", fontFamily: "monospace", fontSize: "0.8rem", color: "#a1a1aa" }}>{r.code}</td>
                        <td style={{ padding: "8px 0", fontWeight: 800 }}>{r.count}</td>
                        <td style={{ padding: "8px 0", fontWeight: 800, color: "#22c55e" }}>${r.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Top Buyers */}
            <div className="card">
              <p style={{ color: "#a1a1aa", fontSize: 10, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Top Buyers</p>
              {topBuyers.length === 0 ? (
                <p style={{ color: "#555", fontSize: "0.85rem" }}>No orders yet.</p>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr>
                      {["Buyer", "Orders", "Spent"].map(h => (
                        <th key={h} style={{ textAlign: "left", color: "#555", fontSize: 10, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase", paddingBottom: 8 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {topBuyers.map(b => (
                      <tr key={b.email} style={{ borderTop: "1px solid #111" }}>
                        <td style={{ padding: "8px 0" }}>
                          <p style={{ fontWeight: 700, fontSize: "0.85rem" }}>{b.name}</p>
                          <p style={{ color: "#555", fontSize: "0.75rem" }}>{b.email}</p>
                        </td>
                        <td style={{ padding: "8px 0", fontWeight: 800 }}>{b.count}</td>
                        <td style={{ padding: "8px 0", fontWeight: 800, color: "#22c55e" }}>${b.revenue.toFixed(2)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* ORGANIZERS */}
          <h2 style={{ fontSize: "1.1rem", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 12 }}>Organizers</h2>
          <div className="card" style={{ marginBottom: 32, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #111" }}>
                  {["Name", "Email", "Stripe", "Status", "Joined"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#555", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(organizers ?? []).map((org) => (
                  <tr key={org.id} style={{ borderBottom: "1px solid #0a0a0a" }}>
                    <td style={{ padding: "12px 16px", fontWeight: 800 }}>{org.name}</td>
                    <td style={{ padding: "12px 16px", color: "#a1a1aa", fontSize: "0.85rem" }}>{org.email}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`badge ${org.stripe_onboarding_complete ? "badge--green" : "badge--gray"}`}>
                        {org.stripe_onboarding_complete ? "Connected" : "Pending"}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <OrganizerActiveToggle organizerId={org.id} initialActive={org.active ?? true} />
                    </td>
                    <td style={{ padding: "12px 16px", color: "#555", fontSize: "0.85rem" }}>
                      {new Date(org.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                  </tr>
                ))}
                {!organizers?.length && (
                  <tr><td colSpan={5} style={{ padding: 24, textAlign: "center", color: "#555" }}>No organizers yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* EVENTS */}
          <h2 style={{ fontSize: "1.1rem", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 12 }}>Events</h2>
          <div className="card" style={{ marginBottom: 32, padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #111" }}>
                  {["Event", "Organizer", "Date", "Location", "Status", "Featured"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#555", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(events ?? []).map((ev: any) => (
                  <tr key={ev.id} style={{ borderBottom: "1px solid #0a0a0a" }}>
                    <td style={{ padding: "12px 16px" }}>
                      <Link href={`/events/${ev.slug}`} style={{ fontWeight: 800, color: "#fff" }} target="_blank">
                        {ev.title} ↗
                      </Link>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#a1a1aa", fontSize: "0.85rem" }}>{ev.organizers?.name}</td>
                    <td style={{ padding: "12px 16px", color: "#a1a1aa", fontSize: "0.85rem" }}>
                      {new Date(ev.starts_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                    </td>
                    <td style={{ padding: "12px 16px", color: "#a1a1aa", fontSize: "0.85rem" }}>
                      {[ev.city, ev.state].filter(Boolean).join(", ")}
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`badge ${ev.status === "published" ? "badge--green" : ev.status === "cancelled" ? "badge--red" : "badge--gray"}`}>
                        {ev.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px" }}>
                      <FeaturedToggle eventId={ev.id} initialFeatured={ev.is_featured ?? false} />
                    </td>
                  </tr>
                ))}
                {!events?.length && (
                  <tr><td colSpan={6} style={{ padding: 24, textAlign: "center", color: "#555" }}>No events yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

          {/* STUCK ORDERS */}
          {stuckOrders.length > 0 && (
            <>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 8, color: "#fb923c" }}>
                ⚠️ Stuck Orders ({stuckOrders.length})
              </h2>
              <p style={{ color: "#a1a1aa", fontSize: "0.8rem", marginBottom: 12 }}>
                Paid orders with no tickets issued — webhook likely dropped. Re-fulfill to issue tickets and resend confirmation.
              </p>
              <div className="card" style={{ marginBottom: 32, padding: 0, overflow: "hidden", border: "1px solid #713f12" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ borderBottom: "1px solid #111" }}>
                      {["Order", "Event", "Buyer", "Total", "Date", "Action"].map(h => (
                        <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#555", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {stuckOrders.map((order: any) => (
                      <tr key={order.id} style={{ borderBottom: "1px solid #0a0a0a" }}>
                        <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "0.8rem", color: "#fb923c" }}>{order.order_code}</td>
                        <td style={{ padding: "12px 16px", fontSize: "0.85rem" }}>{order.events?.title}</td>
                        <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "#a1a1aa" }}>{order.buyer_name}</td>
                        <td style={{ padding: "12px 16px", fontWeight: 800 }}>${Number(order.total).toFixed(2)}</td>
                        <td style={{ padding: "12px 16px", color: "#555", fontSize: "0.8rem" }}>
                          {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </td>
                        <td style={{ padding: "12px 16px" }}>
                          <RefulfillButton orderId={order.id} orderCode={order.order_code} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {/* RECENT ORDERS */}
          <h2 style={{ fontSize: "1.1rem", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 12 }}>Recent Orders</h2>
          <div className="card" style={{ padding: 0, overflow: "hidden" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ borderBottom: "1px solid #111" }}>
                  {["Order", "Event", "Buyer", "Total", "Platform", "Status", "Date"].map(h => (
                    <th key={h} style={{ padding: "10px 16px", textAlign: "left", color: "#555", fontSize: 11, fontWeight: 900, letterSpacing: "0.1em", textTransform: "uppercase" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(orders ?? []).map((order: any) => (
                  <tr key={order.id} style={{ borderBottom: "1px solid #0a0a0a" }}>
                    <td style={{ padding: "12px 16px", fontFamily: "monospace", fontSize: "0.8rem", color: "#a1a1aa" }}>{order.order_code}</td>
                    <td style={{ padding: "12px 16px", fontSize: "0.85rem" }}>{order.events?.title}</td>
                    <td style={{ padding: "12px 16px", fontSize: "0.85rem", color: "#a1a1aa" }}>{order.buyer_name}</td>
                    <td style={{ padding: "12px 16px", fontWeight: 800 }}>${Number(order.total).toFixed(2)}</td>
                    <td style={{ padding: "12px 16px", color: "#22c55e", fontWeight: 800 }}>${Number(order.platform_fee).toFixed(2)}</td>
                    <td style={{ padding: "12px 16px" }}>
                      <span className={`badge ${order.status === "paid" ? "badge--green" : order.status === "cancelled" ? "badge--red" : "badge--gray"}`}>
                        {order.status}
                      </span>
                    </td>
                    <td style={{ padding: "12px 16px", color: "#555", fontSize: "0.8rem" }}>
                      {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </td>
                  </tr>
                ))}
                {!orders?.length && (
                  <tr><td colSpan={7} style={{ padding: 24, textAlign: "center", color: "#555" }}>No orders yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>

        </div>
      </main>
    </div>
  );
}
