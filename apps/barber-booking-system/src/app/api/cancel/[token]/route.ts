import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { sendPushToBarber, sendPushToShopAdmins } from "../../../../lib/push";
import { checkRateLimit, recordAttempt } from "../../../../lib/utils";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

// Hours before appointment within which deposit is forfeited
const FORFEIT_WINDOW_HOURS = 24;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  // BC-4: Per-token rate limit — 5 attempts per 15 min per token
  const tokenKey = `cancel:tok:${token}`;
  recordAttempt(tokenKey);
  const { limited: tokenLimited } = checkRateLimit(tokenKey, 5);
  if (tokenLimited) {
    return NextResponse.json({ ok: false, error: "Too many attempts. Try again later." }, { status: 429 });
  }

  // Rate limit: 10 cancel attempts per 15 min per IP
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? "unknown";
  recordAttempt(`cancel:${ip}`);
  const { limited } = checkRateLimit(`cancel:${ip}`, 10);
  if (limited) {
    return NextResponse.json({ ok: false, error: "Too many requests. Please wait before trying again." }, { status: 429 });
  }

  const { data: booking } = await supabaseServer
    .from("bookings")
    .select(`id, status, payment_status, starts_at, customer_name, customer_phone, shop_id, barber_id,
      shops(id, slug, name, timezone),
      barbers(id, name, display_name),
      services(name),
      payments(id, amount, provider_payment_id, payment_type, status)`)
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
  let refundFailed = false;
  if (depositPayment && refundDeposit && depositPayment.provider_payment_id) {
    try {
      await stripe.refunds.create({ payment_intent: depositPayment.provider_payment_id });
      // Refund succeeded — update DB records. Log failures but don't crash.
      try {
        await supabaseServer.from("payments").update({ status: "refunded" }).eq("id", depositPayment.id);
        await supabaseServer.from("bookings").update({ payment_status: "refunded" }).eq("id", booking.id);
      } catch (dbErr) {
        console.error("Self-cancel DB update after refund failed:", dbErr);
      }
      refunded = true;
    } catch (e) {
      console.error("Self-cancel refund failed:", e);
      // Mark as refund_failed so admin can see it and retry manually
      await supabaseServer
        .from("bookings")
        .update({ payment_status: "refund_failed" })
        .eq("id", booking.id);
      refundFailed = true;

      // Notify shop admin via push
      const shop = booking.shops as any;
      if (shop?.id) {
        sendPushToShopAdmins(shop.id, {
          title: "⚠️ Refund Failed",
          body: `Deposit refund for ${booking.customer_name} failed — action required in Stripe dashboard.`,
          url: `/${shop.slug}/admin`,
        }).catch(console.error);
      }
    }
  }

  // Notify barber and admin
  const shop = booking.shops as any;
  const barber = booking.barbers as any;
  const service = booking.services as any;

  const apptStr = new Date(booking.starts_at).toLocaleString("en-US", {
    weekday: "short", month: "short", day: "numeric",
    hour: "numeric", minute: "2-digit",
    timeZone: shop?.timezone ?? "America/New_York",
  });
  const pushTitle = "Booking Cancelled";
  const pushBody = `${booking.customer_name} — ${service?.name ?? "appointment"} on ${apptStr} was cancelled by customer`;
  const pushUrl = `/${shop?.slug}/admin`;

  if (barber?.id) {
    sendPushToBarber(barber.id, { title: pushTitle, body: pushBody, url: pushUrl }).catch(console.error);
  }
  if (shop?.id) {
    sendPushToShopAdmins(shop.id, { title: pushTitle, body: pushBody, url: pushUrl }).catch(console.error);
  }

  // SMS to barber's phone if they have one stored (best effort)
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const twilioToken = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.DAPPER_FROM_NUMBER;

  if (sid && twilioToken && (messagingSid || fromNumber) && shop?.slug) {
    const { data: shopRow } = await supabaseServer
      .from("shops").select("notification_phone").eq("id", shop.id).single();
    const notifyPhone = (shopRow as any)?.notification_phone;

    if (notifyPhone) {
      const digits = notifyPhone.replace(/\D/g, "");
      const e164 = digits.length === 10 ? `+1${digits}` : digits.length === 11 && digits.startsWith("1") ? `+${digits}` : null;
      if (e164) {
        const smsBody = `❌ Cancelled: ${booking.customer_name} — ${service?.name ?? "appointment"}\n${apptStr}\nBarber: ${barber?.display_name || barber?.name || ""}`;
        const msgParams = new URLSearchParams({ To: e164, Body: smsBody });
        if (messagingSid) msgParams.set("MessagingServiceSid", messagingSid);
        else msgParams.set("From", fromNumber!);
        const creds = Buffer.from(`${sid}:${twilioToken}`).toString("base64");
        fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
          method: "POST",
          headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
          body: msgParams.toString(),
        }).catch(console.error);
      }
    }
  }

  return NextResponse.json({
    ok: true,
    refunded,
    refundFailed,
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
