// =========================================================
// POST /api/admin/login
// Single-password admin login for Marcus
// =========================================================

import { NextResponse } from "next/server";
import { computeAdminSessionToken } from "../../../../lib/auth";
import { checkRateLimit, recordAttempt, isSafeOrigin } from "../../../../lib/utils";

function timingSafeStringEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aB = enc.encode(a);
  const bB = enc.encode(b);
  if (aB.length !== bB.length) return false;
  let diff = 0;
  for (let i = 0; i < aB.length; i++) diff |= aB[i] ^ bB[i];
  return diff === 0;
}

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
    const { limited, retryAfterSeconds } = await checkRateLimit(rlKey, 10);
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
    if (!timingSafeStringEqual(password, adminPassword)) {
      return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url));
    }

    // Successful login — do NOT clear rate limit counter; let the window expire
    // naturally so attackers cannot use deliberate successes to reset the counter.

    const token = await computeAdminSessionToken();
    const res = NextResponse.redirect(new URL("/admin", req.url));
    res.cookies.set("sbe_admin_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 30, // 30 days — matches HMAC token expiry window
    });

    return res;
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.redirect(new URL("/admin/login?error=server_error", req.url));
  }
}
