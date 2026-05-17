import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { generateQRDataURL } from "../../../../lib/qr";
import { sendTicketTransferNotice, sendTicketTransferReceived } from "../../../../lib/notifications/email";
import { checkRateLimit, recordAttempt, isSafeOrigin } from "../../../../lib/utils";

export async function POST(req: NextRequest) {
  // CSRF origin check — ticket transfers are unauthenticated, so origin validation
  // is the primary CSRF defense until signed transfer tokens are implemented.
  if (!isSafeOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 3 per 15 min per IP (tightened — unauthenticated endpoint)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`ticket_transfer:${ip}`);
  const { limited, retryAfterSeconds } = checkRateLimit(`ticket_transfer:${ip}`, 3);
  if (limited) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { ticketCode, currentEmail, newName, newEmail } = await req.json();

  if (!ticketCode || !currentEmail?.trim() || !newName?.trim() || !newEmail?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const cleanCurrentEmail = currentEmail.trim().toLowerCase();
  const cleanEmail = newEmail.trim().toLowerCase();
  const cleanName = newName.trim();

  // Fetch the ticket (and event title for the notification email)
  const { data: ticket } = await supabaseServer
    .from("tickets")
    .select("id, ticket_code, status, buyer_email, buyer_name, event_id, tier_name, order_id, events ( title )")
    .eq("ticket_code", ticketCode.trim().toUpperCase())
    .single();

  if (!ticket) return NextResponse.json({ error: "Ticket not found" }, { status: 404 });
  if (ticket.status !== "valid") {
    return NextResponse.json({ error: ticket.status === "checked_in" ? "This ticket has already been used." : "This ticket cannot be transferred." }, { status: 400 });
  }

  // Verify the requester is the current ticket holder
  if (ticket.buyer_email !== cleanCurrentEmail) {
    return NextResponse.json({ error: "The email provided does not match the current ticket holder." }, { status: 403 });
  }

  if (cleanCurrentEmail === cleanEmail) {
    return NextResponse.json({ error: "Transfer email must be different from the current holder." }, { status: 400 });
  }

  // Generate new QR for the new owner (invalidates old QR implicitly since check-in reads ticket_code)
  const newQr = await generateQRDataURL(ticket.ticket_code);

  const originalEmail = ticket.buyer_email;
  const originalName = ticket.buyer_name;

  await supabaseServer
    .from("tickets")
    .update({ buyer_name: cleanName, buyer_email: cleanEmail, qr_code: newQr })
    .eq("id", ticket.id);

  // Audit log — non-blocking, failure is acceptable
  void supabaseServer.from("ticket_transfers").insert({
    ticket_id: ticket.id,
    from_email: originalEmail,
    to_name: cleanName,
    to_email: cleanEmail,
    transferred_at: new Date().toISOString(),
  });

  // Notify the original holder — non-blocking, failure is acceptable
  const eventTitle = (ticket as any).events?.title ?? "your event";
  sendTicketTransferNotice({
    originalEmail,
    originalName,
    newName: cleanName,
    newEmail: cleanEmail,
    ticketCode: ticket.ticket_code,
    tierName: ticket.tier_name ?? "Ticket",
    eventTitle,
  }).catch(() => {});

  // Notify the new holder with their ticket code and QR code — non-blocking
  sendTicketTransferReceived({
    newName: cleanName,
    newEmail: cleanEmail,
    ticketCode: ticket.ticket_code,
    tierName: ticket.tier_name ?? "Ticket",
    eventTitle,
    qrDataUrl: newQr,
  }).catch(() => {});

  return NextResponse.json({ ok: true, newEmail: cleanEmail });
}
