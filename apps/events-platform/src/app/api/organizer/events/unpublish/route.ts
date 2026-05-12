import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../../lib/auth";

export async function POST(req: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
  if (!sessionCookie) return NextResponse.redirect(new URL("/organizer/login", req.url));

  const organizerSlug = sessionCookie.name.replace("org_session_", "");
  const expectedToken = await computeOrganizerSessionToken(organizerSlug);
  if (sessionCookie.value !== expectedToken) return NextResponse.redirect(new URL("/organizer/login", req.url));

  const { data: organizer } = await supabaseServer.from("organizers").select("id").eq("slug", organizerSlug).single();
  if (!organizer) return NextResponse.redirect(new URL("/organizer/login", req.url));

  const formData = await req.formData();
  const eventId = formData.get("eventId") as string;

  await supabaseServer
    .from("events")
    .update({ status: "draft", is_public: false })
    .eq("id", eventId)
    .eq("organizer_id", organizer.id);

  return NextResponse.redirect(new URL(`/organizer/dashboard/events/${eventId}`, req.url));
}
