import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../../lib/auth";
import { EVENT_CATEGORIES } from "../../../../../lib/constants";

export async function POST(req: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
  if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizerSlug = sessionCookie.name.replace("org_session_", "");
  const expectedToken = await computeOrganizerSessionToken(organizerSlug);
  if (sessionCookie.value !== expectedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id")
    .eq("slug", organizerSlug)
    .single();
  if (!organizer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const formData = await req.formData();
  const eventId = formData.get("eventId") as string;

  // Verify ownership
  const { data: event } = await supabaseServer
    .from("events")
    .select("id, organizer_id")
    .eq("id", eventId)
    .single();

  if (!event || event.organizer_id !== organizer.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const title = (formData.get("title") as string)?.trim();
  const description = (formData.get("description") as string)?.trim() || null;
  const category = formData.get("category") as string;
  const starts_at = formData.get("starts_at") as string;
  const ends_at = formData.get("ends_at") as string;
  const venue_name = (formData.get("venue_name") as string)?.trim() || null;
  const address = (formData.get("address") as string)?.trim() || null;
  const city = (formData.get("city") as string)?.trim() || null;
  const state = (formData.get("state") as string)?.trim() || null;
  const cover_image_url = (formData.get("cover_image_url") as string)?.trim() || null;

  if (!title || !starts_at || !ends_at) {
    return NextResponse.redirect(
      new URL(`/organizer/dashboard/events/${eventId}/edit?error=missing`, req.url),
      303
    );
  }

  const validCategory = EVENT_CATEGORIES.find((c) => c.value === category);

  await supabaseServer
    .from("events")
    .update({
      title,
      description,
      category: validCategory?.value ?? "other",
      starts_at: new Date(starts_at).toISOString(),
      ends_at: new Date(ends_at).toISOString(),
      venue_name,
      address,
      city,
      state,
      cover_image_url,
    })
    .eq("id", eventId);

  return NextResponse.redirect(
    new URL(`/organizer/dashboard/events/${eventId}`, req.url),
    303
  );
}
