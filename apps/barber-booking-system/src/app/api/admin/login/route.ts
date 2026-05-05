import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "dapper_admin_session";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin || "").trim();

  const expectedPin = process.env.ADMIN_PIN || "";
  const sessionToken = process.env.ADMIN_SESSION_TOKEN || "";

  if (!expectedPin || !sessionToken) {
    return NextResponse.json(
      { ok: false, error: "Admin credentials not configured." },
      { status: 500 }
    );
  }

  if (pin !== expectedPin) {
    return NextResponse.json(
      { ok: false, error: "Incorrect PIN." },
      { status: 401 }
    );
  }

  const res = NextResponse.json({ ok: true });

  res.cookies.set(SESSION_COOKIE, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 12, // 12 hours
    path: "/",
  });

  return res;
}
