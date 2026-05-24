import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";
import { checkRateLimit, isSafeOrigin, recordAttempt } from "../../../../lib/utils";

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest) {
  if (!isSafeOrigin(req)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 20 promo lookups per 15 min per IP (prevents enumeration)
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`promo:${ip}`);
  const { limited, retryAfterSeconds } = await checkRateLimit(`promo:${ip}`, 20);
  if (limited) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const { code, eventId, subtotal } = await req.json();
  if (!code || !eventId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  const cleanCode = String(code).trim().toUpperCase();
  const cleanEventId = String(eventId).trim();
  const numericSubtotal = Number(subtotal);

  if (!/^[A-Z0-9_-]{2,40}$/.test(cleanCode)) {
    return NextResponse.json({ error: "Invalid promo code" }, { status: 400 });
  }
  if (!uuidRegex.test(cleanEventId)) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }
  if (!Number.isFinite(numericSubtotal) || numericSubtotal < 0 || numericSubtotal > 100000) {
    return NextResponse.json({ error: "Invalid subtotal" }, { status: 400 });
  }

  const { data: promo } = await supabaseServer
    .from("promo_codes")
    .select("*")
    .eq("active", true)
    .ilike("code", cleanCode)
    .or(`event_id.eq.${cleanEventId},event_id.is.null`)
    .single();

  if (!promo) return NextResponse.json({ error: "Invalid promo code" }, { status: 404 });
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return NextResponse.json({ error: "Promo code expired" }, { status: 400 });
  }
  if (promo.max_uses !== null && promo.uses >= promo.max_uses) {
    return NextResponse.json({ error: "Promo code has reached its limit" }, { status: 400 });
  }

  const discount = promo.discount_type === "percent"
    ? (numericSubtotal * promo.discount_value) / 100
    : Math.min(promo.discount_value, numericSubtotal);

  return NextResponse.json({
    ok: true,
    promoId: promo.id,
    discountType: promo.discount_type,
    discountValue: promo.discount_value,
    discountAmount: parseFloat(discount.toFixed(2)),
    newTotal: parseFloat((numericSubtotal - discount).toFixed(2)),
  });
}
