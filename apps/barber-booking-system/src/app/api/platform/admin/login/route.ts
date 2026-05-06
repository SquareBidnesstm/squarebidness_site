import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const { pin } = await req.json();
  const platformPin = process.env.PLATFORM_PIN;

  if (!platformPin) {
    return NextResponse.json({ ok: false, error: "Platform admin not configured." }, { status: 503 });
  }

  if (!pin || pin !== platformPin) {
    return NextResponse.json({ ok: false, error: "Invalid PIN." }, { status: 401 });
  }

  // Simple session token: HMAC of "platform" using APP_SECRET
  const secret = process.env.APP_SECRET ?? "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("platform-admin"));
  const token = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");

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
