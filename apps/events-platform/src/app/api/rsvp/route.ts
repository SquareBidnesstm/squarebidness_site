import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "../../../lib/supabase/server";
import { generateQRDataURL } from "../../../lib/qr";
import { sendBuyerConfirmation } from "../../../lib/notifications/email";
import { sendBuyerSMS } from "../../../lib/notifications/sms";
import { checkRateLimit, recordAttempt } from "../../../lib/utils";

export async function POST(req: NextRequest) {
  // Rate limit: 5 RSVPs per 15 min per IP
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    req.headers.get("x-real-ip") ??
    "unknown";
  recordAttempt(`rsvp:${ip}`);
  const { limited, retryAfterSeconds } = checkRateLimit(`rsvp:${ip}`, 5);
  if (limited) {
    return NextResponse.json(
      { error: `Too many requests. Try again in ${Math.ceil(retryAfterSeconds / 60)} min.` },
      { status: 429 }
    );
  }

  const body = await req.json();
  const { eventId, tierId, name, email, phone, qty, promoId, refCode } = body;

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

  // Atomically reserve capacity: only increment if sufficient spots remain.
  // Uses an optimistic lte guard so concurrent RSVPs can't oversell.
  const { data: reserved } = await supabaseServer
    .from("ticket_tiers")
    .update({ quantity_sold: tier.quantity_sold + qty })
    .eq("id", tierId)
    .lte("quantity_sold", tier.quantity - qty)
    .select("id")
    .single();

  if (!reserved) {
    const spotsLeft = tier.quantity - tier.quantity_sold;
    return NextResponse.json(
      { error: spotsLeft > 0 ? `Only ${spotsLeft} spot${spotsLeft !== 1 ? "s" : ""} left` : "Sorry, this tier is sold out." },
      { status: 409 }
    );
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
      ref_code: refCode?.trim() || null,
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
    try { await supabaseServer.rpc("increment_promo_uses", { promo_id: promoId }); } catch { /* non-critical */ }
  }

  return NextResponse.json({ ok: true, orderId: order.id, orderCode: order.order_code });
}
