// =========================================================
// AUTH — Square Bidness Events Platform
// HMAC-SHA256 session tokens with embedded timestamps.
// Format: "{issuedAt}.{hmacHex}"  (issuedAt = ms since epoch)
// Tokens expire after MAX_TOKEN_AGE_MS (30 days).
// Old format (no ".") is rejected → forces one-time re-login.
// =========================================================

const MAX_TOKEN_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// ── Organizer session ────────────────────────────────────

export async function computeOrganizerSessionToken(organizerSlug: string): Promise<string> {
  const secret = process.env.APP_SECRET ?? "";
  const issuedAt = Date.now().toString();
  const mac = await hmacHex(secret, `organizer:${organizerSlug}:${issuedAt}`);
  return `${issuedAt}.${mac}`;
}

export function organizerSessionCookieName(organizerSlug: string): string {
  return `org_session_${organizerSlug}`;
}

export async function verifyOrganizerSession(
  req: Request,
  organizerSlug: string
): Promise<boolean> {
  const secret = process.env.APP_SECRET ?? "";
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieName = organizerSessionCookieName(organizerSlug);
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`));
  if (!match) return false;
  const value = match.slice(cookieName.length + 1);

  // Reject legacy format (no ".")
  const dotIdx = value.indexOf(".");
  if (dotIdx === -1) return false;

  const issuedAt = value.slice(0, dotIdx);
  const mac = value.slice(dotIdx + 1);
  const issuedAtMs = Number(issuedAt);
  if (!issuedAtMs || Date.now() - issuedAtMs > MAX_TOKEN_AGE_MS) return false;

  const expected = await hmacHex(secret, `organizer:${organizerSlug}:${issuedAt}`);
  return mac === expected;
}

/**
 * Reads the org_session_* cookie from the request, verifies the HMAC + timestamp,
 * and returns the organizerSlug on success, or null on failure.
 * Use this in organizer-protected API routes instead of manual token comparison.
 */
export async function getVerifiedOrganizerSlug(req: Request): Promise<string | null> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const sessionEntry = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("org_session_"));
  if (!sessionEntry) return null;

  const eqIdx = sessionEntry.indexOf("=");
  if (eqIdx === -1) return null;
  const cookieName = sessionEntry.slice(0, eqIdx);
  const organizerSlug = cookieName.replace("org_session_", "");
  if (!organizerSlug) return null;

  const verified = await verifyOrganizerSession(req, organizerSlug);
  return verified ? organizerSlug : null;
}

// ── Admin (Marcus) session ───────────────────────────────

export async function computeAdminSessionToken(): Promise<string> {
  const secret = process.env.APP_SECRET ?? "";
  const issuedAt = Date.now().toString();
  const mac = await hmacHex(secret, `sbe:admin:${issuedAt}`);
  return `${issuedAt}.${mac}`;
}

export async function verifyAdminSession(req: Request): Promise<boolean> {
  const secret = process.env.APP_SECRET ?? "";
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("sbe_admin_session="));
  if (!match) return false;
  const value = match.slice("sbe_admin_session=".length);

  // Reject legacy format (no ".")
  const dotIdx = value.indexOf(".");
  if (dotIdx === -1) return false;

  const issuedAt = value.slice(0, dotIdx);
  const mac = value.slice(dotIdx + 1);
  const issuedAtMs = Number(issuedAt);
  if (!issuedAtMs || Date.now() - issuedAtMs > MAX_TOKEN_AGE_MS) return false;

  const expected = await hmacHex(secret, `sbe:admin:${issuedAt}`);
  return mac === expected;
}
