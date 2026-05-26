import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, recordFailedAttempt, clearFailedAttempts } from "../../../../../lib/utils";
import { hmacHex, timingSafeEqual } from "../../../../../lib/auth";

function requireAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET environment variable is not set. Cannot issue platform session tokens.");
  return secret;
}

export async function POST(req: NextRequest) {
  // Rate limiting — 20 attempts per 15 min per IP. Keep this high enough that
  // owner diagnostics do not lock out the whole platform admin.
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rlKey = `platform_admin:${ip}`;
  const { limited, retryAfterSeconds } = await checkRateLimit(rlKey, 20);
  if (limited) {
    return NextResponse.json(
      { ok: false, error: `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { pin } = await req.json().catch(() => ({}));
  const cleanPin = String(pin ?? "").trim();
  const platformPin = process.env.PLATFORM_PIN?.trim();

  if (!platformPin) {
    return NextResponse.json({ ok: false, error: "Platform admin not configured." }, { status: 503 });
  }

  if (!cleanPin || cleanPin.length > 64 || !timingSafeEqual(cleanPin, platformPin)) {
    recordFailedAttempt(rlKey);
    return NextResponse.json({ ok: false, error: "Invalid PIN." }, { status: 401 });
  }

  clearFailedAttempts(rlKey);

  // Timestamped token: HMAC of "platform-admin:{issuedAt}" — rotates every login,
  // expires after 12 hours (verified in verifyPlatformSession in shops/route.ts).
  const secret = requireAppSecret();
  const issuedAt = Date.now().toString();
  const mac = await hmacHex(secret, `platform-admin:${issuedAt}`);
  const token = `${issuedAt}.${mac}`;

  const res = NextResponse.json({ ok: true });
  res.cookies.set("platform_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return res;
}
