import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  const { code, eventId, subtotal } = await req.json();
  if (!code || !eventId) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  const { data: promo } = await supabaseServer
    .from("promo_codes")
    .select("*")
    .eq("active", true)
    .ilike("code", code.trim())
    .or(`event_id.eq.${eventId},event_id.is.null`)
    .single();

  if (!promo) return NextResponse.json({ error: "Invalid promo code" }, { status: 404 });
  if (promo.expires_at && new Date(promo.expires_at) < new Date()) {
    return NextResponse.json({ error: "Promo code expired" }, { status: 400 });
  }
  if (promo.max_uses !== null && promo.uses >= promo.max_uses) {
    return NextResponse.json({ error: "Promo code has reached its limit" }, { status: 400 });
  }

  const discount = promo.discount_type === "percent"
    ? (subtotal * promo.discount_value) / 100
    : Math.min(promo.discount_value, subtotal);

  return NextResponse.json({
    ok: true,
    promoId: promo.id,
    discountType: promo.discount_type,
    discountValue: promo.discount_value,
    discountAmount: parseFloat(discount.toFixed(2)),
    newTotal: parseFloat((subtotal - discount).toFixed(2)),
  });
}
