import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  const { ticketCode } = await req.json();

  if (!ticketCode) {
    return NextResponse.json({ ok: false, message: "No ticket code provided" });
  }

  const { data: ticket } = await supabaseServer
    .from("tickets")
    .select("*, ticket_tiers ( name )")
    .eq("ticket_code", ticketCode.trim().toUpperCase())
    .single();

  if (!ticket) {
    return NextResponse.json({ ok: false, message: "Ticket not found" });
  }

  if (ticket.status === "checked_in") {
    return NextResponse.json({
      ok: false,
      message: `Already checked in at ${new Date(ticket.checked_in_at).toLocaleTimeString()}`,
      ticket: {
        buyer_name: ticket.buyer_name,
        tier_name: (ticket.ticket_tiers as any)?.name,
      },
    });
  }

  if (ticket.status === "cancelled" || ticket.status === "refunded") {
    return NextResponse.json({
      ok: false,
      message: `Ticket is ${ticket.status}`,
      ticket: {
        buyer_name: ticket.buyer_name,
        tier_name: (ticket.ticket_tiers as any)?.name,
      },
    });
  }

  // Mark as checked in
  await supabaseServer
    .from("tickets")
    .update({ status: "checked_in", checked_in_at: new Date().toISOString() })
    .eq("id", ticket.id);

  // Log the check-in
  await supabaseServer.from("check_ins").insert({
    ticket_id: ticket.id,
    event_id: ticket.event_id,
    scanned_at: new Date().toISOString(),
  });

  return NextResponse.json({
    ok: true,
    message: "Welcome in!",
    ticket: {
      buyer_name: ticket.buyer_name,
      tier_name: (ticket.ticket_tiers as any)?.name,
    },
  });
}
