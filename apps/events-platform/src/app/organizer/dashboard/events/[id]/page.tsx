import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../../lib/auth";
import { EVENT_CATEGORIES } from "../../../../../lib/constants";
import NavLogo from "../../../../../components/NavLogo";
import RefundButton from "../../../../../components/RefundButton";
import TierEditor from "../../../../../components/TierEditor";
import EmailBlastForm from "../../../../../components/EmailBlastForm";

export const revalidate = 0;

export default async function ManageEventPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ waitlist_notified?: string; blast_sent?: string }>;
}) {
  const { id } = await params;
  const { waitlist_notified, blast_sent } = await searchParams;

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

  const { data: event } = await supabaseServer
    .from("events")
    .select("*, ticket_tiers ( * )")
    .eq("id", id)
    .eq("organizer_id", organizer.id)
    .single();

  if (!event) notFound();

  const tiers = (event.ticket_tiers ?? []) as any[];
  const totalSold = tiers.reduce((s: number, t: any) => s + t.quantity_sold, 0);
  const totalCapacity = tiers.reduce((s: number, t: any) => s + t.quantity, 0);
  const revenue = tiers.reduce((s: number, t: any) => s + (Number(t.price) * t.quantity_sold), 0);
  const categoryLabel = EVENT_CATEGORIES.find(c => c.value === event.category)?.label ?? event.category;

  const { data: orders } = await supabaseServer
    .from("orders")
    .select("id, order_code, buyer_name, buyer_email, total, status, created_at")
    .eq("event_id", event.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const orderList = (orders ?? []) as any[];

  const { data: waitlistEntries } = await supabaseServer
    .from("waitlist")
    .select("id, name, email, created_at")
    .eq("event_id", event.id)
    .order("created_at", { ascending: true });

  const waitlist = (waitlistEntries ?? []) as any[];

  const { count: checkedInCount } = await supabaseServer
    .from("tickets")
    .select("id", { count: "exact", head: true })
    .eq("event_id", event.id)
    .eq("status", "checked_in");

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

          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "start", marginBottom: 28, gap: 16, flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em" }}>{event.title}</h1>
                <span className={`badge ${event.status === "published" ? "badge--green" : event.status === "cancelled" ? "badge--red" : "badge--gray"}`}>
                  {event.status}
                </span>
              </div>
              <p style={{ color: "#a1a1aa", fontSize: "0.9rem" }}>
                {categoryLabel} · {new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <Link href={`/organizer/dashboard/events/${event.id}/edit`} className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>
                ✏️ Edit
              </Link>
              <Link href={`/events/${event.slug}`} className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }} target="_blank">
                View ↗
              </Link>
              <Link href={`/scan/${event.slug}`} className="btn btn--outline" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>
                🔍 Scanner
              </Link>
              <form action="/api/organizer/events/duplicate" method="POST" style={{ display: "inline" }}>
                <input type="hidden" name="eventId" value={event.id} />
                <button type="submit" className="btn btn--ghost" style={{ minHeight: 36, fontSize: "0.85rem", padding: "0 14px" }}>
                  📋 Duplicate
                </button>
              </form>
            </div>
          </div>

          {/* Stats */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12, marginBottom: 28 }}>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Tickets Sold</p>
              <p style={{ fontSize: "2rem", fontWeight: 950 }}>{totalSold}</p>
              <p style={{ color: "#555", fontSize: "0.8rem" }}>of {totalCapacity}</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Gross Revenue</p>
              <p style={{ fontSize: "2rem", fontWeight: 950, color: "#22c55e" }}>${revenue.toFixed(2)}</p>
              <p style={{ color: "#555", fontSize: "0.8rem" }}>before platform fee</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Capacity</p>
              <p style={{ fontSize: "2rem", fontWeight: 950 }}>
                {totalCapacity > 0 ? Math.round((totalSold / totalCapacity) * 100) : 0}%
              </p>
              <p style={{ color: "#555", fontSize: "0.8rem" }}>filled</p>
            </div>
            <div className="card" style={{ textAlign: "center" }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>Checked In</p>
              <p style={{ fontSize: "2rem", fontWeight: 950, color: "#60a5fa" }}>{checkedInCount ?? 0}</p>
              <p style={{ color: "#555", fontSize: "0.8rem" }}>of {totalSold} sold</p>
            </div>
          </div>

          {/* Ticket Tiers */}
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>Ticket Tiers</p>
            <TierEditor tiers={tiers.map((t: any) => ({
              id: t.id,
              name: t.name,
              description: t.description,
              price: Number(t.price),
              quantity: t.quantity,
              quantity_sold: t.quantity_sold,
              groupMinQty: t.group_min_qty ?? null,
              groupDiscountPct: t.group_discount_pct ? Number(t.group_discount_pct) : null,
            }))} />
          </div>

          {/* Orders */}
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
              Orders ({orderList.length})
            </p>
            {orderList.length === 0 ? (
              <p style={{ color: "#555", fontSize: "0.9rem" }}>No orders yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 8 }}>
                {orderList.map((order: any) => (
                  <div key={order.id} style={{
                    display: "flex", justifyContent: "space-between", alignItems: "center",
                    padding: "12px 14px", background: "#050505", borderRadius: 10,
                    border: "1px solid #1d1d1f", gap: 12, flexWrap: "wrap",
                  }}>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                        <p style={{ fontWeight: 800, fontSize: "0.9rem", fontFamily: "monospace" }}>{order.order_code}</p>
                        <span style={{
                          fontSize: "0.7rem", fontWeight: 900, padding: "2px 8px", borderRadius: 99,
                          background: order.status === "paid" ? "#0a2a0a" : order.status === "cancelled" ? "#1a0a0a" : "#1a1a0a",
                          color: order.status === "paid" ? "#22c55e" : order.status === "cancelled" ? "#ef4444" : "#eab308",
                          border: `1px solid ${order.status === "paid" ? "#166534" : order.status === "cancelled" ? "#7f1d1d" : "#713f12"}`,
                          textTransform: "uppercase",
                        }}>
                          {order.status}
                        </span>
                      </div>
                      <p style={{ color: "#a1a1aa", fontSize: "0.8rem" }}>{order.buyer_name} · {order.buyer_email}</p>
                      <p style={{ color: "#555", fontSize: "0.75rem" }}>
                        {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 12, flexShrink: 0 }}>
                      <p style={{ fontWeight: 900, color: "#22c55e", fontSize: "0.95rem" }}>
                        ${Number(order.total).toFixed(2)}
                      </p>
                      {order.status === "paid" && (
                        <RefundButton
                          orderId={order.id}
                          orderCode={order.order_code}
                          buyerName={order.buyer_name}
                          total={Number(order.total)}
                        />
                      )}
                      {order.status === "cancelled" && (
                        <span style={{ fontSize: "0.75rem", color: "#555" }}>Refunded</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Email Blast */}
          <div className="card" style={{ marginBottom: 24 }}>
            <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
              📣 Email Attendees
            </p>
            <EmailBlastForm eventId={event.id} recipientCount={orderList.filter((o: any) => o.status === "paid").length} />
          </div>

          {/* Waitlist */}
          <div className="card" style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                Waitlist ({waitlist.length})
              </p>
              {waitlist.length > 0 && (
                <form action="/api/organizer/events/notify-waitlist" method="POST" style={{ display: "inline" }}>
                  <input type="hidden" name="eventId" value={event.id} />
                  <button type="submit" className="btn btn--ghost" style={{ minHeight: 32, fontSize: "0.8rem", padding: "0 12px" }}>
                    📣 Notify All
                  </button>
                </form>
              )}
            </div>
            {waitlist_notified && (
              <div style={{ background: "#0a2a0a", border: "1px solid #166534", borderRadius: 8, padding: "10px 14px", marginBottom: 12, color: "#22c55e", fontSize: "0.85rem" }}>
                ✓ Notified {waitlist_notified} waitlist {Number(waitlist_notified) === 1 ? "person" : "people"} by email.
              </div>
            )}
            {waitlist.length === 0 ? (
              <p style={{ color: "#555", fontSize: "0.9rem" }}>No one on the waitlist yet.</p>
            ) : (
              <div style={{ display: "grid", gap: 6 }}>
                {waitlist.map((entry: any) => (
                  <div key={entry.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 12px", background: "#050505", borderRadius: 8, border: "1px solid #1d1d1f", fontSize: "0.85rem" }}>
                    <span style={{ fontWeight: 700 }}>{entry.name}</span>
                    <span style={{ color: "#a1a1aa" }}>{entry.email}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Publish / Cancel actions */}
          {event.status === "draft" && (
            <form action="/api/organizer/events/publish" method="POST" style={{ display: "inline" }}>
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" className="btn btn--primary" style={{ marginRight: 10 }}>
                Publish Event
              </button>
            </form>
          )}
          {event.status === "published" && (
            <form action="/api/organizer/events/unpublish" method="POST" style={{ display: "inline" }}>
              <input type="hidden" name="eventId" value={event.id} />
              <button type="submit" className="btn btn--ghost">
                Unpublish
              </button>
            </form>
          )}

        </div>
      </main>
    </div>
  );
}
