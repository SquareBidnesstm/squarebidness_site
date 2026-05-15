import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id, logo_url").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: typeSetting } = await supabaseServer
    .from("shop_settings").select("value_json")
    .eq("shop_id", shop.id).eq("key", "shop_type").single();

  const shopType = (typeSetting?.value_json as { type?: string } | null)?.type ?? "barbershop";

  return NextResponse.json({
    ok: true,
    shop_id: shop.id,
    logo_url: shop.logo_url ?? null,
    shop_type: shopType,
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const body = await req.json();

  if (body.shop_type !== undefined) {
    const allowed = ["barbershop", "beauty_salon", "nail_salon", "spa", "lash_studio", "other"];
    if (!allowed.includes(body.shop_type)) {
      return NextResponse.json({ ok: false, error: "Invalid shop type" }, { status: 400 });
    }
    await supabaseServer.from("shop_settings").upsert(
      { shop_id: shop.id, key: "shop_type", value_json: { type: body.shop_type } },
      { onConflict: "shop_id,key" }
    );
  }

  return NextResponse.json({ ok: true });
}
