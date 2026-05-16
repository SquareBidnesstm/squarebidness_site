import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { generateQRDataURL } from "../../../../lib/qr";
import { sendBuyerConfirmation, sendOrganizerSaleNotification } from "../../../../lib/notifications/email";
import { sendBuyerSMS, sendOrganizerSaleSMS } from "../../../../lib/notifications/sms";

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

  // ── Helper: decrement quantity_sold for tier selections stored in metadata ──
  async function decrementTierSelections(tierSelectionsJson: string | null | undefined) {
    if (!tierSelectionsJson) return;
    let selections: { tierId: string; qty: number }[] = [];
    try { selections = JSON.parse(tierSelectionsJson); } catch { return; }
    for (const { tierId, qty } of selections) {
      const { data: tierData } = await supabaseServer
        .from("ticket_tiers")
        .select("quantity_sold")
        .eq("id", tierId)
        .single();
      if (!tierData) continue;
      const newSold = Math.max(0, tierData.quantity_sold - qty);
      // Optimistic lock: only decrement if quantity_sold hasn't changed under us
      await supabaseServer
        .from("ticket_tiers")
        .update({ quantity_sold: newSold })
        .eq("id", tierId)
        .eq("quantity_sold", tierData.quantity_sold);
    }
  }

  // ── Checkout session expired: cancel pending order + restore capacity ──────
  if (event.type === "checkout.session.expired") {
    const expiredSession = event.data.object as Stripe.Checkout.Session;
    const expiredOrderId = expiredSession.metadata?.order_id;
    if (expiredOrderId) {
      // Mark the order cancelled (only if still pending to avoid double-processing)
      const { data: cancelledOrder } = await supabaseServer
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", expiredOrderId)
        .eq("status", "pending")
        .select("id")
        .single();

      // Only decrement capacity if we actually transitioned the order (idempotency)
      if (cancelledOrder) {
        // tier_selections live on the payment_intent metadata
        const piId = expiredSession.payment_intent as string | null;
        let tierSelectionsJson: string | null = null;
        if (piId) {
          try {
            const pi = await stripe.paymentIntents.retrieve(piId);
            tierSelectionsJson = pi.metadata?.tier_selections ?? null;
          } catch { /* payment intent may not exist if session expired before auth */ }
        }
        await decrementTierSelections(tierSelectionsJson);
      }
    }
    return NextResponse.json({ ok: true });
  }

  // ── Payment failed: clean up stuck pending orders ──────
  if (event.type === "payment_intent.payment_failed") {
    const pi = event.data.object as Stripe.PaymentIntent;
    const orderId = pi.metadata?.order_id;
    if (orderId) {
      const { data: cancelledOrder } = await supabaseServer
        .from("orders")
        .update({ status: "cancelled" })
        .eq("id", orderId)
        .eq("status", "pending")
        .select("id")
        .single();

      // Decrement capacity only if we transitioned the order
      if (cancelledOrder) {
        await decrementTierSelections(pi.metadata?.tier_selections ?? null);
      }
    }
    return NextResponse.json({ ok: true });
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    const tierSelections = session.payment_intent
      ? (await stripe.paymentIntents.retrieve(session.payment_intent as string)).metadata?.tier_selections
      : null;

    if (!orderId) return NextResponse.json({ ok: true });

    // Idempotency: only transition from pending → paid
    // If Stripe retries and the order is already paid, this update affects 0 rows
    const { data: claimed } = await supabaseServer
      .from("orders")
      .update({
        status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("id", orderId)
      .eq("status", "pending")
      .select("id")
      .single();

    if (!claimed) {
      // Order already processed — return 200 so Stripe stops retrying
      return NextResponse.json({ ok: true });
    }

    // Fetch full order now that it's confirmed paid
    const { data: order } = await supabaseServer
      .from("orders")
      .select("*, events ( *, organizers ( name, email, phone ) )")
      .eq("id", claimed.id)
      .single();

    if (!order) return NextResponse.json({ ok: true });

    const ev = order.events as any;
    const organizer = ev?.organizers as any;

    // Issue tickets
    const selections: { tierId: string; qty: number }[] = tierSelections
      ? JSON.parse(tierSelections)
      : [];

    const issuedTickets: { ticketCode: string; tierName: string; qrDataUrl: string }[] = [];

    for (const { tierId, qty } of selections) {
      const { data: tierData } = await supabaseServer
        .from("ticket_tiers")
        .select("name, price, quantity, quantity_sold")
        .eq("id", tierId)
        .single();

      if (!tierData) continue;

      // Atomic capacity guard: only update if quantity_sold + qty <= quantity
      const { data: updated } = await supabaseServer
        .from("ticket_tiers")
        .update({ quantity_sold: tierData.quantity_sold + qty })
        .eq("id", tierId)
        .lte("quantity_sold", tierData.quantity - qty)
        .select("id")
        .single();

      if (!updated) {
        // Race condition — another purchase took the last spots, auto-refund
        console.error(`Oversell prevented for tier ${tierId}, order ${order.id}`);
        let refundOk = false;
        if (order.stripe_payment_intent_id) {
          refundOk = await stripe.refunds.create({
              payment_intent: order.stripe_payment_intent_id,
              reverse_transfer: true,
              refund_application_fee: true, // oversell is platform's fault — full refund
            })
            .then(() => true)
            .catch((e) => { console.error("Auto-refund failed:", e); return false; });
        }
        // Mark order cancelled; if refund failed, surface it for manual resolution
        await supabaseServer
          .from("orders")
          .update({ status: refundOk ? "cancelled" : "refund_failed" })
          .eq("id", order.id);
        return NextResponse.json({ ok: true });
      }

      for (let i = 0; i < qty; i++) {
        let inserted = false;
        let ticketCode = "";
        let qrDataUrl = "";
        for (let attempt = 0; attempt < 3; attempt++) {
          ticketCode = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
          qrDataUrl = await generateQRDataURL(ticketCode);
          const { error: insertErr } = await supabaseServer.from("tickets").insert({
            ticket_code: ticketCode,
            order_id: order.id,
            event_id: order.event_id,
            tier_id: tierId,
            tier_name: tierData.name ?? "",
            buyer_name: order.buyer_name,
            buyer_email: order.buyer_email,
            price_snapshot: tierData.price ?? 0,
            qr_code: qrDataUrl,
            status: "valid",
          });
          if (!insertErr) { inserted = true; break; }
          if (insertErr.code !== "23505") {
            console.error("Ticket insert error:", insertErr);
            break;
          }
          // 23505 = unique_violation on ticket_code — retry with new code
        }
        if (!inserted) continue;

        issuedTickets.push({
          ticketCode,
          tierName: tierData.name ?? "Ticket",
          qrDataUrl,
        });
      }
    }

    // Increment referral uses counter with optimistic lock + retry to prevent lost updates
    if (order.ref_code) {
      let retries = 0;
      while (retries < 3) {
        const { data: refRow } = await supabaseServer
          .from("referral_codes")
          .select("id, uses")
          .eq("code", order.ref_code)
          .single();
        if (!refRow) break;
        const { data: updated } = await supabaseServer
          .from("referral_codes")
          .update({ uses: (refRow.uses ?? 0) + 1 })
          .eq("id", refRow.id)
          .eq("uses", refRow.uses) // optimistic lock: only update if uses hasn't changed
          .select("id");
        if (updated && updated.length > 0) break; // success
        retries++;
      }
    }

    // Increment promo uses now that payment is confirmed (not at session creation).
    // Re-check the live max_uses cap here as a second guard against over-redemption
    // (the first check happened at checkout session creation in /api/checkout).
    if (order.promo_id) {
      try {
        const { data: livePromo } = await supabaseServer
          .from("promo_codes")
          .select("uses, max_uses")
          .eq("id", order.promo_id)
          .single();
        const underLimit =
          !livePromo ||
          livePromo.max_uses === null ||
          livePromo.uses < livePromo.max_uses;
        if (underLimit) {
          await supabaseServer.rpc("increment_promo_uses", { promo_id: order.promo_id });
        } else {
          console.error("Promo max_uses already reached for order", order.id, "— skipping increment");
        }
      } catch {
        // non-critical — log and continue
        console.error("Failed to increment promo uses for order", order.id);
      }
    }

    // Track platform payout
    if (session.payment_intent) {
      const pi = await stripe.paymentIntents.retrieve(session.payment_intent as string);
      if (pi.application_fee_amount && pi.application_fee_amount > 0) {
        await supabaseServer.from("platform_payouts").insert({
          order_id: orderId,
          amount_cents: pi.application_fee_amount,
          status: "paid",
        });
      }
    }

    // Format event date/time for notifications
    const eventDate = ev?.starts_at
      ? new Date(ev.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : "";
    const eventTime = ev?.starts_at
      ? new Date(ev.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : "";

    const totalTickets = issuedTickets.length;
    const orderTotal = Number(order.total);

    // ── EMAIL ──────────────────────────────────────────────
    // Buyer confirmation
    await sendBuyerConfirmation({
      buyerName: order.buyer_name,
      buyerEmail: order.buyer_email,
      orderCode: order.order_code,
      orderId: order.id,
      eventTitle: ev?.title ?? "Your Event",
      eventDate,
      eventTime,
      venueName: ev?.venue_name ?? null,
      city: ev?.city ?? null,
      state: ev?.state ?? null,
      tickets: issuedTickets,
      total: orderTotal,
    }).catch((err) => console.error("Buyer email error:", err));

    // Organizer sale notification
    if (organizer?.email) {
      await sendOrganizerSaleNotification({
        organizerEmail: organizer.email,
        organizerName: organizer.name,
        eventTitle: ev?.title ?? "Your Event",
        buyerName: order.buyer_name,
        ticketCount: totalTickets,
        total: orderTotal,
        orderCode: order.order_code,
      }).catch((err) => console.error("Organizer email error:", err));
    }

    // ── SMS ────────────────────────────────────────────────
    // Buyer SMS (only if they provided a phone number)
    if (order.buyer_phone) {
      await sendBuyerSMS({
        phone: order.buyer_phone,
        buyerName: order.buyer_name,
        eventTitle: ev?.title ?? "Your Event",
        eventDate,
        orderCode: order.order_code,
        orderId: order.id,
        ticketCount: totalTickets,
      }).catch((err) => console.error("Buyer SMS error:", err));
    }

    // Organizer SMS (only if they have a phone on file)
    if (organizer?.phone) {
      await sendOrganizerSaleSMS({
        phone: organizer.phone,
        eventTitle: ev?.title ?? "Your Event",
        buyerName: order.buyer_name,
        ticketCount: totalTickets,
        total: orderTotal,
      }).catch((err) => console.error("Organizer SMS error:", err));
    }
  }

  return NextResponse.json({ ok: true });
}
