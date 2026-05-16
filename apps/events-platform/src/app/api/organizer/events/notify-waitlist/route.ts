import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";
import { sendWaitlistNotification } from "../../../../../lib/notifications/email";

export async function POST(req: NextRequest) {
  const organizerSlug = await getVerifiedOrganizerSlug(req);
  if (!organizerSlug) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id")
    .eq("slug", organizerSlug)
    .single();
  if (!organizer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const eventId = formData.get("eventId") as string;

  const { data: event } = await supabaseServer
    .from("events")
    .select("id, slug, title, organizer_id")
    .eq("id", eventId)
    .single();

  if (!event || event.organizer_id !== organizer.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: waitlist } = await supabaseServer
    .from("waitlist")
    .select("id, name, email")
    .eq("event_id", eventId)
    .order("created_at", { ascending: true });

  const entries = waitlist ?? [];

  let sent = 0;
  for (const entry of entries) {
    try {
      await sendWaitlistNotification({
        email: entry.email,
        name: entry.name,
        eventTitle: event.title,
        eventSlug: event.slug,
      });
      sent++;
    } catch {
      // continue on individual failures
    }
  }

  return NextResponse.redirect(
    new URL(`/organizer/dashboard/events/${eventId}?waitlist_notified=${sent}`, req.url),
    303
  );
}
