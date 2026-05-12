import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { generateQRDataURL } from "../../../../lib/qr";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature")!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    const tierSelections = session.payment_intent
      ? (await stripe.paymentIntents.retrieve(session.payment_intent as string)).metadata?.tier_selections
      : null;

    if (!orderId) return NextResponse.json({ ok: true });

    // Mark order completed
    await supabaseServer
      .from("orders")
      .update({
        status: "completed",
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("id", orderId);

    // Fetch order
    const { data: order } = await supabaseServer
      .from("orders")
      .select("*, events ( * )")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ ok: true });

    // Issue tickets
    const selections: { tierId: string; qty: number }[] = tierSelections
      ? JSON.parse(tierSelections)
      : [];

    for (const { tierId, qty } of selections) {
      const { data: tier } = await supabaseServer
        .from("ticket_tiers")
        .select("name, price")
        .eq("id", tierId)
        .single();

      for (let i = 0; i < qty; i++) {
        const ticketCode = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const qrDataURL = await generateQRDataURL(ticketCode);

        await supabaseServer.from("tickets").insert({
          ticket_code: ticketCode,
          order_id: order.id,
          event_id: order.event_id,
          tier_id: tierId,
          buyer_name: order.buyer_name,
          buyer_email: order.buyer_email,
          price_snapshot: tier?.price ?? 0,
          qr_code: qrDataURL,
          status: "valid",
        });
      }
    }

    // Track platform payout
    if (session.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      if (pi.application_fee_amount && pi.application_fee_amount > 0) {
        await supabaseServer.from("platform_payouts").insert({
          order_id: orderId,
          amount: pi.application_fee_amount / 100,
          status: "paid",
        });
      }
    }
  }

  return NextResponse.json({ ok: true });
}
