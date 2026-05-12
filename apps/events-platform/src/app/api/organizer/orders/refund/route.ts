import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { cookies } from "next/headers";
import { supabaseServer } from "../../../../../lib/supabase/server";
import { computeOrganizerSessionToken } from "../../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia" as any,
});

export async function POST(req: NextRequest) {
  // Auth
  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const sessionCookie = allCookies.find((c) => c.name.startsWith("org_session_"));
  if (!sessionCookie) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const organizerSlug = sessionCookie.name.replace("org_session_", "");
  const expectedToken = await computeOrganizerSessionToken(organizerSlug);
  if (sessionCookie.value !== expectedToken) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
  await supabaseServer
    .from("tickets")
    .update({ status: "cancelled" })
    .eq("order_id", orderId);

  return NextResponse.json({ ok: true });
}
