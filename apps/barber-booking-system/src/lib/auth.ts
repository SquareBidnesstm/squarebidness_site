// Max server-side token age: 30 days (safety net — cookie maxAge is the primary expiry)
const MAX_TOKEN_AGE_MS = 30 * 24 * 60 * 60 * 1000;

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function requireAppSecret(): string {
  const secret = process.env.APP_SECRET;
  if (!secret) throw new Error("APP_SECRET environment variable is not set. Cannot issue or verify session tokens.");
  return secret;
}

// Token format: "{issuedAt}.{hmac}" — issuedAt is Unix ms timestamp
export async function computeBarberSessionToken(
  shopSlug: string,
  barberSlug: string,
  issuedAt = Date.now()
): Promise<string> {
  const secret = requireAppSecret();
  const hash = await hmacHex(secret, `barber:${shopSlug}:${barberSlug}:${issuedAt}`);
  return `${issuedAt}.${hash}`;
}

export function barberSessionCookieName(shopSlug: string, barberSlug: string): string {
  return `barber_${shopSlug}_${barberSlug}`;
}

export async function verifyBarberSession(
  req: Request,
  shopSlug: string,
  barberSlug: string
): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieName = barberSessionCookieName(shopSlug, barberSlug);
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`));
  if (!match) return false;
  const value = match.slice(cookieName.length + 1);

  const dotIdx = value.indexOf(".");
  if (dotIdx === -1) return false; // old format — reject, force re-login
  const issuedAt = Number(value.slice(0, dotIdx));
  if (isNaN(issuedAt) || Date.now() - issuedAt > MAX_TOKEN_AGE_MS) return false;

  const expected = await computeBarberSessionToken(shopSlug, barberSlug, issuedAt);
  return value === expected;
}

// Token format: "{issuedAt}.{hmac}" — issuedAt is Unix ms timestamp
export async function computeSessionToken(shopSlug: string, issuedAt = Date.now()): Promise<string> {
  const secret = requireAppSecret();
  const hash = await hmacHex(secret, `admin:${shopSlug}:${issuedAt}`);
  return `${issuedAt}.${hash}`;
}

export function sessionCookieName(shopSlug: string): string {
  return `session_${shopSlug}`;
}

import { supabaseServer } from "./supabase/server";

export async function checkActiveSubscription(shopId: string): Promise<boolean> {
  const { data } = await supabaseServer
    .from("subscriptions")
    .select("status, plan")
    .eq("shop_id", shopId)
    .maybeSingle(); // .single() throws PGRST116 if no row; .maybeSingle() returns null safely
  if (!data) return false;
  return data.status === "active" && data.plan !== "free";
}

export async function verifyAdminSession(
  req: Request,
  shopSlug: string
): Promise<boolean> {
  const cookieHeader = req.headers.get("cookie") ?? "";
  const cookieName = sessionCookieName(shopSlug);
  const match = cookieHeader
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${cookieName}=`));

  if (!match) return false;

  const value = match.slice(cookieName.length + 1);

  const dotIdx = value.indexOf(".");
  if (dotIdx === -1) return false; // old format — reject, force re-login
  const issuedAt = Number(value.slice(0, dotIdx));
  if (isNaN(issuedAt) || Date.now() - issuedAt > MAX_TOKEN_AGE_MS) return false;

  const expected = await computeSessionToken(shopSlug, issuedAt);
  return value === expected;
}
