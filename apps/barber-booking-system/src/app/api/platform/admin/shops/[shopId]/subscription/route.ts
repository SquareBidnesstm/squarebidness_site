import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../../../../lib/supabase/server";
import { verifyPlatformSession } from "../../../../../../../lib/auth";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ shopId: string }> }
) {
  const authed = await verifyPlatformSession(req);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { shopId } = await params;
  const body = await req.json();
  const { plan, status } = body as { plan?: string; status?: string };

  const validPlans = ["free", "solo", "pro", "enterprise"];
  const validStatuses = ["free", "trialing", "active"];

  if (!plan || !validPlans.includes(plan)) {
    return NextResponse.json({ ok: false, error: "Invalid plan." }, { status: 400 });
  }
  if (!status || !validStatuses.includes(status)) {
    return NextResponse.json({ ok: false, error: "Invalid status." }, { status: 400 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id")
    .eq("id", shopId)
    .single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found." }, { status: 404 });

  const { error } = await supabaseServer
    .from("subscriptions")
    .upsert(
      { shop_id: shopId, plan, status },
      { onConflict: "shop_id" }
    );

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, plan, status });
}
