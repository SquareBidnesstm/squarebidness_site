import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseServer } from "../../../../lib/supabase/server";
import { PLATFORM_URL } from "../../../../lib/constants";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name, email")
    .eq("email", email.trim().toLowerCase())
    .single();

  // Always return ok to prevent email enumeration
  if (!organizer) return NextResponse.json({ ok: true });

  // Generate a secure random token
  const rawToken = crypto.randomUUID();
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await supabaseServer
    .from("organizers")
    .update({ reset_token: rawToken, reset_token_expires_at: expires.toISOString() })
    .eq("id", organizer.id);

  const resetUrl = `${PLATFORM_URL}/organizer/reset-password?token=${rawToken}`;

  await resend.emails.send({
    from: "SB Events <tickets@events.squarebidness.com>",
    to: organizer.email,
    subject: "Reset your SB Events password",
    html: `
      <div style="background:#000;color:#fff;font-family:sans-serif;padding:40px 24px;max-width:480px;margin:0 auto;">
        <p style="font-size:1.5rem;font-weight:900;margin-bottom:8px;">Reset your password</p>
        <p style="color:#a1a1aa;margin-bottom:24px;">Hey ${organizer.name}, click below to reset your password. This link expires in 1 hour.</p>
        <a href="${resetUrl}" style="display:inline-block;background:#ef4444;color:#fff;font-weight:900;padding:14px 28px;border-radius:10px;text-decoration:none;font-size:1rem;">
          Reset Password
        </a>
        <p style="color:#555;font-size:0.8rem;margin-top:24px;">If you didn't request this, ignore this email. Your password won't change.</p>
      </div>
    `,
  });

  return NextResponse.json({ ok: true });
}
