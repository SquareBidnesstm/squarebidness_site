import { NextRequest, NextResponse } from "next/server";
import { computeSessionToken, sessionCookieName, computeBarberSessionToken, barberSessionCookieName } from "./lib/auth";

async function verifyPlatformCookie(cookie: string): Promise<boolean> {
  const secret = process.env.APP_SECRET;
  if (!secret) return false; // misconfigured — deny all platform access rather than allow with empty key
  const dotIdx = cookie.indexOf(".");
  if (dotIdx === -1) return false; // old format — reject
  const issuedAt = cookie.slice(0, dotIdx);
  const mac = cookie.slice(dotIdx + 1);
  const issuedAtMs = Number(issuedAt);
  if (!issuedAtMs || Date.now() - issuedAtMs > 12 * 60 * 60 * 1000) return false; // 12h expiry
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`platform-admin:${issuedAt}`));
  const expected = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  return timingSafeEqual(mac, expected);
}

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a);
  const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}

const RESERVED_SLUGS = new Set(["admin", "book", "onboard", "login", "api", "_next", "platform", "favicon.ico"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Platform admin protection
  if (pathname.startsWith("/platform")) {
    if (pathname === "/platform/login") return NextResponse.next();
    const cookie = req.cookies.get("platform_session")?.value;
    if (!cookie) return NextResponse.redirect(new URL("/platform/login", req.url));
    if (!(await verifyPlatformCookie(cookie))) return NextResponse.redirect(new URL("/platform/login", req.url));
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
