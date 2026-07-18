import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../../../lib/supabase/server";
import { verifyAdminSession } from "../../../../../../../lib/auth";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

function platformFeeAmount(amountCents: number): number {
  const pct = parseFloat(process.env.PLATFORM_FEE_PERCENT ?? "0");
  if (!pct || pct <= 0) return 0;
  return Math.max(0, Math.round(amountCents * (pct / 100)));
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string; id: string }> }
) {
  const { shopSlug, id } = await params;

  const authed = await verifyAdminSession(req, shopSlug);
  if (!authed) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const { data: shop } = await supabaseServer
    .from("shops").select("id, name, stripe_account_id").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.json({ ok: false, error: "Shop not found" }, { status: 404 });

  const { data: booking } = await supabaseServer
    .from("bookings")
    .select("id, customer_name, customer_email, price_snapshot, status, payment_status, services(name), payments(amount, status, payment_type)")
    .eq("id", id)
    .eq("shop_id", shop.id)
    .single();

  if (!booking) return NextResponse.json({ ok: false, error: "Booking not found" }, { status: 404 });

  if (booking.status === "cancelled") {
    return NextResponse.json({ ok: false, error: "Cannot charge a cancelled booking." }, { status: 400 });
  }
  if (booking.payment_status === "paid") {
    return NextResponse.json({ ok: false, error: "Balance already marked as paid." }, { status: 400 });
  }

  const totalPrice = Number(booking.price_snapshot);
  const paidSoFar = (booking.payments as any[] ?? [])
    .filter((p: any) => p.status === "succeeded")
    .reduce((s: number, p: any) => s + Number(p.amount), 0);

  const remaining = Math.round((totalPrice - paidSoFar) * 100); // cents

  if (remaining <= 0) {
    return NextResponse.json({ ok: false, error: "No remaining balance." }, { status: 400 });
  }

  const serviceName = (booking.services as any)?.name ?? "Service";
  const origin = req.headers.get("origin") || "https://booking.squarebidness.com";

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    customer_email: booking.customer_email || undefined,
    line_items: [{
      price_data: {
        currency: "usd",
        unit_amount: remaining,
        product_data: {
          name: `${serviceName} — ${shop.name}`,
          description: `Remaining balance for ${booking.customer_name}`,
        },
      },
      quantity: 1,
    }],
    success_url: `${origin}/${shopSlug}/admin?balance_paid=${id}`,
    cancel_url: `${origin}/${shopSlug}/admin`,
    metadata: {
      booking_id: id,
      shop_id: shop.id,
      payment_type: "balance",
    },
    payment_intent_data: {
      metadata: { booking_id: id, shop_id: shop.id, payment_type: "balance" },
      ...(shop.stripe_account_id ? {
        transfer_data: { destination: shop.stripe_account_id },
        application_fee_amount: platformFeeAmount(remaining),
      } : {}),
    },
  });

  return NextResponse.json({ ok: true, url: session.url, amount: remaining / 100 });
}
