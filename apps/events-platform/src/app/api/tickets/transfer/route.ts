import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { generateQRDataURL } from "../../../../lib/qr";

export async function POST(req: NextRequest) {
  const { ticketCode, newName, newEmail } = await req.json();

  if (!ticketCode || !newName?.trim() || !newEmail?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const cleanEmail = newEmail.trim().toLowerCase();
  const cleanName = newName.trim();

  // Fetch the ticket
  const { data: ticket } = await supabaseServer
    .from("tickets")
    .select("id, ticket_code, status, buyer_email, buyer_name, event_id, tier_name, order_id")
    .eq("ticket_code", ticketCode.trim().toUpperCase())
    .single();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.status !== "valid") {
    return NextResponse.json({ error: ticket.status === "checked_in" ? "This ticket has already been used." : "This ticket cannot be transferred." }, { status: 400 });
  }
  if (ticket.buyer_email === cleanEmail) {
    return NextResponse.json({ error: "Transfer email must be different from the current holder." }, { status: 400 });
  }

  // Generate new QR for the new owner (invalidates old QR implicitly since check-in reads ticket_code)
  const newQr = await generateQRDataURL(ticket.ticket_code);

  await supabaseServer
    .from("tickets")
    .update({ buyer_name: cleanName, buyer_email: cleanEmail, qr_code: newQr })
    .eq("id", ticket.id);

  return NextResponse.json({ ok: true, newEmail: cleanEmail });
}
