import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const { data: shop } = await supabaseServer
    .from("shops")
    .select("id, name, slug")
    .eq("slug", shopSlug)
    .single();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  // Check for existing subscription row
  const { data: sub } = await supabaseServer
    .from("subscriptions")
    .select("stripe_customer_id, status")
    .eq("shop_id", shop.id)
    .single();

  // If already active, redirect to portal instead
  if (sub?.status === "active") {
    return NextResponse.json({ ok: false, error: "Already subscribed. Use billing portal to manage." }, { status: 409 });
  }

  const origin = req.headers.get("origin") || `https://booking.squarebidness.com`;

  // Reuse existing Stripe customer if we have one
  let customerId = sub?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await stripe.customers.create({
      name: shop.name,
      metadata: { shop_slug: shop.slug, shop_id: shop.id },
    });
    customerId = customer.id;

    // Upsert subscription row with customer id
    await supabaseServer.from("subscriptions").upsert(
      {
        shop_id: shop.id,
        stripe_customer_id: customerId,
        status: "incomplete",
        plan: "free",
      },
      { onConflict: "shop_id" }
    );
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    mode: "subscription",
    line_items: [
      {
        price: process.env.STRIPE_PRO_PRICE_ID!,
        quantity: 1,
      },
    ],
    success_url: `${origin}/${shopSlug}/admin?billing=success`,
    cancel_url: `${origin}/${shopSlug}/admin?billing=cancel`,
    metadata: { shop_slug: shopSlug, shop_id: shop.id },
    subscription_data: {
      metadata: { shop_slug: shopSlug, shop_id: shop.id },
    },
    allow_promotion_codes: true,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
