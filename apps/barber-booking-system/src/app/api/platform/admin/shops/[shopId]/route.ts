import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";

const MAX_PLATFORM_SESSION_MS = 12 * 60 * 60 * 1000;

async function hmacHex(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const aBytes = enc.encode(a); const bBytes = enc.encode(b);
  if (aBytes.length !== bBytes.length) return false;
  let diff = 0;
  for (let i = 0; i < aBytes.length; i++) diff |= aBytes[i] ^ bBytes[i];
  return diff === 0;
}
async function verifyPlatformSession(req: NextRequest): Promise<boolean> {
  const cookie = req.cookies.get("platform_session")?.value;
  if (!cookie) return false;
  const dotIdx = cookie.indexOf(".");
  if (dotIdx === -1) return false;
  const issuedAt = cookie.slice(0, dotIdx);
  const mac = cookie.slice(dotIdx + 1);
  const issuedAtMs = Number(issuedAt);
  if (!issuedAtMs || Date.now() - issuedAtMs > MAX_PLATFORM_SESSION_MS) return false;
  const secret = process.env.APP_SECRET;
  if (!secret) return false;
  const expected = await hmacHex(secret, `platform-admin:${issuedAt}`);
  return timingSafeEqual(mac, expected);
}

// PATCH — toggle active status
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const authed = await verifyPlatformSession(req);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { shopId } = await params;
  const { active } = await req.json();

  const { data, error } = await supabaseServer
    .from("shops")
    .update({ active: Boolean(active) })
    .eq("id", shopId)
    .select("id, name, active")
    .single();

  if (error || !data) return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 404 });
  return NextResponse.json({ ok: true, shop: data });
}

// DELETE — permanently remove a shop and all its data
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const authed = await verifyPlatformSession(req);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { shopId } = await params;

  // Verify shop exists first
  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name")
    .eq("id", shopId)
    .single();

  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 404 });

  // Delete in dependency order
  await supabaseServer.from("bookings").delete().eq("shop_id", shopId);
  await supabaseServer.from("barbers").delete().eq("shop_id", shopId);
  await supabaseServer.from("services").delete().eq("shop_id", shopId);
  await supabaseServer.from("shop_settings").delete().eq("shop_id", shopId);
  await supabaseServer.from("subscriptions").delete().eq("shop_id", shopId);
  await supabaseServer.from("shops").delete().eq("id", shopId);

  return NextResponse.json({ ok: true, deleted: shop.name });
}
