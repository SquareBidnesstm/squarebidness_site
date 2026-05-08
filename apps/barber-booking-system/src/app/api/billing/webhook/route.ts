import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export const config = { runtime: "nodejs" };

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;
        const shopId = session.metadata?.shop_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        if (!shopId) break;

        const plan = session.metadata?.plan === "solo" ? "solo" : "pro";

        await supabaseServer.from("subscriptions").upsert(
          {
            shop_id: shopId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: "active",
            plan,
            current_period_end: null,
          },
          { onConflict: "shop_id" }
        );
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const shopId = sub.metadata?.shop_id;
        if (!shopId) break;

        const periodEndTs = sub.items?.data?.[0]?.current_period_end ?? null;
        const periodEnd = periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null;
        const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";

        // Preserve plan from metadata; fall back to checking price ID
        let plan = sub.metadata?.plan ?? "";
        if (!plan || (status !== "active")) {
          plan = status === "active" ? "pro" : "free";
        }

        await supabaseServer
          .from("subscriptions")
          .update({
            status,
            plan: status === "active" ? plan : "free",
            stripe_subscription_id: sub.id,
            ...(periodEnd ? { current_period_end: periodEnd } : {}),
          })
          .eq("shop_id", shopId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const shopId = sub.metadata?.shop_id;
        if (!shopId) break;

        await supabaseServer
          .from("subscriptions")
          .update({ status: "canceled", plan: "free", stripe_subscription_id: null, current_period_end: null })
          .eq("shop_id", shopId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        await supabaseServer
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_customer_id", customerId);
        break;
      }

      default:
        // Unhandled event — ignore
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
