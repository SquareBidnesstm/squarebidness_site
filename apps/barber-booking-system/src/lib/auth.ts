export async function computeBarberSessionToken(shopSlug: string, barberSlug: string): Promise<string> {
  const secret = process.env.APP_SECRET ?? "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${shopSlug}:${barberSlug}`));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
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
  const expected = await computeBarberSessionToken(shopSlug, barberSlug);
  return value === expected;
}

export async function computeSessionToken(shopSlug: string): Promise<string> {
  const secret = process.env.APP_SECRET ?? "";
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(shopSlug));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export function sessionCookieName(shopSlug: string): string {
  return `session_${shopSlug}`;
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
  const expected = await computeSessionToken(shopSlug);
  return value === expected;
}
