import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../../lib/auth";

type Perms = {
  can_edit_hours: boolean;
  can_edit_prices: boolean;
};

async function getShopAndBarber(shopSlug: string, barberId: string) {
  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("slug", shopSlug)
    .single();
  if (!shop) return { shop: null, barber: null };

  const { data: barber } = await supabaseServer
    .from("barbers")
    .select("id")
    .eq("id", barberId)
    .eq("shop_id", shop.id)
    .single();

  return { shop, barber };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberId: string }> }
) {
  const { shopSlug, barberId } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { shop, barber } = await getShopAndBarber(shopSlug, barberId);
  if (!shop || !barber) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const { data: setting } = await supabaseServer
    .from("shop_settings")
    .select("value_json")
    .eq("shop_id", shop.id)
    .eq("key", `barber_perms_${barberId}`)
    .single();

  const perms: Perms = {
    can_edit_hours: (setting?.value_json as Perms | null)?.can_edit_hours ?? false,
    can_edit_prices: (setting?.value_json as Perms | null)?.can_edit_prices ?? false,
  };

  return NextResponse.json({ ok: true, perms });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberId: string }> }
) {
  const { shopSlug, barberId } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { shop, barber } = await getShopAndBarber(shopSlug, barberId);
  if (!shop || !barber) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const perms: Perms = {
    can_edit_hours: Boolean(body.can_edit_hours),
    can_edit_prices: Boolean(body.can_edit_prices),
  };

  const { error } = await supabaseServer
    .from("shop_settings")
    .upsert(
      { shop_id: shop.id, key: `barber_perms_${barberId}`, value_json: perms },
      { onConflict: "shop_id,key" }
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, perms });
}
