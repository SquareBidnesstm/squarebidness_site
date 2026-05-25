import { NextRequest, NextResponse } from "next/server";
import { computeSessionToken, sessionCookieName, computeBarberSessionToken, barberSessionCookieName, verifyPlatformSession, timingSafeEqual } from "./lib/auth";

const RESERVED_SLUGS = new Set(["admin", "book", "onboard", "login", "api", "_next", "platform", "favicon.ico"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Platform admin protection
  if (pathname.startsWith("/platform")) {
    if (pathname === "/platform/login") return NextResponse.next();
    if (!(await verifyPlatformSession(req))) return NextResponse.redirect(new URL("/platform/login", req.url));
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
    // Parse issuedAt from the "{issuedAt}.{hmac}" token format before recomputing
    const adminDotIdx = cookie.indexOf(".");
    if (adminDotIdx === -1) return NextResponse.redirect(new URL(`/${shopSlug}/admin/login`, req.url));
    const adminIssuedAt = Number(cookie.slice(0, adminDotIdx));
    if (!adminIssuedAt || Date.now() - adminIssuedAt > 30 * 24 * 60 * 60 * 1000) {
      return NextResponse.redirect(new URL(`/${shopSlug}/admin/login`, req.url));
    }
    const expected = await computeSessionToken(shopSlug, adminIssuedAt);
    if (!timingSafeEqual(cookie, expected)) return NextResponse.redirect(new URL(`/${shopSlug}/admin/login`, req.url));
    return NextResponse.next();
  }

  // Per-barber page protection: /:shopSlug/:barberSlug
  const barberMatch = pathname.match(/^\/([^/]+)\/([^/]+)(\/.*)?$/);
  if (barberMatch) {
    const shopSlug = barberMatch[1];
    const barberSlug = barberMatch[2];
    const rest = (barberMatch[3] ?? "").replace(/\/$/, "");

    if (RESERVED_SLUGS.has(shopSlug) || RESERVED_SLUGS.has(barberSlug)) return NextResponse.next();

    // Allow the login page through; all other paths (including root "") require auth
    if (rest === "/login") return NextResponse.next();

    const cookieName = barberSessionCookieName(shopSlug, barberSlug);
    const cookie = req.cookies.get(cookieName)?.value;
    if (!cookie) return NextResponse.redirect(new URL(`/${shopSlug}/${barberSlug}/login`, req.url));
    // Parse issuedAt from the "{issuedAt}.{hmac}" token format before recomputing
    const barberDotIdx = cookie.indexOf(".");
    if (barberDotIdx === -1) return NextResponse.redirect(new URL(`/${shopSlug}/${barberSlug}/login`, req.url));
    const barberIssuedAt = Number(cookie.slice(0, barberDotIdx));
    if (!barberIssuedAt || Date.now() - barberIssuedAt > 30 * 24 * 60 * 60 * 1000) {
      return NextResponse.redirect(new URL(`/${shopSlug}/${barberSlug}/login`, req.url));
    }
    const expected = await computeBarberSessionToken(shopSlug, barberSlug, barberIssuedAt);
    if (!timingSafeEqual(cookie, expected)) return NextResponse.redirect(new URL(`/${shopSlug}/${barberSlug}/login`, req.url));
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
