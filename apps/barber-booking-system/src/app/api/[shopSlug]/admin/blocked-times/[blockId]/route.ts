import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../lib/auth";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; blockId: string }> }
) {
  const { shopSlug, blockId } = await params;
  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer.from("shops").select("id").eq("slug", shopSlug).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const { error } = await supabaseServer
    .from("blocked_times").delete().eq("id", blockId).eq("shop_id", shop.id);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
