import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { getVerifiedOrganizerSlug } from "../../../../../lib/auth";
import { sendWaitlistNotification } from "../../../../../lib/notifications/email";

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
    .select("*, events ( organizer_id )")
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

  // Issue Stripe refund
  if (order.stripe_payment_intent_id) {
    try {
      await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        reverse_transfer: true,        // debit organizer's connected account, not platform
        refund_application_fee: false, // platform keeps the $1/ticket fee
      });
    } catch (err: any) {
      console.error("Stripe refund error:", err);
      return NextResponse.json({ error: err.message ?? "Stripe refund failed" }, { status: 500 });
    }
  }

  // Mark order cancelled
  await supabaseServer
    .from("orders")
    .update({ status: "cancelled" })
    .eq("id", orderId);

  // Mark all tickets for this order cancelled
  const { data: cancelledTickets } = await supabaseServer
    .from("tickets")
    .update({ status: "cancelled" })
    .eq("order_id", orderId)
    .select("id");

  const freedCount = cancelledTickets?.length ?? 0;

  // Auto-notify waitlist: notify first N people (matching freed ticket count)
  if (freedCount > 0) {
    const eventId = order.event_id;
    const { data: event } = await supabaseServer
      .from("events")
      .select("title, slug")
      .eq("id", eventId)
      .single();

    if (event) {
      const { data: waitlist } = await supabaseServer
        .from("waitlist")
        .select("id, name, email")
        .eq("event_id", eventId)
        .order("created_at", { ascending: true })
        .limit(freedCount);

      for (const entry of waitlist ?? []) {
        sendWaitlistNotification({
          email: entry.email,
          name: entry.name,
          eventTitle: event.title,
          eventSlug: event.slug,
        }).catch(() => {});
      }
    }
  }

  return NextResponse.json({ ok: true });
}
