import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../lib/auth";

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
  const name = (formData.get("name") as string)?.trim();
  const bio = (formData.get("bio") as string)?.trim() || null;
  const logo_url = (formData.get("logo_url") as string)?.trim() || null;

  if (!name) {
    return NextResponse.redirect(
      new URL("/organizer/dashboard/profile?error=missing", req.url),
      303
    );
  }

  // Validate logo_url — must be https:// to prevent javascript: URIs
  if (logo_url && !logo_url.startsWith("https://")) {
    return NextResponse.redirect(
      new URL("/organizer/dashboard/profile?error=invalid_logo_url", req.url),
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
