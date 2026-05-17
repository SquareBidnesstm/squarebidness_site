import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { checkActiveSubscription } from "../../../../../lib/auth";
import { checkRateLimit, recordAttempt } from "../../../../../lib/utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;

  // Rate limit: 10 deposit sessions per 15 min per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  recordAttempt(`deposit:${ip}`);
  const { limited } = checkRateLimit(`deposit:${ip}`, 10);
  if (limited) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await req.json();
  const {
    barber_id, customer_name, customer_phone, customer_email,
    client_notes, service, time, date,
  } = body;

  if (!barber_id || !customer_name || !customer_phone || !service || !time || !date) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  // Enforce max 90-day booking window
  const requestedDate = new Date(`${date}T12:00:00`);
  const maxAllowed = new Date();
  maxAllowed.setDate(maxAllowed.getDate() + 90);
  if (isNaN(requestedDate.getTime()) || requestedDate > maxAllowed) {
    return NextResponse.json({ ok: false, error: "Bookings can only be made up to 90 days in advance." }, { status: 400 });
  }

  // BH-7: Reject past dates
  const todayUTC = new Date();
  todayUTC.setUTCHours(0, 0, 0, 0);
  if (requestedDate < todayUTC) {
    return NextResponse.json({ ok: false, error: "Cannot book a date in the past." }, { status: 400 });
  }

  const { data: shop } = await supabaseServer
    .from("shops").select("id, name, slug, timezone").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const hasActivePlan = await checkActiveSubscription(shop.id);
  if (!hasActivePlan) {
    return NextResponse.json({ ok: false, error: "This shop's subscription is inactive. Online booking is unavailable." }, { status: 402 });
  }

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
  // BC-2: Must guard here — if barber is null, Stripe checkout would be created for a
  // non-existent barber. The webhook/confirm route would then silently abandon booking
  // creation, leaving the customer charged with no appointment.
  if (!barber) return NextResponse.json({ ok: false, error: "Barber not found or no longer active." }, { status: 404 });

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
    // Booking data read from metadata on success — no sensitive data in URL
    success_url: `${origin}/api/${shopSlug}/booking/deposit/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/${shopSlug}/book/${barber_id}`,
    metadata: {
      shop_id: shop.id,
      shop_slug: shopSlug,
      barber_slug: barber_id,
      service_slug: service,
      customer_name,
      customer_phone,
      customer_email: customer_email ?? "",
      client_notes: (client_notes ?? "").slice(0, 500), // Stripe metadata 500-char limit
      date,
      time,
    },
    payment_intent_data: {
      metadata: { shop_id: shop.id, shop_slug: shopSlug },
    },
  });

  if (!session.url) {
    return NextResponse.json({ ok: false, error: "Could not create checkout session." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: session.url, depositAmount });
}
