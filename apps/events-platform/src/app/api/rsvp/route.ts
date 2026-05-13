import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";
import { generateQRDataURL } from "../../../lib/qr";
import { sendBuyerConfirmation } from "../../../lib/notifications/email";
import { sendBuyerSMS } from "../../../lib/notifications/sms";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { eventId, tierId, name, email, phone, qty, promoId } = body;

  if (!eventId || !tierId || !name || !email || !qty) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  // Verify event is free
  const { data: event } = await supabaseServer
    .from("events")
    .select("*, organizers ( name, email, phone )")
    .eq("id", eventId)
    .eq("status", "published")
    .single();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });

  const { data: tier } = await supabaseServer
    .from("ticket_tiers")
    .select("*")
    .eq("id", tierId)
    .eq("event_id", eventId)
    .single();

  if (!tier) return NextResponse.json({ error: "Tier not found" }, { status: 404 });
  if (Number(tier.price) > 0) return NextResponse.json({ error: "This tier requires payment" }, { status: 400 });

  // Check capacity
  const spotsLeft = tier.quantity - tier.quantity_sold;
  if (spotsLeft < qty) {
    return NextResponse.json({ error: `Only ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left` }, { status: 400 });
  }

  // Generate order code
  const orderCode = `RSV-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;

  // Create order
  const { data: order, error: orderErr } = await supabaseServer
    .from("orders")
    .insert({
      event_id: eventId,
      order_code: orderCode,
      buyer_name: name.trim(),
      buyer_email: email.trim().toLowerCase(),
      buyer_phone: phone?.trim() || null,
      total: 0,
      status: "paid",
    })
    .select()
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Failed to create order" }, { status: 500 });
  }

  // Issue tickets
  const issuedTickets: { ticketCode: string; tierName: string; qrDataUrl: string }[] = [];

  for (let i = 0; i < qty; i++) {
    const ticketCode = `TKT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const qrDataUrl = await generateQRDataURL(ticketCode);

    await supabaseServer.from("tickets").insert({
      ticket_code: ticketCode,
      order_id: order.id,
      event_id: eventId,
      tier_id: tierId,
      tier_name: tier.name,
      buyer_name: order.buyer_name,
      buyer_email: order.buyer_email,
      price_snapshot: 0,
      qr_code: qrDataUrl,
      status: "valid",
    });

    issuedTickets.push({ ticketCode, tierName: tier.name, qrDataUrl });
  }

  // Update quantity_sold
  await supabaseServer
    .from("ticket_tiers")
    .update({ quantity_sold: tier.quantity_sold + qty })
    .eq("id", tierId);

  // Format event date/time
  const eventDate = event.starts_at
    ? new Date(event.starts_at).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })
    : "";
  const eventTime = event.starts_at
    ? new Date(event.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : "";

  // Send confirmation email
  await sendBuyerConfirmation({
    buyerName: order.buyer_name,
    buyerEmail: order.buyer_email,
    orderCode: order.order_code,
    orderId: order.id,
    eventTitle: event.title,
    eventDate,
    eventTime,
    venueName: event.venue_name ?? null,
    city: event.city ?? null,
    state: event.state ?? null,
    tickets: issuedTickets,
    total: 0,
  }).catch((err) => console.error("RSVP email error:", err));

  // Send SMS if phone provided
  if (phone?.trim()) {
    await sendBuyerSMS({
      phone: phone.trim(),
      buyerName: order.buyer_name,
      eventTitle: event.title,
      eventDate,
      orderCode: order.order_code,
      orderId: order.id,
      ticketCount: qty,
    }).catch((err) => console.error("RSVP SMS error:", err));
  }

  // Track promo code usage
  if (promoId) {
    await supabaseServer.rpc("increment_promo_uses", { promo_id: promoId }).catch(() => {});
  }

  return NextResponse.json({ ok: true, orderId: order.id, orderCode: order.order_code });
}
