import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../../lib/auth";
import { sendEventCancellationNotice } from "../../../../../lib/notifications/email";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(req: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const session = cookieStore.getAll().find((c) => c.name.startsWith("org_session_"));
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizerSlug = session.name.replace("org_session_", "");
  const expected = await computeOrganizerSessionToken(organizerSlug);
  if (session.value !== expected) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id")
    .eq("slug", organizerSlug)
    .single();
  if (!organizer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { eventId } = body;
  if (!eventId) return NextResponse.json({ error: "Missing eventId" }, { status: 400 });

  // Fetch event — verify ownership
  const { data: event } = await supabaseServer
    .from("events")
    .select("id, title, starts_at, slug, organizer_id, status")
    .eq("id", eventId)
    .single();

  if (!event) return NextResponse.json({ error: "Event not found" }, { status: 404 });
  if (event.organizer_id !== organizer.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (event.status === "cancelled") return NextResponse.json({ error: "Event already cancelled" }, { status: 400 });

  // Mark event cancelled first
  await supabaseServer
    .from("events")
    .update({ status: "cancelled" })
    .eq("id", eventId);

  // Fetch all paid orders for this event
  const { data: orders } = await supabaseServer
    .from("orders")
    .select("id, order_code, buyer_name, buyer_email, total, stripe_payment_intent_id")
    .eq("event_id", eventId)
    .eq("status", "paid");

  const paidOrders = orders ?? [];

  const eventDate = new Date(event.starts_at).toLocaleDateString("en-US", {
    weekday: "short", month: "short", day: "numeric", year: "numeric",
  });

  let refundedCount = 0;
  let failedCount = 0;

  for (const order of paidOrders) {
    let refunded = false;

    // Issue Stripe refund
    if (order.stripe_payment_intent_id) {
      try {
        await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
          reverse_transfer: true,       // debit organizer's connected account
          refund_application_fee: true, // full refund to buyer on cancellation — organizer's fault
        });
        refunded = true;
        refundedCount++;
      } catch (err: any) {
        console.error(`Refund failed for order ${order.id}:`, err.message);
        failedCount++;
      }
    }

    // Mark order cancelled
    await supabaseServer
      .from("orders")
      .update({ status: "cancelled" })
      .eq("id", order.id);

    // Mark tickets cancelled
    await supabaseServer
      .from("tickets")
      .update({ status: "cancelled" })
      .eq("order_id", order.id);

    // Email buyer
    sendEventCancellationNotice({
      buyerName: order.buyer_name,
      buyerEmail: order.buyer_email,
      eventTitle: event.title,
      eventDate,
      orderCode: order.order_code,
      total: Number(order.total),
      refunded,
    }).catch((err) => console.error("Cancellation email error:", err));
  }

  return NextResponse.json({
    ok: true,
    ordersProcessed: paidOrders.length,
    refundedCount,
    failedCount,
  });
}
