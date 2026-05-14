import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export const config = { runtime: "nodejs" };

function convertDisplayTimeTo24Hour(time: string): string | null {
  const [clock, suffix] = time.trim().split(" ");
  if (!clock || !suffix) return null;
  const [rawHour, rawMinute] = clock.split(":");
  let hour = Number(rawHour);
  const minute = Number(rawMinute);
  if (isNaN(hour) || isNaN(minute)) return null;
  if (suffix.toUpperCase() === "PM" && hour !== 12) hour += 12;
  if (suffix.toUpperCase() === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

function normalizePhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith("1")) return `+${digits}`;
  return null;
}

async function handleDepositBooking(session: Stripe.Checkout.Session) {
  const meta = session.metadata;
  if (!meta?.shop_id || !meta?.shop_slug) return;

  // Already confirmed via redirect? Skip if booking already exists for this session
  const { data: existing } = await supabaseServer
    .from("bookings")
    .select("id")
    .eq("shop_id", meta.shop_id)
    .eq("payment_status", "deposit_paid")
    .eq("customer_name", meta.customer_name ?? "")
    .eq("appointment_date", meta.date ?? "")
    .limit(1);

  // Idempotency: a recent booking for same customer+date+barber likely means redirect already ran
  if (existing && existing.length > 0) return;

  const { data: shop } = await supabaseServer
    .from("shops").select("id, slug, timezone").eq("id", meta.shop_id).eq("active", true).single();
  if (!shop) return;

  const { data: barber } = await supabaseServer
    .from("barbers").select("id, name, display_name, slug").eq("shop_id", shop.id).eq("slug", meta.barber_slug).eq("active", true).single();
  if (!barber) return;

  const { data: svc } = await supabaseServer
    .from("services").select("id, name, price, duration_minutes").eq("shop_id", shop.id).eq("slug", meta.service_slug).eq("active", true).single();
  if (!svc) return;

  const time24 = convertDisplayTimeTo24Hour(meta.time ?? "");
  if (!time24) return;

  const startsAt = new Date(`${meta.date}T${time24}:00`);
  const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60 * 1000);

  // Check overlaps
  const { data: overlaps } = await supabaseServer
    .from("bookings").select("id").eq("barber_id", barber.id)
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", endsAt.toISOString()).gt("ends_at", startsAt.toISOString());
  if (overlaps && overlaps.length > 0) return;

  const { data: bookingCode } = await supabaseServer.rpc("generate_booking_code", { shop_slug: shop.slug });
  const { data: customer } = await supabaseServer
    .from("customers").insert({ shop_id: shop.id, full_name: meta.customer_name ?? "" }).select("id").single();

  const { data: booking } = await supabaseServer
    .from("bookings").insert({
      booking_code: bookingCode,
      shop_id: shop.id,
      barber_id: barber.id,
      service_id: svc.id,
      customer_id: customer?.id ?? null,
      customer_name: meta.customer_name ?? "",
      customer_phone: meta.customer_phone ?? "",
      customer_email: meta.customer_email || null,
      appointment_date: meta.date,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_snapshot: svc.price,
      duration_snapshot_minutes: svc.duration_minutes,
      status: "confirmed",
      payment_status: "deposit_paid",
      source: "shop_booking_page",
      confirmed_at: new Date().toISOString(),
    }).select("id, booking_code, starts_at").single();

  if (!booking) return;

  // Record the deposit payment
  const depositAmountCents = session.amount_total ?? 0;
  await supabaseServer.from("payments").insert({
    booking_id: booking.id,
    shop_id: shop.id,
    amount: (depositAmountCents / 100).toFixed(2),
    payment_type: "deposit",
    provider: "stripe",
    provider_payment_id: session.payment_intent as string ?? null,
    status: "succeeded",
  });

  // Send SMS confirmation
  const normalizedPhone = normalizePhone(meta.customer_phone ?? "");
  if (normalizedPhone) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.DAPPER_FROM_NUMBER;

    if (sid && token && (messagingSid || fromNumber)) {
      const dateStr = new Date(`${meta.date}T12:00:00`).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
      const timeStr = new Date(booking.starts_at).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: shop.timezone });
      const rebookUrl = `https://booking.squarebidness.com/${shop.slug}/book/${barber.slug}`;
      const body = [
        `You're confirmed! ✂️`, ``,
        `${meta.customer_name}`, `${svc.name}`,
        `${dateStr} at ${timeStr}`, `Barber: ${barber.display_name || barber.name}`,
        `Code: ${booking.booking_code}`, ``, `Book again: ${rebookUrl}`,
      ].join("\n");

      const msgParams = new URLSearchParams({ To: normalizedPhone, Body: body });
      if (messagingSid) msgParams.set("MessagingServiceSid", messagingSid);
      else msgParams.set("From", fromNumber!);
      const creds = Buffer.from(`${sid}:${token}`).toString("base64");
      fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
        method: "POST",
        headers: { Authorization: `Basic ${creds}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: msgParams.toString(),
      }).catch(console.error);
    }
  }
}

export async function POST(req: NextRequest) {
  const body = await req.text();
  const sig = req.headers.get("stripe-signature") ?? "";
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!;

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("Webhook signature verification failed:", message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;

        // Deposit booking fallback — runs if redirect didn't create the booking
        if (session.mode === "payment") {
          await handleDepositBooking(session);
          break;
        }

        if (session.mode !== "subscription") break;
        const shopId = session.metadata?.shop_id;
        const customerId = session.customer as string;
        const subscriptionId = session.subscription as string;
        if (!shopId) break;

        const plan = session.metadata?.plan === "solo" ? "solo" : "pro";

        await supabaseServer.from("subscriptions").upsert(
          {
            shop_id: shopId,
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            status: "active",
            plan,
            current_period_end: null,
          },
          { onConflict: "shop_id" }
        );
        break;
      }

      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const shopId = sub.metadata?.shop_id;
        if (!shopId) break;

        const periodEndTs = sub.items?.data?.[0]?.current_period_end ?? null;
        const periodEnd = periodEndTs ? new Date(periodEndTs * 1000).toISOString() : null;
        const status = sub.status === "active" ? "active" : sub.status === "past_due" ? "past_due" : "canceled";

        // Preserve plan from metadata; fall back to checking price ID
        let plan = sub.metadata?.plan ?? "";
        if (!plan || (status !== "active")) {
          plan = status === "active" ? "pro" : "free";
        }

        await supabaseServer
          .from("subscriptions")
          .update({
            status,
            plan: status === "active" ? plan : "free",
            stripe_subscription_id: sub.id,
            ...(periodEnd ? { current_period_end: periodEnd } : {}),
          })
          .eq("shop_id", shopId);
        break;
      }

      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const shopId = sub.metadata?.shop_id;
        if (!shopId) break;

        await supabaseServer
          .from("subscriptions")
          .update({ status: "canceled", plan: "free", stripe_subscription_id: null, current_period_end: null })
          .eq("shop_id", shopId);
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        if (!customerId) break;

        await supabaseServer
          .from("subscriptions")
          .update({ status: "past_due" })
          .eq("stripe_customer_id", customerId);
        break;
      }

      default:
        // Unhandled event — ignore
        break;
    }
  } catch (err) {
    console.error("Webhook handler error:", err);
    return NextResponse.json({ error: "Handler error" }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
