import { NextRequest, NextResponse } from "next/server";
import { computeSessionToken, sessionCookieName, computeBarberSessionToken, barberSessionCookieName } from "./lib/auth";

async function computePlatformToken(): Promise<string> {
  const secret = process.env.APP_SECRET ?? "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("platform-admin"));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

const RESERVED_SLUGS = new Set(["admin", "book", "onboard", "login", "api", "_next", "platform", "favicon.ico"]);

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
  const adminMatch = pathname.match(/^\/([^/]+)\/admin(\/.*)?$/);
  if (adminMatch) {
    const shopSlug = adminMatch[1];
    const rest = (adminMatch[2] ?? "").replace(/\/$/, "");
    if (rest === "/login") return NextResponse.next();
    const cookieName = sessionCookieName(shopSlug);
    const cookie = req.cookies.get(cookieName)?.value;
    if (!cookie) return NextResponse.redirect(new URL(`/${shopSlug}/admin/login`, req.url));
    const expected = await computeSessionToken(shopSlug);
    if (cookie !== expected) return NextResponse.redirect(new URL(`/${shopSlug}/admin/login`, req.url));
    return NextResponse.next();
  }

  // Per-barber page protection: /:shopSlug/:barberSlug
  const barberMatch = pathname.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (barberMatch) {
    const shopSlug = barberMatch[1];
    const barberSlug = barberMatch[2];
    const rest = (barberMatch[3] ?? "").replace(/\/$/, "");

    if (RESERVED_SLUGS.has(shopSlug) || RESERVED_SLUGS.has(barberSlug)) return NextResponse.next();

    if (rest === "/login" || rest === "") {
      // Allow login page through, but protect root barber page
      if (rest === "/login") return NextResponse.next();
    }

    const cookieName = barberSessionCookieName(shopSlug, barberSlug);
    const cookie = req.cookies.get(cookieName)?.value;
    if (!cookie) return NextResponse.redirect(new URL(`/${shopSlug}/${barberSlug}/login`, req.url));
    const expected = await computeBarberSessionToken(shopSlug, barberSlug);
    if (cookie !== expected) return NextResponse.redirect(new URL(`/${shopSlug}/${barberSlug}/login`, req.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/platform/:path*",
    "/((?!_next|api|favicon\\.ico|onboard)[^/]+)/admin(.*)",
    "/((?!_next|api|favicon\\.ico|onboard|platform)[^/]+)/((?!book|onboard|login|admin)[^/]+)(.*)",
  ],
};
