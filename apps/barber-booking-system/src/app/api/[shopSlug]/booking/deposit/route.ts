import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  const body = await req.json();
  const {
    barber_id, customer_name, customer_phone, customer_email,
    service, time, date,
  } = body;

  if (!barber_id || !customer_name || !customer_phone || !service || !time || !date) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  const { data: shop } = await supabaseServer
    .from("shops").select("id, name, slug, timezone").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  // Get deposit settings
  const { data: depositSetting } = await supabaseServer
    .from("shop_settings").select("value_json").eq("shop_id", shop.id).eq("key", "deposit_settings").single();

  const depositConfig = depositSetting?.value_json as {
    enabled: boolean; amount: number; type: "fixed" | "percent";
  } | null;

  if (!depositConfig?.enabled) {
    return NextResponse.json({ ok: false, error: "Deposits not enabled for this shop." }, { status: 400 });
  }

  const { data: barber } = await supabaseServer
    .from("barbers").select("id").eq("shop_id", shop.id).eq("slug", barber_id).eq("active", true).single();

  const { data: svc } = await supabaseServer
    .from("services").select("id, name, price, duration_minutes").eq("shop_id", shop.id).eq("slug", service).eq("active", true).single();
  if (!svc) return NextResponse.json({ ok: false, error: "Service not found." }, { status: 404 });

  // Apply barber-specific price override if one exists
  let servicePrice = Number(svc.price);
  if (barber) {
    const { data: overrideSetting } = await supabaseServer
      .from("shop_settings").select("value_json")
      .eq("shop_id", shop.id).eq("key", `barber_price_overrides_${barber.id}`).single();
    const overrides = (overrideSetting?.value_json as Record<string, number> | null) ?? {};
    if (overrides[svc.id] !== undefined) servicePrice = Number(overrides[svc.id]);
  }
  const depositAmount = depositConfig.type === "percent"
    ? Math.round((servicePrice * depositConfig.amount) / 100)
    : depositConfig.amount;

  const origin = req.headers.get("origin") || "https://booking.squarebidness.com";

  // Encode booking data in success URL so the webhook-free path works via redirect
  const bookingData = encodeURIComponent(JSON.stringify({
    barber_id, customer_name, customer_phone, customer_email, service, time, date,
  }));

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: Math.round(depositAmount * 100),
        product_data: {
          name: `Deposit — ${svc.name} at ${shop.name}`,
          description: `${customer_name} · ${date} at ${time}`,
        },
      },
      quantity: 1,
    }],
    success_url: `${origin}/api/${shopSlug}/booking/deposit/confirm?session_id={CHECKOUT_SESSION_ID}&data=${bookingData}`,
    cancel_url: `${origin}/${shopSlug}/book/${barber_id}`,
    metadata: {
      shop_id: shop.id,
      shop_slug: shopSlug,
      barber_slug: barber_id,
      service_slug: service,
      customer_name,
      customer_phone,
      customer_email: customer_email ?? "",
      date,
      time,
    },
    payment_intent_data: {
      metadata: { shop_id: shop.id, shop_slug: shopSlug },
    },
  });

  return NextResponse.json({ ok: true, url: session.url, depositAmount });
}
