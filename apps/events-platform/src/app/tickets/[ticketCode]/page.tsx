import { notFound } from "next/navigation";
import { supabaseServer } from "../../../lib/supabase/server";
import { generateQRDataURL } from "../../../lib/qr";

export const revalidate = 0;

export default async function TicketPage({
  params,
}: {
  params: Promise<{ ticketCode: string }>;
}) {
  const { ticketCode } = await params;

  const { data: ticket } = await supabaseServer
    .from("tickets")
    .select(`
      *,
      events ( title, starts_at, ends_at, venue_name, city, state, cover_image_url ),
      ticket_tiers ( name, price )
    `)
    .eq("ticket_code", ticketCode)
    .single();

  if (!ticket) notFound();

  const qrDataURL = await generateQRDataURL(ticketCode);
  const event = ticket.events as any;
  const tier = ticket.ticket_tiers as any;
  const isCheckedIn = ticket.status === "checked_in";
  const isCancelled = ticket.status === "cancelled" || ticket.status === "refunded";

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 400 }}>

        {/* Status Banner */}
        {isCheckedIn && (
          <div style={{ background: "#0a1a0a", border: "1px solid #166534", borderRadius: 12, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
            <p style={{ color: "#22c55e", fontWeight: 900 }}>✓ Checked In</p>
            {ticket.checked_in_at && (
              <p style={{ color: "#a1a1aa", fontSize: "0.85rem", marginTop: 4 }}>
                {new Date(ticket.checked_in_at).toLocaleTimeString()}
              </p>
            )}
          </div>
        )}

        {isCancelled && (
          <div style={{ background: "#1a0a0a", border: "1px solid #7f1d1d", borderRadius: 12, padding: "12px 16px", marginBottom: 16, textAlign: "center" }}>
            <p style={{ color: "#f87171", fontWeight: 900 }}>Ticket {ticket.status === "refunded" ? "Refunded" : "Cancelled"}</p>
          </div>
        )}

        {/* Ticket Card */}
        <div style={{
          background: "#070707",
          border: "1px solid #2a2a2d",
          borderRadius: 20,
          overflow: "hidden",
          opacity: isCancelled ? 0.5 : 1,
        }}>
          {/* Event cover */}
          <div style={{ height: 140, background: "#0a0a0a" }}>
            {event?.cover_image_url ? (
              <img src={event.cover_image_url} alt={event.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>🎟️</div>
            )}
          </div>

          {/* Info */}
          <div style={{ padding: 20 }}>
            <h1 style={{ fontSize: "1.2rem", fontWeight: 950, letterSpacing: "-0.04em", marginBottom: 4 }}>{event?.title}</h1>
            <p style={{ color: "#22c55e", fontWeight: 800, fontSize: "0.85rem", marginBottom: 12 }}>{tier?.name}</p>

            <div style={{ display: "grid", gap: 10, marginBottom: 20, borderTop: "1px solid #1d1d1f", paddingTop: 14 }}>
              <div>
                <p style={{ color: "#71717a", fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>Date</p>
                <p style={{ fontWeight: 700, marginTop: 2 }}>
                  {event?.starts_at && new Date(event.starts_at).toLocaleDateString("en-US", {
                    weekday: "long", month: "long", day: "numeric",
                  })}
                </p>
                <p style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>
                  {event?.starts_at && new Date(event.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                </p>
              </div>
              <div>
                <p style={{ color: "#71717a", fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>Location</p>
                <p style={{ fontWeight: 700, marginTop: 2 }}>{event?.venue_name}</p>
                <p style={{ color: "#a1a1aa", fontSize: "0.85rem" }}>{[event?.city, event?.state].filter(Boolean).join(", ")}</p>
              </div>
              <div>
                <p style={{ color: "#71717a", fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>Ticket Holder</p>
                <p style={{ fontWeight: 700, marginTop: 2 }}>{ticket.buyer_name}</p>
              </div>
              <div>
                <p style={{ color: "#71717a", fontSize: 10, fontWeight: 900, letterSpacing: "0.14em", textTransform: "uppercase" }}>Ticket Code</p>
                <p style={{ fontWeight: 700, marginTop: 2, fontFamily: "monospace", letterSpacing: "0.08em" }}>{ticket.ticket_code}</p>
              </div>
            </div>

            {/* QR Code */}
            <div style={{ background: "#fff", borderRadius: 14, padding: 16, textAlign: "center" }}>
              <img src={qrDataURL} alt="Ticket QR Code" style={{ width: "100%", maxWidth: 200, margin: "0 auto", borderRadius: 8 }} />
              <p style={{ color: "#555", fontSize: "0.75rem", marginTop: 8 }}>Show this QR at the door</p>
            </div>
          </div>
        </div>

        <p style={{ textAlign: "center", color: "#555", fontSize: "0.8rem", marginTop: 16 }}>
          Square Bidness Events · Keep this page saved
        </p>
      </div>
    </div>
  );
}
