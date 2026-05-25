import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../lib/supabase/server";
import { normalizePhone, convertDisplayTimeTo24Hour } from "../../../../lib/utils";
import { sendConfirmationEmail } from "../../../../lib/email";
import { sendPushToBarber, sendPushToShopAdmins } from "../../../../lib/push";
import { isSmsOptedOut } from "../../../../lib/sms-opt-out";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: "2026-04-22.dahlia",
});

export const config = { runtime: "nodejs" };

async function handleDepositBooking(session: Stripe.Checkout.Session): Promise<{ error: string; status: number } | null> {
  const meta = session.metadata;
  if (!meta?.shop_id || !meta?.shop_slug) return null;

  // Idempotency: check by payment_intent ID — globally unique, immune to name/date collisions
  const paymentIntentId = session.payment_intent as string | null;
  if (paymentIntentId) {
    const { data: existingPayment } = await supabaseServer
      .from("payments")
      .select("id")
      .eq("provider_payment_id", paymentIntentId)
      .limit(1);
    if (existingPayment && existingPayment.length > 0) return null;
  }

  const { data: shop } = await supabaseServer
    .from("shops").select("id, slug, name, timezone").eq("id", meta.shop_id).eq("active", true).single();
  if (!shop) return null;

  const { data: barber } = await supabaseServer
    .from("barbers").select("id, name, display_name, slug").eq("shop_id", shop.id).eq("slug", meta.barber_slug).eq("active", true).single();
  if (!barber) return null;

  const { data: svc } = await supabaseServer
    .from("services").select("id, name, price, duration_minutes").eq("shop_id", shop.id).eq("slug", meta.service_slug).eq("active", true).single();
  if (!svc) return null;

  const time24 = convertDisplayTimeTo24Hour(meta.time ?? "");
  if (!time24) return null;

  const startsAt = new Date(`${meta.date}T${time24}:00`);
  const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60 * 1000);

  // Check overlaps
  const { data: overlaps } = await supabaseServer
    .from("bookings").select("id").eq("barber_id", barber.id)
    .in("status", ["pending", "confirmed", "pending_approval", "counter_proposed", "awaiting_payment"])
    .lt("starts_at", endsAt.toISOString()).gt("ends_at", startsAt.toISOString());
  if (overlaps && overlaps.length > 0) return null;

  const { data: rpcCode } = await supabaseServer.rpc("generate_booking_code", { shop_slug: shop.slug });
  const bookingCode = rpcCode ?? `${shop.slug.slice(0, 2).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
  const { data: customer } = await supabaseServer
    .from("customers").insert({ shop_id: shop.id, full_name: meta.customer_name ?? "" }).select("id").single();

  const { data: booking, error: bookingInsertError } = await supabaseServer
    .from("bookings").insert({
      booking_code: bookingCode,
      shop_id: shop.id,
      barber_id: barber.id,
      service_id: svc.id,
      customer_id: customer?.id ?? null,
      customer_name: meta.customer_name ?? "",
      customer_phone: meta.customer_phone ?? "",
      customer_email: meta.customer_email || null,
      client_notes: meta.client_notes || null,
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

  if (!booking) {
    // BC-2: Exclusion constraint violation means a concurrent request already created
    // a booking for this slot. Refund the customer — they paid but cannot get the slot.
    const errCode = (bookingInsertError as any)?.code;
    if (errCode === "23P01" || errCode === "23505") {
      console.error("Webhook booking insert conflict (23P01/23505) — slot already taken:", {
        paymentIntent: session.payment_intent,
        shopSlug: meta.shop_slug,
        date: meta.date,
        time: meta.time,
      });
      if (session.payment_intent) {
        await stripe.refunds.create({ payment_intent: session.payment_intent as string, reason: "duplicate" }).catch(err => console.error("[webhook] refund failed:", err));
      }
      return { error: "Slot already booked — refund issued", status: 409 };
    }
    return null;
  }

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

  // Send SMS confirmation (skip if customer opted out)
  const normalizedPhone = normalizePhone(meta.customer_phone ?? "");
  const webhookSmsOptedOut = normalizedPhone ? await isSmsOptedOut(normalizedPhone) : true;
  if (normalizedPhone && !webhookSmsOptedOut) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.PLATFORM_FROM_NUMBER;

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

  // Send email confirmation (non-blocking)
  if (meta.customer_email) {
    sendConfirmationEmail({
      to: meta.customer_email,
      customerName: meta.customer_name ?? "",
      shopName: (shop as any).name ?? shop.slug,
      barberName: barber.display_name || barber.name,
      serviceName: svc.name,
      appointmentDate: meta.date ?? "",
      startsAt: booking.starts_at,
      bookingCode: booking.booking_code,
      timezone: shop.timezone,
      cancelToken: (booking as any).cancel_token ?? null,
    }).catch((err) => console.error("WEBHOOK EMAIL ERROR:", err instanceof Error ? err.message : err));
  }
  return null;
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
          // Balance payment via admin-generated link
          if (session.metadata?.payment_type === "balance" && session.metadata?.booking_id) {
            const bookingId = session.metadata.booking_id;
            const shopId = session.metadata.shop_id;
            const amountCents = session.amount_total ?? 0;
            await supabaseServer.from("payments").insert({
              booking_id: bookingId,
              shop_id: shopId,
              amount: (amountCents / 100).toFixed(2),
              payment_type: "balance",
              provider: "stripe",
              provider_payment_id: session.payment_intent as string ?? null,
              status: "succeeded",
            });
            await supabaseServer.from("bookings").update({ payment_status: "paid" }).eq("id", bookingId);
            break;
          }
          const depositErr = await handleDepositBooking(session);
          if (depositErr) return NextResponse.json({ error: depositErr.error }, { status: depositErr.status });
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

      case "checkout.session.expired": {
        const session = event.data.object as Stripe.Checkout.Session;
        // Only handle deposit sessions (subscription checkouts don't need cleanup)
        if (session.mode !== "payment") break;
        const meta = session.metadata;

        // Special-session payment link expired — barber sent the link, customer never paid.
        // Revert the booking to cancelled so the slot is freed immediately.
        if (meta?.booking_id && !meta?.shop_id) {
          await supabaseServer
            .from("bookings")
            .update({ status: "cancelled", special_session_checkout_id: null })
            .eq("id", meta.booking_id)
            .eq("status", "awaiting_payment"); // idempotency: only act if still awaiting
          console.warn("[webhook] Special session expired — booking cancelled:", meta.booking_id);
          break;
        }

        // Balance-payment links have payment_type=balance — those aren't abandoned bookings
        if (!meta?.shop_id || !meta?.customer_name || meta?.payment_type === "balance") break;

        console.warn("ABANDONED DEPOSIT SESSION:", {
          sessionId: session.id,
          shop: meta.shop_slug,
          customer: meta.customer_name,
          phone: meta.customer_phone,
          date: meta.date,
          time: meta.time,
          service: meta.service_slug,
          barber: meta.barber_slug,
        });

        // Push shop admins + barber so they can follow up with the customer
        const { data: shop } = await supabaseServer
          .from("shops").select("id").eq("id", meta.shop_id).single();
        if (shop) {
          const { data: barber } = await supabaseServer
            .from("barbers").select("id").eq("shop_id", shop.id).eq("slug", meta.barber_slug).single();
          const pushBody = `${meta.customer_name} didn't complete their deposit for ${meta.date} at ${meta.time}`;
          if (barber) {
            sendPushToBarber(barber.id, {
              title: "Abandoned Deposit Checkout",
              body: pushBody,
              url: `/${meta.shop_slug}/admin`,
            }).catch(console.error);
          }
          sendPushToShopAdmins(shop.id, {
            title: "Abandoned Deposit Checkout",
            body: pushBody,
            url: `/${meta.shop_slug}/admin`,
          }).catch(console.error);
        }
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
