import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../../lib/auth";

export async function POST(
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
    return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 404 });
  }

  // Confirm the barber belongs to this shop
  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id")
    .eq("id", barberId)
    .eq("shop_id", shop.id)
    .single();

  if (!barber) {
    return NextResponse.json({ ok: false, error: "Barber not found." }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const pin = String(body.pin || "").trim();

  if (!pin || pin.length < 4 || pin.length > 12 || !/^\d+$/.test(pin)) {
    return NextResponse.json(
      { ok: false, error: "PIN must be 4–12 digits." },
      { status: 400 }
    );
  }

  const key = `barber_auth_${barberId}`;

  const { error } = await supabaseServer
    .from("shop_settings")
    .upsert(
      { shop_id: shop.id, key, value_json: { pin } },
      { onConflict: "shop_id,key" }
    );

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(
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
    return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 404 });
  }

  const key = `barber_auth_${barberId}`;

  await supabaseServer
    .from("shop_settings")
    .delete()
    .eq("shop_id", shop.id)
    .eq("key", key);

  return NextResponse.json({ ok: true });
}
