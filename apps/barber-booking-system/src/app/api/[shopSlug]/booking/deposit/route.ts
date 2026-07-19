import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { checkActiveSubscription } from "../../../../../lib/auth";
import { verifyTurnstileToken } from "../../../../../lib/turnstile";
import { checkRateLimit, cleanText, isSafeOrigin, isValidEmail, isValidSlug, normalizePhone, recordAttempt } from "../../../../../lib/utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

// Platform processing fee — set PLATFORM_FEE_PERCENT in env (e.g. "2.5" = 2.5%).
// Applied only when the shop has a connected Stripe account.
// Returns fee in cents; minimum 0.
function platformFeeAmount(amountCents: number): number {
  const pct = parseFloat(process.env.PLATFORM_FEE_PERCENT ?? "0");
  if (!pct || pct <= 0) return 0;
  return Math.max(0, Math.round(amountCents * (pct / 100)));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const requestOrigin = req.headers.get("origin");
  if (!isValidSlug(shopSlug) || !isSafeOrigin(requestOrigin)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 10 deposit sessions per 15 min per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  recordAttempt(`deposit:${ip}`);
  const { limited } = await checkRateLimit(`deposit:${ip}`, 10);
  if (limited) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please try again later." }, { status: 429 });
  }

  const body = await req.json();
  const {
    barber_id, customer_name, customer_phone, customer_email,
    client_notes, service, time, date, turnstileToken,
  } = body;

  const turnstileOk = await verifyTurnstileToken(turnstileToken, ip);
  if (!turnstileOk) {
    return NextResponse.json({ ok: false, error: "Verification failed. Please try again." }, { status: 403 });
  }

  if (!isValidSlug(barber_id) || !isValidSlug(service) || !customer_name || !customer_phone || !time || !date) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }

  const cleanName = cleanText(customer_name, 100);
  const cleanPhone = normalizePhone(customer_phone);
  const cleanEmail = customer_email ? cleanText(customer_email, 200).toLowerCase() : "";
  const cleanNotes = client_notes ? cleanText(client_notes, 500) : "";
  const cleanTime = cleanText(time, 20);
  if (!cleanName || !cleanPhone || !cleanTime) {
    return NextResponse.json({ ok: false, error: "Missing required fields." }, { status: 400 });
  }
  if (cleanEmail && !isValidEmail(cleanEmail)) {
    return NextResponse.json({ ok: false, error: "Enter a valid email address." }, { status: 400 });
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
    .from("shops").select("id, name, slug, timezone, stripe_account_id, stripe_onboarding_complete, bypass_stripe_requirement").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const hasActivePlan = await checkActiveSubscription(shop.id);
  if (!hasActivePlan) {
    return NextResponse.json({ ok: false, error: "This shop's subscription is inactive. Online booking is unavailable." }, { status: 402 });
  }

  const stripeReady =
    !!(shop as any).stripe_onboarding_complete || !!(shop as any).bypass_stripe_requirement;
  if (!stripeReady) {
    return NextResponse.json(
      { ok: false, error: "Online booking is not available yet. Please contact the shop directly." },
      { status: 402 }
    );
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

  const origin = requestOrigin || "https://booking.squarebidness.com";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: Math.round(depositAmount * 100),
        product_data: {
          name: `Deposit — ${svc.name} at ${shop.name}`,
          description: `${cleanName} · ${date} at ${cleanTime}`,
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
      customer_name: cleanName,
      customer_phone: cleanPhone,
      customer_email: cleanEmail,
      client_notes: cleanNotes,
      date,
      time: cleanTime,
    },
    payment_intent_data: {
      metadata: { shop_id: shop.id, shop_slug: shopSlug },
      ...(shop.stripe_account_id ? {
        transfer_data: { destination: shop.stripe_account_id },
        application_fee_amount: platformFeeAmount(Math.round(depositAmount * 100)),
      } : {}),
    },
  });

  if (!session.url) {
    return NextResponse.json({ ok: false, error: "Could not create checkout session." }, { status: 500 });
  }

  return NextResponse.json({ ok: true, url: session.url, depositAmount });
}
