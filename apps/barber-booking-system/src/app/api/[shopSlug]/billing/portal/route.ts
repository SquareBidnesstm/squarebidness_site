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
    .select("id")
    .eq("slug", shopSlug)
    .single();

  if (!shop) {
    return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });
  }

  const { data: sub } = await supabaseServer
    .from("subscriptions")
    .select("stripe_customer_id")
    .eq("shop_id", shop.id)
    .single();

  if (!sub?.stripe_customer_id) {
    return NextResponse.json({ ok: false, error: "No billing account found." }, { status: 404 });
  }

  const origin = req.headers.get("origin") || `https://booking.squarebidness.com`;

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripe_customer_id,
    return_url: `${origin}/${shopSlug}/admin`,
  });

  return NextResponse.json({ ok: true, url: session.url });
}
