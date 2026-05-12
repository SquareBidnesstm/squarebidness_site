import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase/server";
import NavLogo from "../../../components/NavLogo";

export const revalidate = 0;

export default async function OrderConfirmationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const { data: order } = await supabaseServer
    .from("orders")
    .select(`
      *,
      events ( title, slug, starts_at, venue_name, city, state, cover_image_url ),
      tickets ( id, ticket_code, tier_name, qr_data_url, status )
    `)
    .eq("id", id)
    .single();

  if (!order) notFound();

  const event = order.events as any;
  const tickets = (order.tickets as any[]) ?? [];
  const isPending = order.status === "pending";

  return (
    <div style={{ minHeight: "100vh" }}>
      <nav style={{ borderBottom: "1px solid #111", padding: "0 14px", display: "flex", alignItems: "center", justifyContent: "space-between", height: 64, background: "#000" }}>
        <NavLogo />
        <Link href="/" style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>← Back to Events</Link>
      </nav>

      <main style={{ padding: "40px 14px 80px" }}>
        <div className="wrap" style={{ maxWidth: 600, margin: "0 auto" }}>

          {isPending ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: "2rem", marginBottom: 12 }}>⏳</p>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 950, marginBottom: 8 }}>Processing your order…</h1>
              <p style={{ color: "#a1a1aa" }}>This usually takes just a moment. Refresh this page in a few seconds.</p>
            </div>
          ) : order.status === "cancelled" ? (
            <div style={{ textAlign: "center", padding: "40px 0" }}>
              <p style={{ fontSize: "2rem", marginBottom: 12 }}>❌</p>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 950, marginBottom: 8 }}>Order Cancelled</h1>
              <p style={{ color: "#a1a1aa", marginBottom: 20 }}>This order has been cancelled.</p>
              <Link href="/" className="btn btn--primary">Browse Events</Link>
            </div>
          ) : (
            <>
              {/* Success Header */}
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{ width: 64, height: 64, borderRadius: 999, background: "#0a2a0a", border: "1px solid #166534", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", fontSize: "1.8rem" }}>
                  ✓
                </div>
                <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>You're going!</h1>
                <p style={{ color: "#a1a1aa" }}>Order <span style={{ color: "#fff", fontWeight: 800 }}>{order.order_code}</span> confirmed</p>
              </div>

              {/* Event Summary */}
              <div className="card" style={{ marginBottom: 20, display: "flex", gap: 14, alignItems: "center" }}>
                {event?.cover_image_url && (
                  <img src={event.cover_image_url} alt={event.title} style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                )}
                <div>
                  <p style={{ fontWeight: 900, fontSize: "1rem" }}>{event?.title}</p>
                  <p style={{ color: "#a1a1aa", fontSize: "0.85rem", marginTop: 2 }}>
                    {event?.starts_at && new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                    {event?.venue_name && ` · ${event.venue_name}`}
                    {event?.city && `, ${event.city}`}
                  </p>
                </div>
              </div>

              {/* Tickets */}
              <h2 style={{ fontSize: "1rem", fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 12 }}>
                Your Ticket{tickets.length !== 1 ? "s" : ""} ({tickets.length})
              </h2>

              <div style={{ display: "grid", gap: 12, marginBottom: 28 }}>
                {tickets.map((ticket: any) => (
                  <div key={ticket.id} className="card" style={{ textAlign: "center", padding: 24 }}>
                    <p style={{ fontWeight: 900, fontSize: "1rem", marginBottom: 4 }}>{ticket.tier_name}</p>
                    <p style={{ color: "#a1a1aa", fontSize: "0.8rem", fontFamily: "monospace", marginBottom: 16 }}>
                      {ticket.ticket_code}
                    </p>
                    {ticket.qr_data_url ? (
                      <img
                        src={ticket.qr_data_url}
                        alt={`QR code for ${ticket.ticket_code}`}
                        style={{ width: 180, height: 180, margin: "0 auto", display: "block", borderRadius: 8 }}
                      />
                    ) : (
                      <div style={{ width: 180, height: 180, background: "#111", borderRadius: 8, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "center", color: "#555" }}>
                        QR generating…
                      </div>
                    )}
                    <p style={{ marginTop: 12, fontSize: "0.8rem", color: "#555" }}>
                      Show this QR code at the door
                    </p>
                  </div>
                ))}
              </div>

              {/* Order Details */}
              <div className="card" style={{ marginBottom: 20 }}>
                <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Order Details</p>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#a1a1aa" }}>Name</span>
                    <span style={{ fontWeight: 700 }}>{order.buyer_name}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between" }}>
                    <span style={{ color: "#a1a1aa" }}>Email</span>
                    <span style={{ fontWeight: 700 }}>{order.buyer_email}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid #111", paddingTop: 8, marginTop: 4 }}>
                    <span style={{ color: "#a1a1aa" }}>Total Paid</span>
                    <span style={{ fontWeight: 900, color: "#22c55e" }}>${Number(order.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <Link href={`/events/${event?.slug}`} style={{ color: "#a1a1aa", fontSize: "0.85rem", display: "block", textAlign: "center" }}>
                ← Back to event
              </Link>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
