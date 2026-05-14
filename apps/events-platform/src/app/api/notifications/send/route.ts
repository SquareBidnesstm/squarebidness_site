import { NextRequest, NextResponse } from "next/server";
import webpush from "web-push";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../lib/auth";

webpush.setVapidDetails(
  "mailto:events@squarebidness.com",
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(req: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const session = cookieStore.getAll().find((c) => c.name.startsWith("org_session_"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizerSlug = session.name.replace("org_session_", "");
  const expected = await computeOrganizerSessionToken(organizerSlug);
  if (session.value !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabaseServer
    .from("organizers").select("id").eq("slug", organizerSlug).single();
  if (!organizer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { eventId, title, body } = await req.json();
  if (!eventId || !title) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  // Verify ownership
  const { data: event } = await supabaseServer
    .from("events").select("id, organizer_id, slug").eq("id", eventId).single();
  if (!event || event.organizer_id !== organizer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Fetch all push subscriptions for this event
  const { data: subs } = await supabaseServer
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("event_id", eventId);

  if (!subs?.length) return NextResponse.json({ ok: true, sent: 0 });

  const payload = JSON.stringify({
    title,
    body: body || "",
    url: `/events/${event.slug}`,
    icon: "/events-192.png",
  });

  let sent = 0;
  const stale: string[] = [];

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload
        );
        sent++;
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          stale.push(sub.endpoint);
        }
      }
    })
  );

  // Clean up expired subscriptions
  if (stale.length > 0) {
    await supabaseServer.from("push_subscriptions").delete().in("endpoint", stale);
  }

  return NextResponse.json({ ok: true, sent });
}
