import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { sendOrganizerWelcome } from "../../../../lib/notifications/email";
import { PLATFORM_URL } from "../../../../lib/constants";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  if (!token) return NextResponse.redirect(new URL("/organizer/login?error=invalid_token", req.url));

  // Hash the raw token from the URL — DB stores only the hash (consistent with reset_token)
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  const tokenHash = Array.from(new Uint8Array(hashBuf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Use maybeSingle so a missing row (token not found, or already verified)
  // returns null instead of throwing PGRST116 into Supabase error logs.
  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name, email, email_verified, verification_token_expires_at")
    .eq("verification_token", tokenHash)
    .maybeSingle();

  if (!organizer) {
    // Token not found at all — genuinely invalid or already used.
    return NextResponse.redirect(new URL("/organizer/login?error=invalid_token", req.url));
  }

  // Check token expiry — tokens are valid for 7 days from signup
  if (organizer.verification_token_expires_at && new Date(organizer.verification_token_expires_at) < new Date()) {
    // Clear the expired token so the organizer can request a new one
    await supabaseServer
      .from("organizers")
      .update({ verification_token: null })
      .eq("id", organizer.id);
    return NextResponse.redirect(new URL("/organizer/login?error=token_expired", req.url));
  }

  if (organizer.email_verified) {
    // Token matched but email is already verified — e.g. a double-click on the link.
    // Redirect to dashboard with a friendly "already verified" flag rather than
    // showing a confusing "invalid token" error.
    return NextResponse.redirect(new URL("/organizer/dashboard?verified=already", req.url));
  }

  await supabaseServer
    .from("organizers")
    .update({ email_verified: true, verification_token: null, active: true })
    .eq("id", organizer.id);

  // Send welcome email on first verification only
  sendOrganizerWelcome({
    organizerEmail: organizer.email,
    organizerName: organizer.name,
    dashboardUrl: `${PLATFORM_URL}/organizer/dashboard`,
  }).catch(() => {});

  return NextResponse.redirect(new URL("/organizer/login?verified=1", req.url));
}
