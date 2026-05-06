import { NextRequest, NextResponse } from "next/server";
import { computeSessionToken, sessionCookieName } from "./lib/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const match = pathname.match(/^\/([^/]+)\/admin(\/.*)?$/);
  if (!match) return NextResponse.next();

  const shopSlug = match[1];
  const rest = (match[2] ?? "").replace(/\/$/, "");

  if (rest === "/login") return NextResponse.next();

  const cookieName = sessionCookieName(shopSlug);
  const cookie = req.cookies.get(cookieName)?.value;

  if (!cookie) {
    return NextResponse.redirect(new URL(`/${shopSlug}/admin/login`, req.url));
  }

  const expected = await computeSessionToken(shopSlug);
  if (cookie !== expected) {
    return NextResponse.redirect(new URL(`/${shopSlug}/admin/login`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|api|favicon\\.ico|onboard)[^/]+)/admin(.*)"],
};
