import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../lib/auth";

export async function POST(req: NextRequest) {
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
  const name = (formData.get("name") as string)?.trim();
  const bio = (formData.get("bio") as string)?.trim() || null;
  const logo_url = (formData.get("logo_url") as string)?.trim() || null;

  if (!name) {
    return NextResponse.redirect(
      new URL("/organizer/dashboard/profile?error=missing", req.url),
      303
    );
  }

  const { error } = await supabaseServer
    .from("organizers")
    .update({ name, bio, logo_url })
    .eq("id", organizer.id);

  if (error) {
    return NextResponse.redirect(
      new URL("/organizer/dashboard/profile?error=failed", req.url),
      303
    );
  }

  return NextResponse.redirect(
    new URL("/organizer/dashboard/profile?saved=1", req.url),
    303
  );
}
