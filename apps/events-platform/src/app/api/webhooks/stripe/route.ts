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

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const orderId = session.metadata?.order_id;
    const tierSelections = session.payment_intent
      ? (await stripe.paymentIntents.retrieve(session.payment_intent as string)).metadata?.tier_selections
      : null;

    if (!orderId) return NextResponse.json({ ok: true });

    // Mark order paid
    await supabaseServer
      .from("orders")
      .update({
        status: "paid",
        stripe_payment_intent_id: session.payment_intent as string,
      })
      .eq("id", orderId);

    // Fetch order + event + organizer
    const { data: order } = await supabaseServer
      .from("orders")
      .select("*, events ( *, organizers ( name, email, phone ) )")
      .eq("id", orderId)
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
        if (order.stripe_payment_intent_id) {
          await stripe.refunds.create({ payment_intent: order.stripe_payment_intent_id })
            .catch((e) => console.error("Auto-refund failed:", e));
        }
        await supabaseServer.from("orders").update({ status: "cancelled" }).eq("id", order.id);
        return NextResponse.json({ ok: true });
      }

      for (let i = 0; i < qty; i++) {
        const ticketCode = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const qrDataUrl = await generateQRDataURL(ticketCode);

        await supabaseServer.from("tickets").insert({
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

        issuedTickets.push({
          ticketCode,
          tierName: tierData.name ?? "Ticket",
          qrDataUrl,
        });
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
