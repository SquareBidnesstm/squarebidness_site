import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const isAdmin = await verifyAdminSession(req);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: order } = await supabaseServer
    .from("orders")
    .select("id, status, stripe_payment_intent_id, total")
    .eq("id", id)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  if (order.status !== "refund_failed") {
    return NextResponse.json({ error: "Order is not in refund_failed state" }, { status: 400 });
  }

  if (!order.stripe_payment_intent_id) {
    return NextResponse.json({ error: "No payment intent on order — cannot refund" }, { status: 400 });
  }

  try {
    await stripe.refunds.create(
      {
        payment_intent: order.stripe_payment_intent_id,
        reverse_transfer: true,
        refund_application_fee: true,
      },
      { idempotencyKey: `refund-${id}` }
    );

    await supabaseServer
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", id);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("retry-refund Stripe error:", err);
    return NextResponse.json(
      { ok: false, error: err?.message ?? "Stripe refund failed" },
      { status: 500 }
    );
  }
}
