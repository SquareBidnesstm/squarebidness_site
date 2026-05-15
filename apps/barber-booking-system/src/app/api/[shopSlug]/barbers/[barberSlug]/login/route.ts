import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { computeBarberSessionToken, barberSessionCookieName } from "../../../../../../lib/auth";
import { verifyPin, hashPin, checkRateLimit, recordFailedAttempt, clearFailedAttempts } from "../../../../../../lib/utils";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberSlug: string }> }
) {
  const { shopSlug, barberSlug } = await params;
  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin || "").trim();

  if (!pin || !/^\d{4}$/.test(pin)) {
    return NextResponse.json({ ok: false, error: "PIN must be exactly 4 digits." }, { status: 400 });
  }

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  const rlKey = `barber:${shopSlug}:${barberSlug}:${ip}`;
  const { limited, retryAfterSeconds } = checkRateLimit(rlKey);
  if (limited) {
    return NextResponse.json(
      { ok: false, error: `Too many attempts. Try again in ${retryAfterSeconds}s.` },
      { status: 429 }
    );
  }

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 404 });

  const { data: barber } = await supabaseServer
    .from("barbers").select("id, name, display_name")
    .eq("shop_id", shop.id).eq("slug", barberSlug).eq("active", true).single();
  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found." }, { status: 404 });

  const { data: setting } = await supabaseServer
    .from("shop_settings").select("value_json")
    .eq("shop_id", shop.id).eq("key", `barber_auth_${barber.id}`).single();

  const stored = (setting?.value_json as { pin?: string; pin_hash?: string; pin_salt?: string } | null) ?? {};
  const { valid, needsRehash } = await verifyPin(pin, stored);

  if (!valid) {
    recordFailedAttempt(rlKey);
    return NextResponse.json({ ok: false, error: "Incorrect PIN." }, { status: 401 });
  }

  clearFailedAttempts(rlKey);

  // Migrate plaintext to hashed on successful login
  if (needsRehash) {
    const { hash, salt } = await hashPin(pin);
    await supabaseServer.from("shop_settings").upsert(
      { shop_id: shop.id, key: `barber_auth_${barber.id}`, value_json: { pin_hash: hash, pin_salt: salt } },
      { onConflict: "shop_id,key" }
    );
  }

  const sessionToken = await computeBarberSessionToken(shopSlug, barberSlug);
  const cookieName = barberSessionCookieName(shopSlug, barberSlug);

  const res = NextResponse.json({ ok: true });
  res.cookies.set(cookieName, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24 * 7, // 7 days
    path: "/",
  });
  return res;
}
