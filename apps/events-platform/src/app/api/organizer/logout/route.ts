// =========================================================
// GET /api/organizer/logout
// Clears organizer session cookie and redirects to login
// =========================================================

import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export async function GET(req: Request) {
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();

  const res = NextResponse.redirect(new URL("/organizer/login", req.url));

  // Clear any org_session_* cookies
  for (const cookie of allCookies) {
    if (cookie.name.startsWith("org_session_")) {
      res.cookies.set(cookie.name, "", {
        httpOnly: true,
        secure: true,
        sameSite: "lax",
        path: "/",
        maxAge: 0,
      });
    }
  }

  return res;
}
