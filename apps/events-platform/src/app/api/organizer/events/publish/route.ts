import { NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";

export async function POST(req: Request) {
  const organizerSlug = await getVerifiedOrganizerSlug(req);
  if (!organizerSlug) return NextResponse.redirect(new URL("/organizer/login", req.url));

  const { data: organizer } = await supabaseServer.from("organizers").select("id").eq("slug", organizerSlug).single();
  if (!organizer) return NextResponse.redirect(new URL("/organizer/login", req.url));

  const formData = await req.formData();
  const eventId = formData.get("eventId") as string;

  await supabaseServer
    .from("events")
    .update({ status: "published", is_public: true })
    .eq("id", eventId)
    .eq("organizer_id", organizer.id);

  return NextResponse.redirect(new URL(`/organizer/dashboard/events/${eventId}`, req.url));
}
