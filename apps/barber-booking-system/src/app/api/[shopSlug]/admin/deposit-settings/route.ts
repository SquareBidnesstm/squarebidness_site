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

  const { data: shop } = await supabaseServer.from("shops").select("id").eq("slug", shopSlug).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const { data } = await supabaseServer
    .from("shop_settings").select("value_json").eq("shop_id", shop.id).eq("key", "deposit_settings").single();

  return NextResponse.json({
    ok: true,
    settings: data?.value_json ?? { enabled: true, amount: 20, type: "fixed" },
  });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer.from("shops").select("id").eq("slug", shopSlug).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const body = await req.json();
  const { enabled, amount, type } = body;

  await supabaseServer.from("shop_settings").upsert(
    { shop_id: shop.id, key: "deposit_settings", value_json: { enabled: !!enabled, amount: Number(amount) || 0, type: type || "fixed" } },
    { onConflict: "shop_id,key" }
  );

  return NextResponse.json({ ok: true });
}
