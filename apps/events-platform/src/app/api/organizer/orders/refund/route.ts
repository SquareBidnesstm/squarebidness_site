import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";
import { sendWaitlistNotification } from "../../../../../lib/notifications/email";
import { CANCELLATION_FEE_PERCENT } from "../../../../../lib/constants";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(req: NextRequest) {
  // Auth
  const organizerSlug = await getVerifiedOrganizerSlug(req);
  if (!organizerSlug) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: organizer } = await supabaseServer
    .from("organizers")
    .select("id")
    .eq("slug", organizerSlug)
    .single();

  if (!organizer) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { orderId } = body;
  if (!orderId) return NextResponse.json({ error: "Missing orderId" }, { status: 400 });

  // Fetch order — verify it belongs to this organizer's event
  const { data: order } = await supabaseServer
    .from("orders")
    .select("*, events ( organizer_id, refund_policy, starts_at )")
    .eq("id", orderId)
    .single();

  if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  const event = order.events as any;
  if (event?.organizer_id !== organizer.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (order.status !== "paid") {
    return NextResponse.json({ error: "Only paid orders can be refunded" }, { status: 400 });
  }

  // Enforce refund policy
  // CANCELLATION_FEE_PERCENT is available if needed for partial-refund logic in the future
  void CANCELLATION_FEE_PERCENT;
  const refundPolicy: string | null = event?.refund_policy ?? null;
  if (refundPolicy === "no_refunds") {
    return NextResponse.json(
      { error: "This event's refund policy does not allow refunds." },
      { status: 400 }
    );
  }
  const startsAt = event?.starts_at ? new Date(event.starts_at).getTime() : null;
  const hoursUntilEvent = startsAt ? (startsAt - Date.now()) / (1000 * 60 * 60) : null;

  if (refundPolicy === "up_to_24h") {
    if (hoursUntilEvent !== null && hoursUntilEvent < 24) {
      return NextResponse.json(
        { error: "This event's refund policy only allows refunds more than 24 hours before the event." },
        { status: 400 }
      );
    }
  }
  if (refundPolicy === "up_to_48h") {
    if (hoursUntilEvent !== null && hoursUntilEvent < 48) {
      return NextResponse.json(
        { error: "This event's refund policy only allows refunds more than 48 hours before the event." },
        { status: 400 }
      );
    }
  }
  if (refundPolicy === "up_to_7d") {
    if (hoursUntilEvent !== null && hoursUntilEvent < 168) {
      return NextResponse.json(
        { error: "This event's refund policy only allows refunds more than 7 days before the event." },
        { status: 400 }
      );
    }
  }

  // Issue Stripe refund — idempotency key prevents duplicate refunds on retries
  if (order.stripe_payment_intent_id) {
    try {
      await stripe.refunds.create(
        {
          payment_intent: order.stripe_payment_intent_id,
          reverse_transfer: true,        // debit organizer's connected account, not platform
          refund_application_fee: false, // platform keeps the $1/ticket fee
        },
        { idempotencyKey: `organizer-refund-${orderId}` }
      );
    } catch (err: any) {
      console.error("Stripe refund error:", err);
      return NextResponse.json({ error: err.message ?? "Stripe refund failed" }, { status: 500 });
    }
  }

  // Mark order refunded (not cancelled — a refund is a distinct outcome from a cancellation)
  await supabaseServer
    .from("orders")
    .update({ status: "refunded" })
    .eq("id", orderId);

  // Mark all tickets for this order refunded.
  // NOTE: trg_decrement_quantity_sold fires automatically on each ticket row update
  // (status valid → refunded), so we must NOT also decrement manually — that would
  // double-count and make cancelled capacity appear twice as large.
  const { data: cancelledTickets } = await supabaseServer
    .from("tickets")
    .update({ status: "refunded" })
    .eq("order_id", orderId)
    .select("id, tier_id");

  const freedCount = cancelledTickets?.length ?? 0;

  // Auto-notify waitlist: notify first N people (matching freed ticket count)
  // Early return if no capacity was freed — no point querying the waitlist
  if (freedCount <= 0) {
    return NextResponse.json({ ok: true });
  }

  const eventId = order.event_id;
  const { data: eventDetails } = await supabaseServer
    .from("events")
    .select("title, slug")
    .eq("id", eventId)
    .single();

  if (eventDetails) {
    const { data: waitlist } = await supabaseServer
      .from("waitlist")
      .select("id, name, email")
      .eq("event_id", eventId)
      .is("notified_at", null)
      .order("created_at", { ascending: true })
      .limit(freedCount);

    for (const entry of waitlist ?? []) {
      try {
        await sendWaitlistNotification({
          email: entry.email,
          name: entry.name,
          eventTitle: eventDetails.title,
          eventSlug: eventDetails.slug,
        });
        // Mark notified so they aren't re-notified on future refunds or manual blasts
        await supabaseServer
          .from("waitlist")
          .update({ notified_at: new Date().toISOString() })
          .eq("id", entry.id);
      } catch {
        // Continue on individual failures — don't block the refund response
      }
    }
  }

  return NextResponse.json({ ok: true });
}
