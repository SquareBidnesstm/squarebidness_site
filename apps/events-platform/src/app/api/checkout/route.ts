import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../lib/supabase/server";
import { PLATFORM_FEE_CENTS, PLATFORM_URL } from "../../../lib/constants";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(req: NextRequest) {
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

  // Load event + tiers + organizer
  const { data: event } = await supabaseServer
    .from("events")
    .select("*, organizers ( stripe_account_id ), ticket_tiers ( * )")
    .eq("slug", eventSlug)
    .eq("status", "published")
    .single();

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
      totalPlatformFeeCents += PLATFORM_FEE_CENTS * qty;
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
            const newUnit = Math.max(0, li.price_data.unit_amount - Math.round(share / li.quantity));
            remaining -= (li.price_data.unit_amount - newUnit) * li.quantity;
            li.price_data.unit_amount = newUnit;
          }
        }
      }
    }
  }

  // Add platform fee line item if applicable
  if (totalPlatformFeeCents > 0) {
    lineItems.push({
      price_data: {
        currency: "usd",
        product_data: { name: "Square Bidness Platform Fee" },
        unit_amount: totalPlatformFeeCents / tierSelections.reduce((s, t) => s + t.qty, 0),
      },
      quantity: tierSelections.reduce((s, t) => s + t.qty, 0),
    });
  }

  // Store pending order metadata in Supabase
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
  const session = await stripe.checkout.sessions.create({
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

  // Update order with Stripe session ID
  await supabaseServer
    .from("orders")
    .update({ stripe_session_id: session.id })
    .eq("id", order.id);

  // Increment promo uses
  if (promoId && discountAmountCents > 0) {
    await supabaseServer.rpc("increment_promo_uses", { promo_id: promoId });
  }

  return NextResponse.redirect(session.url!, { status: 303 });
}
