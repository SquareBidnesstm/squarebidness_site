// =========================================================
// AUTH — Square Bidness Events Platform
// HMAC-based session tokens for organizer admin
// =========================================================

export async function computeOrganizerSessionToken(organizerSlug: string): Promise<string> {
  const secret = process.env.APP_SECRET ?? "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`organizer:${organizerSlug}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function organizerSessionCookieName(organizerSlug: string): string {
  return `org_session_${organizerSlug}`;
}

export async function verifyOrganizerSession(
  req: Request,
  organizerSlug: string
): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieName = organizerSessionCookieName(organizerSlug);
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`));
  if (!match) return false;
  const value = match.slice(cookieName.length + 1);
  const expected = await computeOrganizerSessionToken(organizerSlug);
  return value === expected;
}

// Admin (Marcus) session
export async function computeAdminSessionToken(): Promise<string> {
  const secret = process.env.APP_SECRET ?? "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("sbe:admin"));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyAdminSession(req: Request): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith("sbe_admin_session="));
  if (!match) return false;
  const value = match.slice("sbe_admin_session=".length);
  const expected = await computeAdminSessionToken();
  return value === expected;
}
