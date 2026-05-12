// =========================================================
// POST /api/admin/login
// Single-password admin login for Marcus
// =========================================================

import { NextResponse } from "next/server";
import { computeAdminSessionToken } from "../../../../lib/auth";

export async function POST(req: Request) {
  try {
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

    if (a.length !== b.length) {
      return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url));
    }

    let diff = 0;
    for (let i = 0; i < a.length; i++) {
      diff |= a[i] ^ b[i];
    }

    if (diff !== 0) {
      return NextResponse.redirect(new URL("/admin/login?error=invalid", req.url));
    }

    const token = await computeAdminSessionToken();
    const res = NextResponse.redirect(new URL("/admin", req.url));
    res.cookies.set("sbe_admin_session", token, {
      httpOnly: true,
      secure: true,
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 12, // 12 hours
    });

    return res;
  } catch (err) {
    console.error("Admin login error:", err);
    return NextResponse.redirect(new URL("/admin/login?error=server_error", req.url));
  }
}
