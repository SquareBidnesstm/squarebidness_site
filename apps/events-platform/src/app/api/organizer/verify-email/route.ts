import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { sendOrganizerWelcome } from "../../../../lib/notifications/email";
import { PLATFORM_URL } from "../../../../lib/constants";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/organizer/login?error=invalid_token", req.url));

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name, email, email_verified")
    .eq("verification_token", token)
    .single();

  if (!organizer) {
    return NextResponse.redirect(new URL("/organizer/login?error=invalid_token", req.url));
  }

  await supabaseServer
    .from("organizers")
    .update({ email_verified: true, verification_token: null, active: true })
    .eq("id", organizer.id);

  // Send welcome email on first verification only
  if (!organizer.email_verified) {
    sendOrganizerWelcome({
      organizerEmail: organizer.email,
      organizerName: organizer.name,
      dashboardUrl: `${PLATFORM_URL}/organizer/dashboard`,
    }).catch(() => {});
  }

  return NextResponse.redirect(new URL("/organizer/dashboard?verified=1", req.url));
}
