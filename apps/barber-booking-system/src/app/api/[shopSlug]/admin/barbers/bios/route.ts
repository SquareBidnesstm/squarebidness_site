import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: barbers } = await supabaseServer
    .from("barbers").select("id").eq("shop_id", shop.id);

  const barberIds = (barbers ?? []).map((b) => b.id);
  if (barberIds.length === 0) return NextResponse.json({ ok: true, bios: {} });

  const bioKeys = barberIds.map((id) => `barber_bio_${id}`);
  const { data: settings } = await supabaseServer
    .from("shop_settings")
    .select("key, value_json")
    .eq("shop_id", shop.id)
    .in("key", bioKeys);

  const bios: Record<string, string> = {};
  for (const row of settings ?? []) {
    const barberId = row.key.replace("barber_bio_", "");
    const bio = (row.value_json as { bio?: string } | null)?.bio ?? "";
    if (bio) bios[barberId] = bio;
  }

  return NextResponse.json({ ok: true, bios });
}
