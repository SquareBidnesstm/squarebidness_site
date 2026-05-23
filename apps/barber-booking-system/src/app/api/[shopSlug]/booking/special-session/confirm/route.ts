// GET /api/[shopSlug]/booking/special-session/confirm?session_id=XXXX
// Stripe success redirect for special session full payments.
// Verifies payment, marks booking confirmed, SMS both parties.

import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../../lib/supabase/server";
import { normalizePhone } from "../../../../../../lib/utils";
import { isSmsOptedOut } from "../../../../../../lib/sms-opt-out";
import { sendPushToBarber, sendPushToShopAdmins } from "../../../../../../lib/push";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

async function sendSms(to: string, body: string) {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
  const fromNumber = process.env.PLATFORM_FROM_NUMBER;
  if (!sid || !token || (!messagingSid && !fromNumber)) return;

  const p = new URLSearchParams({ To: to, Body: body });
  if (messagingSid) p.set("MessagingServiceSid", messagingSid);
  else p.set("From", fromNumber!);

  await fetch(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: p.toString(),
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");

  const fallback = new URL(`/${shopSlug}`, req.url);

  if (!sessionId) return NextResponse.redirect(fallback);

  // Verify payment with Stripe
  let session: Stripe.Checkout.Session;
  try {
    session = await stripe.checkout.sessions.retrieve(sessionId);
  } catch {
    return NextResponse.redirect(fallback);
  }

  if (session.payment_status !== "paid") {
    return NextResponse.redirect(fallback);
  }

  // Find the booking by checkout session ID (idempotency guard)
  const { data: booking } = await supabaseServer
    .from("bookings")
    .select("id, booking_code, status, customer_name, customer_phone, customer_email, appointment_date, starts_at, ends_at, cancel_token, barber_id, shop_id, special_session_price_cents")
    .eq("special_session_checkout_id", sessionId)
    .maybeSingle();

  if (!booking) return NextResponse.redirect(fallback);

  // Already confirmed (simple duplicate redirect guard — catches refresh before DB write)
  if (booking.status === "confirmed") {
    return NextResponse.redirect(new URL(`/${shopSlug}/book?special=confirmed&code=${booking.booking_code}`, req.url));
  }

  // Confirm the booking — conditional on status=awaiting_payment so only one concurrent
  // request wins. If 0 rows updated, a simultaneous redirect already confirmed it.
  const { data: updatedRows, error: updateError } = await supabaseServer
    .from("bookings")
    .update({ status: "confirmed", payment_status: "paid", confirmed_at: new Date().toISOString() })
    .eq("id", booking.id)
    .eq("status", "awaiting_payment")
    .select("id");

  if (updateError) {
    console.error("[special-session/confirm] Update error:", updateError);
    return NextResponse.redirect(fallback);
  }

  // Another request won the race — redirect to confirmation without double-notifying
  if (!updatedRows || updatedRows.length === 0) {
    return NextResponse.redirect(new URL(`/${shopSlug}/book?special=confirmed&code=${booking.booking_code}`, req.url));
  }

  // Record payment
  const amountCents = session.amount_total ?? (booking.special_session_price_cents ?? 0);
  await supabaseServer.from("payments").insert({
    booking_id: booking.id,
    shop_id: booking.shop_id,
    amount: (amountCents / 100).toFixed(2),
    payment_type: "full",
    provider: "stripe",
    provider_payment_id: session.payment_intent as string ?? null,
    status: "succeeded",
  }).then(({ error }) => { if (error) console.error("[special-session/confirm] Payment insert error:", error); });

  // Fetch barber + shop for notifications
  const [{ data: barber }, { data: shop }] = await Promise.all([
    supabaseServer.from("barbers").select("id, slug, name, display_name, phone").eq("id", booking.barber_id).single(),
    supabaseServer.from("shops").select("id, name, timezone").eq("id", booking.shop_id).single(),
  ]);

  const barberName = barber?.display_name || barber?.name || "Your barber";
  const timezone = shop?.timezone ?? "America/Chicago";

  const dateLabel = new Date(`${booking.appointment_date}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric",
  });
  const timeLabel = new Date(booking.starts_at).toLocaleTimeString("en-US", {
    hour: "numeric", minute: "2-digit", timeZone: timezone,
  });
  const cancelUrl = booking.cancel_token
    ? `https://booking.squarebidness.com/cancel/${booking.cancel_token}`
    : null;

  // ── SMS to client ────────────────────────────────────────────────────────────
  const clientPhone = normalizePhone(booking.customer_phone ?? "");
  const clientOptedOut = clientPhone ? await isSmsOptedOut(clientPhone) : true;
  if (clientPhone && !clientOptedOut) {
    sendSms(clientPhone, [
      `You're confirmed! ⚡`,
      ``,
      `${booking.customer_name}`,
      `${dateLabel} at ${timeLabel}`,
      `Barber: ${barberName}`,
      `Code: ${booking.booking_code}`,
      `Paid in full — see you there!`,
      cancelUrl ? `\nCancel: ${cancelUrl}` : null,
    ].filter(Boolean).join("\n")).catch(console.error);
  }

  // ── SMS to barber ────────────────────────────────────────────────────────────
  const barberPhone = normalizePhone(barber?.phone ?? "");
  if (barberPhone) {
    sendSms(barberPhone, [
      `Special session confirmed & paid! ⚡`,
      ``,
      `${booking.customer_name}`,
      `${dateLabel} at ${timeLabel}`,
      `Code: ${booking.booking_code}`,
    ].join("\n")).catch(console.error);
  }

  // Push notifications
  if (barber) {
    sendPushToBarber(barber.id, {
      title: "Special Session Paid ⚡",
      body: `${booking.customer_name} — ${dateLabel} at ${timeLabel}`,
      url: `/${shopSlug}/admin`,
    }).catch(console.error);
  }
  if (shop) {
    sendPushToShopAdmins(shop.id, {
      title: "Special Session Paid ⚡",
      body: `${booking.customer_name} — ${dateLabel} at ${timeLabel}`,
      url: `/${shopSlug}/admin`,
    }).catch(console.error);
  }

  // Redirect to confirmation page
  const calParams = new URLSearchParams({
    code: booking.booking_code,
    starts: booking.starts_at,
    ends: booking.ends_at,
    special: "1",
  });
  const barberSlug = barber?.slug ?? "";
  return NextResponse.redirect(
    new URL(`/${shopSlug}/book/${barberSlug}/confirmed?${calParams.toString()}`, req.url)
  );
}
