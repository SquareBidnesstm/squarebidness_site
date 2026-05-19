import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberId: string }> }
) {
  const { shopSlug, barberId } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .single();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  const body = await req.json();
  const updates: Record<string, string | boolean> = {};

  if (body.name !== undefined) updates.name = body.name;
  if (body.display_name !== undefined) updates.display_name = body.display_name;
  if (body.role !== undefined) updates.role = body.role;
  if (body.active !== undefined) updates.active = body.active;
  if (body.phone !== undefined) updates.phone = body.phone;
  if (body.special_sessions_enabled !== undefined) updates.special_sessions_enabled = body.special_sessions_enabled;
  if (body.special_sessions_price_cents !== undefined) updates.special_sessions_price_cents = body.special_sessions_price_cents;

  const { data: barber, error } = await supabaseServer
    .from("barbers")
    .update(updates)
    .eq("id", barberId)
    .eq("shop_id", shop.id)
    .select("id, slug, name, display_name, role, phone, special_sessions_enabled, special_sessions_price_cents, active, sort_order")
    .single();

  if (error || !barber) {
    return NextResponse.json({ ok: false, error: error?.message || "Update failed." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, barber });
}
