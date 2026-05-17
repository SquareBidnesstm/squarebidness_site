import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";
import { sendEventBlast } from "../../../../../lib/notifications/email";

export async function POST(req: NextRequest) {
  // Auth — check before parsing body so unauthenticated callers get a fast 401
  // without consuming the request body (avoids unnecessary JSON parsing work).
  const organizerSlug = await getVerifiedOrganizerSlug(req);
  if (!organizerSlug) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name, email")
    .eq("slug", organizerSlug)
    .single();
  if (!organizer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, subject, message } = await req.json();
  if (!eventId || !subject?.trim() || !message?.trim()) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  if (subject.length > 200) {
    return NextResponse.json({ error: "Subject must be 200 characters or fewer." }, { status: 400 });
  }
  if (message.length > 5000) {
    return NextResponse.json({ error: "Message must be 5,000 characters or fewer." }, { status: 400 });
  }

  // Verify ownership
  const { data: event } = await supabaseServer
    .from("events")
    .select("id, title, slug")
    .eq("id", eventId)
    .eq("organizer_id", organizer.id)
    .single();
  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  // Fetch unique paid buyer emails
  const { data: orders } = await supabaseServer
    .from("orders")
    .select("buyer_name, buyer_email")
    .eq("event_id", eventId)
    .eq("status", "paid");

  if (!orders?.length) {
    return NextResponse.json({ sent: 0 });
  }

  // Deduplicate by email
  const seen = new Set<string>();
  const recipients: { email: string; name: string }[] = [];
  for (const o of orders) {
    if (!seen.has(o.buyer_email)) {
      seen.add(o.buyer_email);
      recipients.push({ email: o.buyer_email, name: o.buyer_name });
    }
  }

  const sent = await sendEventBlast({
    organizerName: organizer.name,
    eventTitle: event.title,
    eventSlug: event.slug,
    subject: subject.trim(),
    message: message.trim(),
    recipients,
  });

  return NextResponse.json({ sent });
}
