import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyPlatformSession } from "../../../../../../lib/auth";

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
