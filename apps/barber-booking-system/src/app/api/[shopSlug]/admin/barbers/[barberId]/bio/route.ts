import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../../lib/auth";

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; barberId: string }> }
) {
  const { shopSlug, barberId } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: barber } = await supabaseServer
    .from("barbers").select("id").eq("shop_id", shop.id).eq("id", barberId).eq("active", true).single();
  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const bio = typeof body.bio === "string" ? body.bio.slice(0, 500) : "";

  const { error } = await supabaseServer
    .from("shop_settings")
    .upsert(
      { shop_id: shop.id, key: `barber_bio_${barber.id}`, value_json: { bio } },
      { onConflict: "shop_id,key" }
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
