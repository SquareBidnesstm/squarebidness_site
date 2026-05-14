import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../../lib/supabase/server";

export async function POST(req: NextRequest) {
  const { subscription, orderId } = await req.json();
  if (!subscription?.endpoint || !orderId) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  // Verify order exists
  const { data: order } = await supabaseServer
    .from("orders")
    .select("id, event_id")
    .eq("id", orderId)
    .eq("status", "paid")
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // Upsert subscription — endpoint is the unique key
  await supabaseServer
    .from("push_subscriptions")
    .upsert({
      order_id: orderId,
      event_id: order.event_id,
      endpoint: subscription.endpoint,
      p256dh: subscription.keys?.p256dh,
      auth: subscription.keys?.auth,
    }, { onConflict: "endpoint" });

  return NextResponse.json({ ok: true });
}
