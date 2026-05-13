import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/organizer/login?error=invalid_token", req.url));

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, email_verified")
    .eq("verification_token", token)
    .single();

  if (!organizer) {
    return NextResponse.redirect(new URL("/organizer/login?error=invalid_token", req.url));
  }

  await supabaseServer
    .from("organizers")
    .update({ email_verified: true, verification_token: null, active: true })
    .eq("id", organizer.id);

  return NextResponse.redirect(new URL("/organizer/dashboard?verified=1", req.url));
}
