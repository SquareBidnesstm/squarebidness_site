// =========================================================
// POST /api/admin/login
// Single-password admin login for Marcus
// =========================================================

import { NextResponse } from "next/server";
import { computeAdminSessionToken } from "../../../../lib/auth";
import { checkRateLimit, recordAttempt, clearAttempts, isSafeOrigin } from "../../../../lib/utils";

export async function POST(req: Request) {
  try {
    // CSRF origin check
    if (!isSafeOrigin(req)) {
      return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url));
    }

    // Rate limit: 10 attempts per 15 min per IP
    const ip =
      (req as any).headers?.get?.("x-forwarded-for")?.split(",")[0]?.trim() ??
      (req as any).headers?.get?.("x-real-ip") ??
      "unknown";
    const rlKey = `admin_login:${ip}`;
    recordAttempt(rlKey);
    const { limited, retryAfterSeconds } = checkRateLimit(rlKey, 10);
    if (limited) {
      return NextResponse.redirect(
        new URL(`/admin/login?error=too_many_attempts&retry=${Math.ceil(retryAfterSeconds / 60)}`, req.url)
      );
    }

    const formData = await req.formData();
    const password = (formData.get("password") as string) ?? "";

    if (!password) {
      return NextResponse.redirect(new URL("/admin/login?error=missing", req.url));
    }

    const adminPassword = process.env.ADMIN_PASSWORD ?? "";
    if (!adminPassword) {
      console.error("ADMIN_PASSWORD env var not set");
      return NextResponse.redirect(new URL("/admin/login?error=server_error", req.url));
    }

    // Constant-time comparison to prevent timing attacks
    const encoder = new TextEncoder();
    const a = encoder.encode(password);
    const b = encoder.encode(adminPassword);

    // Pad shorter buffer so length leak doesn't reveal password length
    const maxLen = Math.max(a.length, b.length);
    const aPadded = new Uint8Array(maxLen);
    const bPadded = new Uint8Array(maxLen);
    aPadded.set(a);
    bPadded.set(b);

    let diff = a.length !== b.length ? 1 : 0;
    for (let i = 0; i < maxLen; i++) {
      diff |= aPadded[i] ^ bPadded[i];
    }

    if (diff !== 0) {
      return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url));
    }

    // Successful login — clear rate limit counter
    clearAttempts(rlKey);

    const token = await computeAdminSessionToken();
    const res = NextResponse.redirect(new URL("/admin", req.url));
    res.cookies.set("sbe_admin_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return res;
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.redirect(new URL("/admin/login?error=server_error", req.url));
  }
}
