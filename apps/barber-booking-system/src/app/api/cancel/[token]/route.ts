import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

// Hours before appointment within which deposit is forfeited
const FORFEIT_WINDOW_HOURS = 24;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: booking } = await supabaseServer
    .from("bookings")
    .select(`id, status, payment_status, starts_at, customer_name, customer_phone, shop_id,
      shops(timezone), payments(id, amount, provider_payment_id, payment_type, status)`)
    .eq("cancel_token", token)
    .single();

  if (!booking) return NextResponse.json({ ok: false, error: "Invalid or expired cancel link" }, { status: 404 });
  if (booking.status === "cancelled") return NextResponse.json({ ok: false, error: "Already cancelled" }, { status: 400 });
  if (["completed", "no_show"].includes(booking.status)) {
    return NextResponse.json({ ok: false, error: "Cannot cancel a completed appointment" }, { status: 400 });
  }

  const now = new Date();
  const apptTime = new Date(booking.starts_at);
  const hoursUntil = (apptTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const refundDeposit = hoursUntil >= FORFEIT_WINDOW_HOURS;

  // Cancel the booking
  await supabaseServer
    .from("bookings")
    .update({ status: "cancelled", cancelled_at: now.toISOString(), cancelled_by: "client" })
    .eq("id", booking.id);

  // Handle deposit
  const depositPayment = (booking.payments as any[] ?? []).find(
    (p: any) => p.payment_type === "deposit" && p.status === "succeeded"
  );

  let refunded = false;
  if (depositPayment && refundDeposit && depositPayment.provider_payment_id) {
    try {
      await stripe.refunds.create({ payment_intent: depositPayment.provider_payment_id });
      await supabaseServer.from("payments").update({ status: "refunded" }).eq("id", depositPayment.id);
      await supabaseServer.from("bookings").update({ payment_status: "refunded" }).eq("id", booking.id);
      refunded = true;
    } catch (e) {
      console.error("Self-cancel refund failed:", e);
    }
  }

  return NextResponse.json({
    ok: true,
    refunded,
    refundAmount: depositPayment ? Number(depositPayment.amount) : 0,
    forfeitReason: !refundDeposit ? `Cancellations within ${FORFEIT_WINDOW_HOURS}h of the appointment forfeit the deposit.` : null,
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  const { data: booking } = await supabaseServer
    .from("bookings")
    .select(`id, status, payment_status, starts_at, customer_name,
      shops(name, timezone, slug),
      barbers(name, display_name),
      services(name),
      payments(amount, payment_type, status)`)
    .eq("cancel_token", token)
    .single();

  if (!booking) return NextResponse.json({ ok: false, error: "Invalid link" }, { status: 404 });

  const now = new Date();
  const apptTime = new Date(booking.starts_at);
  const hoursUntil = (apptTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const willRefund = hoursUntil >= 24;
  const deposit = (booking.payments as any[] ?? []).find((p: any) => p.payment_type === "deposit" && p.status === "succeeded");

  return NextResponse.json({
    ok: true,
    booking: {
      status: booking.status,
      payment_status: booking.payment_status,
      starts_at: booking.starts_at,
      customer_name: booking.customer_name,
      shop_name: (booking.shops as any)?.name,
      barber_name: (booking.barbers as any)?.display_name || (booking.barbers as any)?.name,
      service_name: (booking.services as any)?.name,
      deposit_amount: deposit ? Number(deposit.amount) : null,
      will_refund: willRefund,
      hours_until: Math.round(hoursUntil),
    },
  });
}
