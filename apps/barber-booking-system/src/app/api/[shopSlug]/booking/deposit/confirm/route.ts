import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { supabaseServer } from "../../../../../../lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: "2026-04-22.dahlia" });

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

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ shopSlug: string }> }
) {
  const { shopSlug } = await params;
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  const dataParam = searchParams.get("data");

  if (!sessionId || !dataParam) {
    return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));
  }

  // Verify payment succeeded
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (session.payment_status !== "paid") {
    return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));
  }

  const bookingData = JSON.parse(decodeURIComponent(dataParam)) as {
    barber_id: string; customer_name: string; customer_phone: string;
    customer_email?: string; service: string; time: string; date: string;
  };

  const { data: shop } = await supabaseServer
    .from("shops").select("id, slug, timezone").eq("slug", shopSlug).eq("active", true).single();
  if (!shop) return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));

  const { data: barber } = await supabaseServer
    .from("barbers").select("id, name, display_name").eq("shop_id", shop.id).eq("slug", bookingData.barber_id).eq("active", true).single();
  if (!barber) return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));

  const { data: svc } = await supabaseServer
    .from("services").select("id, name, price, duration_minutes").eq("shop_id", shop.id).eq("slug", bookingData.service).eq("active", true).single();
  if (!svc) return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));

  const time24 = convertDisplayTimeTo24Hour(bookingData.time);
  if (!time24) return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));

  const startsAt = new Date(`${bookingData.date}T${time24}:00`);
  const endsAt = new Date(startsAt.getTime() + svc.duration_minutes * 60 * 1000);

  // Check for overlaps
  const { data: overlaps } = await supabaseServer
    .from("bookings").select("id").eq("barber_id", barber.id)
    .in("status", ["pending", "confirmed"])
    .lt("starts_at", endsAt.toISOString()).gt("ends_at", startsAt.toISOString());

  if (overlaps && overlaps.length > 0) {
    return NextResponse.redirect(new URL(`/${shopSlug}/book/${bookingData.barber_id}?conflict=1`, req.url));
  }

  const { data: bookingCode } = await supabaseServer.rpc("generate_booking_code", { shop_slug: shop.slug });

  const { data: customer } = await supabaseServer
    .from("customers").insert({ shop_id: shop.id, full_name: bookingData.customer_name }).select("id").single();

  const { data: booking } = await supabaseServer
    .from("bookings").insert({
      booking_code: bookingCode,
      shop_id: shop.id,
      barber_id: barber.id,
      service_id: svc.id,
      customer_id: customer?.id ?? null,
      customer_name: bookingData.customer_name,
      customer_phone: bookingData.customer_phone,
      customer_email: bookingData.customer_email || null,
      appointment_date: bookingData.date,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      price_snapshot: svc.price,
      duration_snapshot_minutes: svc.duration_minutes,
      status: "confirmed",
      payment_status: "deposit_paid",
      source: "shop_booking_page",
      confirmed_at: new Date().toISOString(),
    })
    .select("id, booking_code, starts_at").single();

  if (!booking) return NextResponse.redirect(new URL(`/${shopSlug}`, req.url));

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
  const normalizedPhone = normalizePhone(bookingData.customer_phone);
  if (normalizedPhone) {
    const sid = process.env.TWILIO_ACCOUNT_SID;
    const token = process.env.TWILIO_AUTH_TOKEN;
    const messagingSid = process.env.TWILIO_MESSAGING_SERVICE_SID;
    const fromNumber = process.env.DAPPER_FROM_NUMBER;

    if (sid && token && (messagingSid || fromNumber)) {
      const dateStr = new Date(`${bookingData.date}T12:00:00`).toLocaleDateString("en-US", {
        weekday: "long", month: "long", day: "numeric",
      });
      const timeStr = new Date(booking.starts_at).toLocaleTimeString("en-US", {
        hour: "numeric", minute: "2-digit", timeZone: shop.timezone,
      });
      const rebookUrl = `https://booking.squarebidness.com/${shopSlug}/book/${bookingData.barber_id}`;
      const body = [
        `You're confirmed! ✂️`,
        ``,
        `${bookingData.customer_name}`,
        `${svc.name}`,
        `${dateStr} at ${timeStr}`,
        `Barber: ${barber.display_name || barber.name}`,
        `Code: ${booking.booking_code}`,
        ``,
        `Book again: ${rebookUrl}`,
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

  return NextResponse.redirect(new URL(`/${shopSlug}/book/${bookingData.barber_id}/confirmed?code=${booking.booking_code}`, req.url));
}
