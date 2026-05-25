import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";
import { sendWaitlistNotification } from "../../../../../lib/notifications/email";
import { PLATFORM_URL } from "../../../../../lib/constants";

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

  // Only fetch entries that have not already been notified — cap at 500 per call
  // to prevent a single invocation from timing out on massive waitlists.
  const { data: waitlist } = await supabaseServer
    .from("waitlist")
    .select("id, name, email")
    .eq("event_id", eventId)
    .is("notified_at", null)
    .order("created_at", { ascending: true })
    .limit(500);

  const entries = waitlist ?? [];

  // Send in concurrent batches of 50 (sequential sends timeout on large lists)
  const BATCH_SIZE = 50;
  let sent = 0;
  for (let i = 0; i < entries.length; i += BATCH_SIZE) {
    const batch = entries.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (entry) => {
        try {
          await sendWaitlistNotification({
            email: entry.email,
            name: entry.name,
            eventTitle: event.title,
            eventSlug: event.slug,
          });
          await supabaseServer
            .from("waitlist")
            .update({ notified_at: new Date().toISOString() })
            .eq("id", entry.id);
          sent++;
        } catch {
          // continue on individual failures
        }
      })
    );
  }

  return NextResponse.redirect(
    new URL(`/organizer/dashboard/events/${eventId}?waitlist_notified=${sent}`, PLATFORM_URL),
    303
  );
}
