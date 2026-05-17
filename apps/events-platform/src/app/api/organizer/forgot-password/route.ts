import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseServer } from "../../../../lib/supabase/server";
import { PLATFORM_URL } from "../../../../lib/constants";
import { isSafeOrigin, checkRateLimit, recordAttempt } from "../../../../lib/utils";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  // CSRF origin check
  if (!isSafeOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 5 per 15 min per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`forgot_pw:${ip}`);
  const { limited, retryAfterSeconds } = await checkRateLimit(`forgot_pw:${ip}`, 5);
  if (limited) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { email } = await req.json();
  if (!email) return NextResponse.json({ error: "Email required" }, { status: 400 });

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id, name, email")
    .eq("email", email.trim().toLowerCase())
    .maybeSingle();

  // Always return ok to prevent email enumeration
  if (!organizer) return NextResponse.json({ ok: true });

  // Generate a secure random token — store only the SHA-256 hash in the DB
  const rawToken = crypto.randomUUID();
  const hashBuf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawToken));
  const tokenHash = Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, "0")).join("");
  const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

  await supabaseServer
    .from("organizers")
    .update({ reset_token: tokenHash, reset_token_expires_at: expires.toISOString() })
    .eq("id", organizer.id);

  // Send rawToken in the email link — only the hash is persisted
  const resetUrl = `${PLATFORM_URL}/organizer/reset-password?token=${rawToken}`;

  await resend.emails.send({
    from: "SB Events <tickets@squarebidness.com>",
    to: organizer.email,
    subject: "Reset your SB Events password",
    headers: { "List-Unsubscribe": "<mailto:unsubscribe@squarebidness.com>" },
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
