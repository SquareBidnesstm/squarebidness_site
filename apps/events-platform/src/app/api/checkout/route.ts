import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../lib/supabase/server";
import { PLATFORM_FEE_BASE_CENTS, PLATFORM_FEE_PCT, PLATFORM_URL } from "../../../lib/constants";
import { isSafeOrigin, checkRateLimit, recordAttempt } from "../../../lib/utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(req: NextRequest) {
  // CSRF origin check
  if (!isSafeOrigin(req)) {
    return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
  }

  // Rate limit: 20 per 15 min per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`checkout:${ip}`);
  const { limited, retryAfterSeconds } = await checkRateLimit(`checkout:${ip}`, 20);
  if (limited) {
    return NextResponse.json(
      { ok: false, error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const formData = await req.formData();
  const eventSlug = formData.get("eventSlug") as string;
  const buyerName = formData.get("buyerName") as string;
  const buyerEmail = formData.get("buyerEmail") as string;
  const buyerPhone = formData.get("buyerPhone") as string | null;
  const promoId = formData.get("promoId") as string | null;
  const refCode = (formData.get("refCode") as string | null)?.trim() || null;

  if (!eventSlug || !buyerName || !buyerEmail) {
    return NextResponse.json({ ok: false, error: "Missing required fields" }, { status: 400 });
  }

  // Input length / format validation (M3)
  if (buyerName.length > 100) {
    return NextResponse.json({ ok: false, error: "Name is too long (max 100 characters)" }, { status: 400 });
  }
  if (buyerEmail.length > 200) {
    return NextResponse.json({ ok: false, error: "Email is too long (max 200 characters)" }, { status: 400 });
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(buyerEmail)) {
    return NextResponse.json({ ok: false, error: "Invalid email address" }, { status: 400 });
  }

  // Load event + tiers + organizer
  // Use maybeSingle so a missing or unpublished slug returns null cleanly
  // instead of a PGRST116 error that pollutes Supabase error logs.
  const { data: event } = await supabaseServer
    .from("events")
    .select("*, organizers ( stripe_account_id ), ticket_tiers ( * )")
    .eq("slug", eventSlug)
    .eq("status", "published")
    .maybeSingle();

  if (!event) {
    return NextResponse.json({ ok: false, error: "Event not found" }, { status: 404 });
  }

  const organizer = event.organizers as any;
  if (!organizer?.stripe_account_id) {
    return NextResponse.json({ ok: false, error: "Organizer not connected to Stripe" }, { status: 400 });
  }

  // Build line items from form data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const lineItems: any[] = [];
  let totalPlatformFeeCents = 0;
  const tierSelections: { tierId: string; qty: number }[] = [];

  for (const tier of event.ticket_tiers as any[]) {
    const qty = parseInt(formData.get(`tier_${tier.id}`) as string ?? "0");
    if (qty <= 0) continue;

    const MAX_PER_TIER = 10;
    if (qty > MAX_PER_TIER) {
      return NextResponse.json(
        { ok: false, error: `Maximum ${MAX_PER_TIER} tickets per tier per order.` },
        { status: 400 }
      );
    }

    const available = tier.quantity - tier.quantity_sold;
    if (qty > available) {
      return NextResponse.json({ ok: false, error: `Not enough tickets for ${tier.name}` }, { status: 400 });
    }

    tierSelections.push({ tierId: tier.id, qty });

    // Apply group discount if threshold met
    let unitPrice = Number(tier.price);
    if (tier.group_min_qty && tier.group_discount_pct && qty >= tier.group_min_qty) {
      unitPrice = unitPrice * (1 - Number(tier.group_discount_pct) / 100);
    }
    const priceCents = Math.round(unitPrice * 100);

    if (priceCents > 0) {
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: `${event.title} — ${tier.name}` },
          unit_amount: priceCents,
        },
        quantity: qty,
      });
      const feePerTicketCents = PLATFORM_FEE_BASE_CENTS + Math.round(priceCents * PLATFORM_FEE_PCT);
      totalPlatformFeeCents += feePerTicketCents * qty;
    } else {
      // Free tier — no charge
      lineItems.push({
        price_data: {
          currency: "usd",
          product_data: { name: `${event.title} — ${tier.name} (Free)` },
          unit_amount: 0,
        },
        quantity: qty,
      });
    }
  }

  if (tierSelections.length === 0) {
    return NextResponse.json({ ok: false, error: "No tickets selected" }, { status: 400 });
  }

  // Apply promo discount if provided
  let discountAmountCents = 0;
  if (promoId) {
    const { data: promo } = await supabaseServer
      .from("promo_codes")
      .select("*")
      .eq("id", promoId)
      .eq("active", true)
      .single();

    if (promo && (promo.max_uses === null || promo.uses < promo.max_uses)) {
      const subtotalCents = lineItems.reduce((s, li) => s + ((li.price_data as any).unit_amount * (li.quantity ?? 1)), 0);
      discountAmountCents = promo.discount_type === "percent"
        ? Math.round((subtotalCents * promo.discount_value) / 100)
        : Math.min(Math.round(promo.discount_value * 100), subtotalCents);

      if (discountAmountCents > 0) {
        // Distribute discount proportionally across paid line items
        let remaining = discountAmountCents;
        for (let i = 0; i < lineItems.length; i++) {
          const li = lineItems[i] as any;
          if (li.price_data.unit_amount > 0) {
            const itemTotal = li.price_data.unit_amount * li.quantity;
            const share = i === lineItems.length - 1
              ? remaining
              : Math.round((itemTotal / (lineItems.reduce((s: number, l: any) => s + l.price_data.unit_amount * l.quantity, 0))) * discountAmountCents);
            // Clamp per-unit discount so unit_amount never goes negative
            const maxShareForItem = li.price_data.unit_amount * li.quantity;
            const clampedShare = Math.min(share, maxShareForItem);
            const newUnit = Math.max(0, li.price_data.unit_amount - Math.round(clampedShare / li.quantity));
            const actualReduction = (li.price_data.unit_amount - newUnit) * li.quantity;
            remaining -= actualReduction;
            li.price_data.unit_amount = newUnit;
          }
        }
      }
    }
  }

  // Recalculate platform fee based on final (possibly discounted) unit prices.
  // This ensures the fee tracks the actual amount charged, not the pre-discount price.
  if (discountAmountCents > 0 && totalPlatformFeeCents > 0) {
    totalPlatformFeeCents = lineItems.reduce((acc, li: any) => {
      if (li.price_data.unit_amount > 0) {
        return acc + (PLATFORM_FEE_BASE_CENTS + Math.round(li.price_data.unit_amount * PLATFORM_FEE_PCT)) * (li.quantity ?? 1);
      }
      return acc;
    }, 0);
  }

  // Add platform fee as a single line item (quantity: 1, unit_amount: total fee).
  // Using per-ticket rounding (Math.round(total/qty) * qty) can lose 1 cent; a single
  // line item for the exact total amount avoids that and aligns with how Stripe's
  // application_fee_amount is tracked anyway.
  if (totalPlatformFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Square Bidness Platform Fee" },
        unit_amount: totalPlatformFeeCents,
      },
      quantity: 1,
    });
  }

  // Generate order code inline (not via DB function): the DB generate_order_code()
  // function requires a round-trip before creating the Stripe session, adding latency.
  // Collisions are extremely unlikely and caught by the UNIQUE constraint on order_code.
  const orderCode = `SBE-${Date.now().toString(36).toUpperCase()}`;

  const { data: order, error: orderError } = await supabaseServer
    .from("orders")
    .insert({
      order_code: orderCode,
      event_id: event.id,
      organizer_id: event.organizer_id,
      buyer_name: buyerName,
      buyer_email: buyerEmail,
      buyer_phone: buyerPhone,
      subtotal: lineItems.reduce((s, li) => s + ((li.price_data as any).unit_amount * (li.quantity ?? 1)) / 100, 0),
      platform_fee: totalPlatformFeeCents / 100,
      total: lineItems.reduce((s, li) => s + ((li.price_data as any).unit_amount * (li.quantity ?? 1)) / 100, 0),
      status: "pending",
      ref_code: refCode,
    })
    .select()
    .single();

  if (orderError || !order) {
    return NextResponse.json({ ok: false, error: "Failed to create order" }, { status: 500 });
  }

  // Create Stripe Checkout Session via Connect
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: lineItems,
      success_url: `${PLATFORM_URL}/orders/${order.id}?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${PLATFORM_URL}/events/${eventSlug}?cancelled=1`,
      customer_email: buyerEmail,
      allow_promotion_codes: false,
      payment_intent_data: {
        application_fee_amount: totalPlatformFeeCents,
        transfer_data: {
          destination: organizer.stripe_account_id,
        },
        metadata: {
          order_id: order.id,
          order_code: orderCode,
          event_slug: eventSlug,
          buyer_name: buyerName,
          tier_selections: JSON.stringify(tierSelections),
        },
      },
      metadata: {
        order_id: order.id,
        event_slug: eventSlug,
      },
    });
  } catch (err) {
    console.error("Stripe checkout session creation failed:", err);
    await supabaseServer.from("orders").update({ status: "cancelled" }).eq("id", order.id);
    return NextResponse.json({ ok: false, error: "Could not create payment session. Please try again." }, { status: 500 });
  }

  // Update order with Stripe session ID and promo ID (promo uses incremented at payment completion)
  await supabaseServer
    .from("orders")
    .update({ stripe_session_id: session.id, promo_id: promoId ?? null })
    .eq("id", order.id);

  return NextResponse.redirect(session.url!, { status: 303 });
}
