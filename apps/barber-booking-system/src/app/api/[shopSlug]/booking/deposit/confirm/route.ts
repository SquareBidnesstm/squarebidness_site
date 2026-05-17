import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { sendPushToBarber, sendPushToShopAdmins } from "../../../../../../lib/push";
import { sendConfirmationEmail } from "../../../../../../lib/email";
import { normalizePhone, convertDisplayTimeTo24Hour } from "../../../../../../lib/utils";
import { isSmsOptedOut } from "../../../../../../lib/sms-opt-out";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  if (!sessionId) {
    return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));
  }

  // Verify payment succeeded and pull booking data from Stripe metadata (not URL params)
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));
  }

  // BC-3: Idempotency guard — if this payment_intent was already recorded, the booking
  // was already created (e.g. page refresh or duplicate redirect). Redirect to confirmed.
  if (session.payment_intent) {
    const { data: existingPayment } = await supabaseServer
      .from("payments")
      .select("id")
      .eq("provider_payment_id", session.payment_intent as string)
      .maybeSingle();
    if (existingPayment) {
      return NextResponse.redirect(new URL(`/${shopSlug}/book?confirmed=1&returning=1`, req.url));
    }
  }

  // All booking data lives in Stripe-controlled metadata — no URL tampering possible
  const meta = session.metadata;
  if (!meta?.shop_id || !meta?.barber_slug || !meta?.service_slug || !meta?.date || !meta?.time) {
    return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));
  }

  const { data: shop } = await supabaseServer
    .from("shops").select("id, slug, name, timezone").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));

  const { data: barber } = await supabaseServer
    .from("barbers").select("id, name, display_name").eq("shop_id", shop.id).eq("slug", meta.barber_slug).eq("active", true).single();
  if (!barber) return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));

  const { data: svc } = await supabaseServer
    .from("services").select("id, name, price, duration_minutes").eq("shop_id", shop.id).eq("slug", meta.service_slug).eq("active", true).single();
  if (!svc) return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));

  const time24 = convertDisplayTimeTo24Hour(meta.time);
  if (!time24) return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));

  const startsAt = new Date(`${meta.date}T${time24}:00`);
  const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60 * 1000);

  // Check for overlaps
  const { data: overlaps } = await supabaseServer
    .from("bookings").select("id").eq("barber_id", barber.id)
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", endsAt.toISOString()).gt("ends_at", startsAt.toISOString());

  if (overlaps && overlaps.length > 0) {
    return NextResponse.redirect(new URL(`/${shopSlug}/book/${meta.barber_slug}?conflict=1`, req.url));
  }

  const { data: rpcCode } = await supabaseServer.rpc("generate_booking_code", { shop_slug: shop.slug });
  const bookingCode = rpcCode ?? `${shopSlug.slice(0, 2).toUpperCase()}-${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  const customerName = meta.customer_name || "Guest";
  const { data: customer } = await supabaseServer
    .from("customers").insert({ shop_id: shop.id, full_name: customerName }).select("id").single();

  const { data: booking, error: bookingError } = await supabaseServer
    .from("bookings").insert({
      booking_code: bookingCode,
      shop_id: shop.id,
      barber_id: barber.id,
      service_id: svc.id,
      customer_id: customer?.id ?? null,
      customer_name: customerName,
      customer_phone: meta.customer_phone || null,
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
    })
    .select("id, booking_code, starts_at, cancel_token").single();

  if (!booking) {
    // BC-2: A concurrent request won the exclusion-constraint race. The customer was
    // charged but no booking was created — issue a refund immediately.
    const errCode = (bookingError as any)?.code;
    if (errCode === "23P01" || errCode === "23505") {
      try {
        await stripe.refunds.create({ payment_intent: session.payment_intent as string });
      } catch (refundErr) {
        console.error("Refund failed after booking conflict:", refundErr);
      }
      return NextResponse.redirect(new URL(`/${shopSlug}/book?conflict=1&refunded=1`, req.url));
    }
    return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));
  }

  // Record the deposit payment so it survives reschedules
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

  // Send SMS
  const normalizedPhone = normalizePhone(meta.customer_phone ?? "");
  const smsOptedOut = normalizedPhone ? await isSmsOptedOut(normalizedPhone) : true;
  if (normalizedPhone && !smsOptedOut) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.DAPPER_FROM_NUMBER;

    if (sid && token && (messagingSid || fromNumber)) {
      const dateStr = new Date(`${meta.date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      });
      const timeStr = new Date(booking.starts_at).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: shop.timezone,
      });
      const rebookUrl = `https://booking.squarebidness.com/${shopSlug}/book/${meta.barber_slug}`;
      const cancelToken = (booking as any).cancel_token ?? null;
      const cancelUrl = cancelToken ? `https://booking.squarebidness.com/cancel/${cancelToken}` : null;
      const rescheduleUrl = cancelToken ? `https://booking.squarebidness.com/reschedule/${cancelToken}` : null;
      const smsBody = [
        `You're confirmed! ✂️`,
        ``,
        customerName,
        svc.name,
        `${dateStr} at ${timeStr}`,
        `Barber: ${barber.display_name || barber.name}`,
        `Code: ${booking.booking_code}`,
        ``,
        rescheduleUrl ? `Reschedule: ${rescheduleUrl}` : null,
        cancelUrl ? `Cancel: ${cancelUrl}` : null,
        `Book again: ${rebookUrl}`,
      ].filter(Boolean).join("\n");

      const msgParams = new URLSearchParams({ To: normalizedPhone, Body: smsBody });
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

  // Email confirmation (non-blocking)
  if (meta.customer_email) {
    sendConfirmationEmail({
      to: meta.customer_email,
      customerName,
      shopName: shop.name,
      barberName: barber.display_name || barber.name,
      serviceName: svc.name,
      appointmentDate: meta.date,
      startsAt: booking.starts_at,
      bookingCode: booking.booking_code,
      timezone: shop.timezone,
      cancelToken: (booking as any).cancel_token ?? null,
    }).catch((err) => console.error("EMAIL ERROR:", err instanceof Error ? err.message : err));
  }

  // Fire push notifications (non-blocking)
  const pushBody = `${customerName} — ${svc.name} on ${meta.date}`;
  sendPushToBarber(barber.id, { title: "New Booking (Deposit Paid)", body: pushBody, url: `/${shopSlug}/admin` }).catch(console.error);
  sendPushToShopAdmins(shop.id, { title: "New Booking (Deposit Paid)", body: pushBody, url: `/${shopSlug}/admin` }).catch(console.error);

  const calParams = new URLSearchParams({
    code: booking.booking_code,
    starts: booking.starts_at,
    ends: endsAt.toISOString(),
    service: svc.name,
    barber: barber.display_name || barber.name,
  });
  return NextResponse.redirect(new URL(`/${shopSlug}/book/${meta.barber_slug}/confirmed?${calParams.toString()}`, req.url));
}
