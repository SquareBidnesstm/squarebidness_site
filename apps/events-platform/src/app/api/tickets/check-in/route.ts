import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../lib/auth";
import { checkRateLimit, recordAttempt } from "../../../../lib/utils";

export async function POST(req: NextRequest) {
  // Auth: only verified organizers may process check-ins
  const organizerSlug = await getVerifiedOrganizerSlug(req);
  if (!organizerSlug) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  // Rate limit: 60 scans per 15 min per IP (allows active scanning while blocking brute force)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`checkin:${ip}`);
  const { limited, retryAfterSeconds } = await checkRateLimit(`checkin:${ip}`, 60);
  if (limited) {
    return NextResponse.json(
      { ok: false, message: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { ticketCode } = await req.json();

  if (!ticketCode) {
    return NextResponse.json({ ok: false, message: "No ticket code provided" });
  }

  const { data: ticket } = await supabaseServer
    .from("tickets")
    .select("*, ticket_tiers ( name ), events ( organizer_id, organizers ( slug ) )")
    .eq("ticket_code", ticketCode.trim().toUpperCase())
    .single();

  if (!ticket) {
    return NextResponse.json({ ok: false, message: "Ticket not found" });
  }

  // Ownership check: only the event's organizer may check in tickets
  const eventOrganizer = (ticket as any).events?.organizers;
  const eventOrganizerSlug = Array.isArray(eventOrganizer)
    ? eventOrganizer[0]?.slug
    : eventOrganizer?.slug;
  if (eventOrganizerSlug !== organizerSlug) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
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
