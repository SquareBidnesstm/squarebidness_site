import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../lib/auth";
import { uploadQRToStorage } from "../../../../lib/qr";
import { sendBuyerConfirmation } from "../../../../lib/notifications/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(req: NextRequest) {
  const isAdmin = await verifyAdminSession(req);
  if (!isAdmin) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { orderId, action } = await req.json();
  if (!orderId || !action) return NextResponse.json({ error: "Missing fields" }, { status: 400 });

  if (action === "refulfill") {
    const { data: order } = await supabaseServer
      .from("orders")
      .select("*, events ( *, organizers ( name, email, phone ) )")
      .eq("id", orderId)
      .single();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (order.status !== "paid") return NextResponse.json({ error: "Only paid orders can be re-fulfilled" }, { status: 400 });

    // Check for existing tickets
    const { data: existing } = await supabaseServer
      .from("tickets")
      .select("id")
      .eq("order_id", orderId);

    if (existing && existing.length > 0) {
      return NextResponse.json({ error: "Order already has tickets" }, { status: 400 });
    }

    // Get tier selections from Stripe PI metadata
    if (!order.stripe_payment_intent_id) {
      return NextResponse.json({ error: "No payment intent on order" }, { status: 400 });
    }

    const pi = await stripe.paymentIntents.retrieve(order.stripe_payment_intent_id);
    const tierSelections: { tierId: string; qty: number }[] = pi.metadata?.tier_selections
      ? JSON.parse(pi.metadata.tier_selections)
      : [];

    if (!tierSelections.length) {
      return NextResponse.json({ error: "No tier selections found in payment intent" }, { status: 400 });
    }

    const ev = order.events as any;
    const issuedTickets: { ticketCode: string; tierName: string; qrDataUrl: string }[] = [];

    for (const { tierId, qty } of tierSelections) {
      const { data: tierData } = await supabaseServer
        .from("ticket_tiers")
        .select("name, price, quantity, quantity_sold")
        .eq("id", tierId)
        .single();

      if (!tierData) continue;

      // Atomic capacity guard: only increment if sufficient spots remain
      const { data: capacityUpdated } = await supabaseServer
        .from("ticket_tiers")
        .update({ quantity_sold: tierData.quantity_sold + qty })
        .eq("id", tierId)
        .lte("quantity_sold", tierData.quantity - qty)
        .select("id")
        .single();

      if (!capacityUpdated) {
        return NextResponse.json(
          { error: `Not enough capacity in tier ${tierId} to re-fulfill` },
          { status: 409 }
        );
      }

      for (let i = 0; i < qty; i++) {
        const ticketCode = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
        const qrDataUrl = await uploadQRToStorage(ticketCode, supabaseServer);

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

        issuedTickets.push({ ticketCode, tierName: tierData.name ?? "Ticket", qrDataUrl });
      }
    }

    const eventDate = ev?.starts_at
      ? new Date(ev.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
      : "";
    const eventTime = ev?.starts_at
      ? new Date(ev.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
      : "";

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
      total: Number(order.total),
    }).catch(() => {});

    return NextResponse.json({ ok: true, ticketsIssued: issuedTickets.length });
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
