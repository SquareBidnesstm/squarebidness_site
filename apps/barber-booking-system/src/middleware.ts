import { NextRequest, NextResponse } from "next/server";

const SESSION_COOKIE = "dapper_admin_session";

export function middleware(req: NextRequest) {
  // Let the login page through so we don't redirect loop
  if (req.nextUrl.pathname === "/admin/login") {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  const expected = process.env.ADMIN_SESSION_TOKEN;

  if (!expected || cookie !== expected) {
    const loginUrl = new URL("/admin/login", req.url);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: "/admin/:path*",
};
