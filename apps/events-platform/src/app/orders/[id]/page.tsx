import { notFound } from "next/navigation";
import Link from "next/link";
import { supabaseServer } from "../../../lib/supabase/server";
import NavLogo from "../../../components/NavLogo";

export const revalidate = 0;

export default async function OrderConfirmationPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ resend?: string }>;
}) {
  const { id } = await params;
  const { resend } = await searchParams;

  const { data: order } = await supabaseServer
    .from("orders")
    .select(`
      *,
      events ( title, slug, starts_at, ends_at, venue_name, city, state, cover_image_url ),
      tickets ( id, ticket_code, tier_name, tier_id, qr_code, status )
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
        <div className="wrap" style={{ maxWidth: 560, margin: "0 auto" }}>

          {isPending ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ fontSize: "2.5rem", marginBottom: 16 }}>⏳</p>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 950, marginBottom: 8 }}>Processing your order…</h1>
              <p style={{ color: "#a1a1aa", marginBottom: 24 }}>This usually takes just a moment.</p>
              <meta httpEquiv="refresh" content="3" />
              <p style={{ color: "#555", fontSize: "0.85rem" }}>Page will refresh automatically.</p>
            </div>

          ) : order.status === "cancelled" ? (
            <div style={{ textAlign: "center", padding: "60px 0" }}>
              <p style={{ fontSize: "2.5rem", marginBottom: 16 }}>❌</p>
              <h1 style={{ fontSize: "1.5rem", fontWeight: 950, marginBottom: 8 }}>Order Cancelled</h1>
              <p style={{ color: "#a1a1aa", marginBottom: 24 }}>This order has been cancelled.</p>
              <Link href="/" className="btn btn--primary">Browse Events</Link>
            </div>

          ) : (
            <>
              {/* Success header */}
              <div style={{ textAlign: "center", marginBottom: 32 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 999,
                  background: "#0a2a0a", border: "2px solid #22c55e",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  margin: "0 auto 16px", fontSize: "1.8rem",
                }}>✓</div>
                <h1 style={{ fontSize: "1.8rem", fontWeight: 950, letterSpacing: "-0.05em", marginBottom: 6 }}>You're going!</h1>
                <p style={{ color: "#a1a1aa" }}>
                  Order <span style={{ color: "#fff", fontWeight: 800, fontFamily: "monospace" }}>{order.order_code}</span> confirmed
                </p>
              </div>

              {/* Event summary */}
              <div className="card" style={{ marginBottom: 20, display: "flex", gap: 14, alignItems: "center" }}>
                {event?.cover_image_url && (
                  <img src={event.cover_image_url} alt={event.title} style={{ width: 72, height: 72, borderRadius: 10, objectFit: "cover", flexShrink: 0 }} />
                )}
                <div>
                  <p style={{ fontWeight: 900, fontSize: "1rem", marginBottom: 4 }}>{event?.title}</p>
                  <p style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                    {event?.starts_at && new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                  </p>
                  {event?.venue_name && (
                    <p style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                      {[event.venue_name, event.city, event.state].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
              </div>

              {/* Screenshot instruction banner */}
              <div style={{
                background: "#0a1a0a", border: "1px solid #166534", borderRadius: 12,
                padding: "14px 16px", marginBottom: 24,
                display: "flex", gap: 12, alignItems: "flex-start",
              }}>
                <span style={{ fontSize: "1.4rem", flexShrink: 0 }}>📸</span>
                <div>
                  <p style={{ fontWeight: 900, color: "#22c55e", marginBottom: 4, fontSize: "0.95rem" }}>
                    Save your ticket
                  </p>
                  <p style={{ color: "#a1a1aa", fontSize: "0.85rem", lineHeight: 1.5 }}>
                    <strong style={{ color: "#fff" }}>Screenshot this page</strong> to save your QR code.
                    You'll also receive it by email. Show the QR code at the door — no printout needed.
                  </p>
                </div>
              </div>

              {/* Tickets */}
              <h2 style={{ fontSize: "0.85rem", fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: "#a1a1aa", marginBottom: 12 }}>
                Your Ticket{tickets.length !== 1 ? "s" : ""} ({tickets.length})
              </h2>

              <div style={{ display: "grid", gap: 16, marginBottom: 28 }}>
                {tickets.map((ticket: any) => (
                  <div key={ticket.id} className="card" style={{ textAlign: "center", padding: "28px 20px" }}>
                    {/* Tier + code */}
                    <p style={{ fontWeight: 900, fontSize: "1.05rem", marginBottom: 4 }}>
                      {ticket.tier_name || "General Admission"}
                    </p>
                    <p style={{ color: "#a1a1aa", fontSize: "0.8rem", fontFamily: "monospace", letterSpacing: "0.05em", marginBottom: 20 }}>
                      {ticket.ticket_code}
                    </p>

                    {/* QR Code */}
                    {ticket.qr_code ? (
                      <div style={{ display: "inline-block", padding: 12, background: "#fff", borderRadius: 12 }}>
                        <img
                          src={ticket.qr_code}
                          alt={`QR for ${ticket.ticket_code}`}
                          style={{ width: 200, height: 200, display: "block" }}
                        />
                      </div>
                    ) : (
                      <div style={{
                        width: 224, height: 224, background: "#111", borderRadius: 12,
                        margin: "0 auto", display: "flex", alignItems: "center",
                        justifyContent: "center", color: "#555", fontSize: "0.85rem",
                      }}>
                        QR code generating…
                      </div>
                    )}

                    <p style={{ marginTop: 16, fontSize: "0.8rem", color: "#555" }}>
                      Show at the door · One scan per ticket
                    </p>
                  </div>
                ))}
              </div>

              {/* Order details */}
              <div className="card" style={{ marginBottom: 24 }}>
                <p style={{ color: "#a1a1aa", fontSize: 11, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 12 }}>Order Details</p>
                <div style={{ display: "grid", gap: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                    <span style={{ color: "#a1a1aa" }}>Name</span>
                    <span style={{ fontWeight: 700 }}>{order.buyer_name}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.9rem" }}>
                    <span style={{ color: "#a1a1aa" }}>Email</span>
                    <span style={{ fontWeight: 700 }}>{order.buyer_email}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 8, marginTop: 4, borderTop: "1px solid #111" }}>
                    <span style={{ color: "#a1a1aa" }}>Total Paid</span>
                    <span style={{ fontWeight: 900, color: "#22c55e", fontSize: "1.05rem" }}>${Number(order.total).toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {/* Resend email */}
              <div style={{ textAlign: "center", marginBottom: 24 }}>
                {resend === "sent" && (
                  <p style={{ color: "#22c55e", fontSize: "0.85rem", marginBottom: 10 }}>✓ Confirmation email sent to {order.buyer_email}</p>
                )}
                {resend === "error" && (
                  <p style={{ color: "#ef4444", fontSize: "0.85rem", marginBottom: 10 }}>Failed to send email. Please try again.</p>
                )}
                <form action="/api/orders/resend-email" method="POST" style={{ display: "inline" }}>
                  <input type="hidden" name="orderId" value={order.id} />
                  <button type="submit" className="btn btn--ghost" style={{ fontSize: "0.85rem", minHeight: 36, padding: "0 16px" }}>
                    📧 Resend confirmation email
                  </button>
                </form>
              </div>

              {/* Bottom note */}
              <p style={{ textAlign: "center", color: "#555", fontSize: "0.8rem", lineHeight: 1.6 }}>
                Questions? Contact the event organizer directly.<br />
                <Link href={`/events/${event?.slug}`} style={{ color: "#a1a1aa" }}>← Back to event</Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
