import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, recordFailedAttempt, clearFailedAttempts } from "../../../../../lib/utils";

function requireAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET environment variable is not set. Cannot issue platform session tokens.");
  return secret;
}

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function POST(req: NextRequest) {
  // Rate limiting — 5 attempts per 15 min per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rlKey = `platform_admin:${ip}`;
  const { limited, retryAfterSeconds } = await checkRateLimit(rlKey, 5);
  if (limited) {
    return NextResponse.json(
      { ok: false, error: `Too many attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { pin } = await req.json().catch(() => ({}));
  const platformPin = process.env.PLATFORM_PIN;

  if (!platformPin) {
    return NextResponse.json({ ok: false, error: "Platform admin not configured." }, { status: 503 });
  }

  if (!pin || pin !== platformPin) {
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
    secure: true,
    sameSite: "lax",
    path: "/platform",
    maxAge: 60 * 60 * 12, // 12 hours
  });
  return res;
}
