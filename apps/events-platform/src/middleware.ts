// =========================================================
// Middleware — Square Bidness Events Platform
// Defense-in-depth auth gate for organizer and admin routes.
//
// Auth verification strategy:
//   - Organizer routes: check org_session_<slug> cookie structure + age.
//     HMAC is NOT re-verified here (that's done inside each route handler).
//     This gate catches unauthenticated requests early without the crypto cost.
//   - Admin routes: check sbe_admin_session cookie structure + age.
//   - Public routes: pass through unconditionally.
// =========================================================

import { NextRequest, NextResponse } from "next/server";

const MAX_TOKEN_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days — must match auth.ts

/**
 * Quick structural + age check for a session token in the format "{issuedAt}.{hmacHex}".
 * Returns true only if the token is well-formed and within the allowed age window.
 * Full HMAC verification is left to the route handler — this is a lightweight gate.
 */
function isTokenStructurallyValid(value: string): boolean {
  const dotIdx = value.indexOf(".");
  if (dotIdx === -1) return false;
  const issuedAtMs = Number(value.slice(0, dotIdx));
  if (!issuedAtMs || isNaN(issuedAtMs)) return false;
  return Date.now() - issuedAtMs <= MAX_TOKEN_AGE_MS;
}

/**
 * Extract and validate the organizer session cookie (org_session_<slug>).
 */
function hasValidOrganizerSessionCookie(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("org_session_"));
  if (!sessionCookie) return false;
  const eqIdx = sessionCookie.indexOf("=");
  if (eqIdx === -1) return false;
  const cookieName = sessionCookie.slice(0, eqIdx);
  const slug = cookieName.replace("org_session_", "");
  if (!slug) return false;
  const value = sessionCookie.slice(eqIdx + 1);
  return isTokenStructurallyValid(value);
}

/**
 * Extract and validate the admin session cookie (sbe_admin_session).
 */
function hasValidAdminSessionCookie(req: NextRequest): boolean {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookies = cookieHeader.split(";").map((c) => c.trim());
  const sessionCookie = cookies.find((c) => c.startsWith("sbe_admin_session="));
  if (!sessionCookie) return false;
  const value = sessionCookie.slice("sbe_admin_session=".length);
  return isTokenStructurallyValid(value);
}

// Public paths that must pass through without auth checks.
// Matching is prefix-based.
const PUBLIC_API_PREFIXES = [
  "/api/checkout",
  "/api/rsvp",
  "/api/tickets",
  "/api/webhooks",
  "/api/promo",
  "/api/orders",
  "/api/notifications",
  "/api/organizer/signup",
  "/api/organizer/login",
  "/api/organizer/forgot-password",
  "/api/organizer/reset-password",
  "/api/organizer/verify-email",
  "/api/admin/login",
];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // ── /organizer/dashboard/** → redirect to login if no valid session ─────────
  if (pathname.startsWith("/organizer/dashboard")) {
    if (!hasValidOrganizerSessionCookie(req)) {
      const loginUrl = req.nextUrl.clone();
      loginUrl.pathname = "/organizer/login";
      loginUrl.search = "";
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── /api/organizer/** → 401 if no valid session (skip public paths) ─────────
  if (pathname.startsWith("/api/organizer/")) {
    const isPublic = PUBLIC_API_PREFIXES.some((prefix) => pathname.startsWith(prefix));
    if (!isPublic) {
      if (!hasValidOrganizerSessionCookie(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  // ── /api/admin/** → 401 if no valid admin session (skip login) ──────────────
  if (pathname.startsWith("/api/admin/")) {
    if (!pathname.startsWith("/api/admin/login")) {
      if (!hasValidAdminSessionCookie(req)) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/organizer/dashboard/:path*",
    "/api/organizer/:path*",
    "/api/admin/:path*",
  ],
};
