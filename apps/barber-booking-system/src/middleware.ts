import { NextRequest, NextResponse } from "next/server";
import { computeSessionToken, sessionCookieName } from "./lib/auth";

async function computePlatformToken(): Promise<string> {
  const secret = process.env.APP_SECRET ?? "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("platform-admin"));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Platform admin protection
  if (pathname.startsWith("/platform")) {
    if (pathname === "/platform/login") return NextResponse.next();
    const cookie = req.cookies.get("platform_session")?.value;
    if (!cookie) return NextResponse.redirect(new URL("/platform/login", req.url));
    const expected = await computePlatformToken();
    if (cookie !== expected) return NextResponse.redirect(new URL("/platform/login", req.url));
    return NextResponse.next();
  }

  // Per-shop admin protection
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
  matcher: [
    "/platform/:path*",
    "/((?!_next|api|favicon\\.ico|onboard)[^/]+)/admin(.*)",
  ],
};
